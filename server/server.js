"use strict";

require("dotenv").config();
if (process.env.NODE_ENV !== "production") {
  // Support local development environments with custom root certificates on Windows
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const admin = require("firebase-admin");
const {GoogleGenAI} = require("@google/genai");
const {analyzeIssueWithGemini, translateTextWithGemini} = require("./gemini");
const {findMatchingGroup, calculateDistanceMeters, DEFAULT_GROUP_RADIUS_METERS} = require("./grouping");
const {generateIdentityHash, normalizeGovernmentId} = require("./identity");

// 1. Initialize Firebase Admin SDK
/**
 * Initializes the Firebase Admin SDK using environment variables or credentials.
 * @return {admin.app.App} The initialized Firebase App instance.
 */
function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Option A: JSON string in environment variable (e.g. Render / Railway)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      return admin.initializeApp({
        credential: admin.credential.cert(sa),
      });
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env var:", err);
    }
  }

  // Option B: File path via GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (fs.existsSync(credPath)) {
      return admin.initializeApp({
        credential: admin.credential.cert(credPath),
      });
    }
  }

  // Option C: Local serviceAccountKey.json if present
  const localKeyPath = path.resolve(__dirname, "serviceAccountKey.json");
  if (fs.existsSync(localKeyPath)) {
    return admin.initializeApp({
      credential: admin.credential.cert(localKeyPath),
    });
  }

  // Option D: Default application credentials
  return admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || "civicpulse-ai-41cd1",
  });
}

const app = initFirebaseAdmin();
const db = admin.firestore(app);

// 2. Setup Express Application
const server = express();
server.use(express.json({limit: "10mb"}));

// Enable CORS for frontend API calls
server.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Set of issue IDs currently being processed to prevent concurrent duplicate calls
const inFlightProcessing = new Set();

/**
 * Process an issue document with Gemini AI and update Firestore.
 * @param {string} issueId Firestore Document ID.
 * @param {object} issueData Issue Document Data.
 */
async function processIssue(issueId, issueData) {
  if (!issueId || !issueData) return;

  // Idempotency check: Skip if already processed or currently processing
  if (
    issueData.aiProcessedAt ||
    issueData.aiStatus === "COMPLETED" ||
    inFlightProcessing.has(issueId)
  ) {
    return;
  }

  inFlightProcessing.add(issueId);
  console.log(`[AI WORKER] Processing issue: ${issueId} - "${issueData.title}"`);

  const issueRef = db.collection("issues").doc(issueId);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("[AI WORKER ERROR] GEMINI_API_KEY environment variable is not set.");
    inFlightProcessing.delete(issueId);
    return;
  }

  try {
    const aiResult = await analyzeIssueWithGemini(issueData, apiKey);

    console.log(`[AI WORKER] Completed analysis for ${issueId}:`, {
      priority: aiResult.priority,
      score: aiResult.priorityScore,
      category: aiResult.category,
      language: aiResult.language,
    });

    // Update Firestore issue with AI classification while preserving existing fields
    await issueRef.update({
      aiLanguage: aiResult.language,
      aiTranslatedText: aiResult.translatedText,
      aiCategory: aiResult.category,
      aiPriority: aiResult.priority,
      aiPriorityScore: aiResult.priorityScore,
      aiReason: aiResult.reason,
      aiStatus: "COMPLETED",
      aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Sync top-level priority so dashboards update in real time
      priority: aiResult.priority,
      priorityScore: aiResult.priorityScore,
    });

    console.log(`[AI WORKER] Issue ${issueId} updated successfully in Firestore.`);
  } catch (err) {
    console.error(`[AI WORKER ERROR] Failed to process issue ${issueId}:`, err);

    await issueRef.update({
      aiStatus: "FAILED",
      aiError: err.message || "Unknown error during AI analysis",
      aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch((updateErr) => {
      console.error(`[AI WORKER ERROR] Failed to record failure on ${issueId}:`, updateErr);
    });
  } finally {
    inFlightProcessing.delete(issueId);
  }
}

// 3. Real-Time Firestore Listener for Civic Issues
/**
 * Starts real-time subscription listener on the Firestore 'issues' collection.
 * @return {Function} Unsubscribe function for the listener.
 */
function startFirestoreListener() {
  console.log("[LISTENER] Subscribing in real time to Firestore 'issues' collection...");

  return db.collection("issues").onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const issueData = change.doc.data();
            const issueId = change.doc.id;

            // Only process unclassified issues
            if (!issueData.aiProcessedAt && issueData.aiStatus !== "COMPLETED") {
              processIssue(issueId, issueData);
            }
          }
        });
      },
      (error) => {
        console.error("[LISTENER ERROR] Firestore subscription error:", error);
      },
  );
}

// 4. HTTP Routes & Health Checks
server.get("/", (req, res) => {
  res.json({
    service: "CivicPulse-AI Backend",
    status: "online",
  });
});

server.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// Secure dynamic translation endpoint for user-generated complaint descriptions
server.post("/api/translate", async (req, res) => {
  try {
    const {text, sourceLanguage, targetLanguage} = req.body;
    console.log(`[TRANSLATE] Received translation request:`, {
      sourceLanguage: sourceLanguage || "Auto",
      targetLanguage: targetLanguage || "English",
      textSnippet: text ? (text.slice(0, 60) + (text.length > 60 ? "..." : "")) : "",
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    });

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({error: "Missing or invalid 'text' parameter."});
    }

    const target = targetLanguage || "English";
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[TRANSLATE ERROR] GEMINI_API_KEY is missing from server environment.");
      return res.status(500).json({error: "GEMINI_API_KEY is not configured on server."});
    }

    const translatedText = await translateTextWithGemini(
        text.trim(),
        sourceLanguage || "Auto",
        target,
        apiKey,
    );

    console.log(`[TRANSLATE SUCCESS] Translated to ${target}: "${translatedText.slice(0, 60)}..."`);

    return res.json({
      translatedText,
      targetLanguage: target,
      sourceLanguage: sourceLanguage || "Auto",
    });
  } catch (err) {
    console.error("[TRANSLATE API ERROR]", err);
    return res.status(500).json({
      error: err.message || "Failed to translate complaint text.",
    });
  }
});

// Optional Audio Transcription Fallback using Gemini
server.post("/api/transcribe", async (req, res) => {
  try {
    const {audioBase64, mimeType, language} = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({error: "GEMINI_API_KEY is not configured on server."});
    }

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({error: "Missing or invalid 'audioBase64' payload."});
    }

    const ai = new GoogleGenAI({apiKey});
    const promptText = `Transcribe the spoken audio accurately into text in the language spoken (${language || "Indian English/Hindi/Marathi"}). Return ONLY the raw transcript with no preamble or quotes.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType || "audio/webm",
            data: audioBase64.replace(/^data:audio\/\w+;base64,/, ""),
          },
        },
        promptText,
      ],
    });

    const transcript = response.text ? response.text.trim() : "";
    return res.json({transcript});
  } catch (err) {
    console.error("[TRANSCRIBE ERROR]", err);
    return res.status(500).json({error: err.message || "Audio transcription failed."});
  }
});

// Secure Citizen Identity Uniqueness & Verification Endpoint
server.post("/api/identity/verify", async (req, res) => {
  try {
    const {uid, idNumber, idType, idDocumentUrl} = req.body;

    if (!uid || typeof uid !== "string") {
      return res.status(400).json({error: "Missing or invalid user ID ('uid')."});
    }
    if (!idNumber || typeof idNumber !== "string") {
      return res.status(400).json({error: "Missing or invalid government identity number."});
    }

    const normalized = normalizeGovernmentId(idNumber);
    if (!normalized || normalized.length < 4) {
      return res.status(400).json({error: "Government identity number must be at least 4 characters."});
    }

    const identityHash = generateIdentityHash(idNumber);

    // Transaction-safe identity uniqueness check on identityRegistry/{identityHash}
    const registryRef = db.collection("identityRegistry").doc(identityHash);
    const userRef = db.collection("users").doc(uid);

    let isDuplicate = false;
    let registeredUid = null;

    await db.runTransaction(async (transaction) => {
      const regDoc = await transaction.get(registryRef);

      if (regDoc.exists) {
        const existingData = regDoc.data();
        if (existingData.uid && existingData.uid !== uid) {
          isDuplicate = true;
          registeredUid = existingData.uid;
          return;
        }
      }

      // Record in registry
      transaction.set(registryRef, {
        uid,
        identityHash,
        idType: idType || "Citizen Government ID",
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});

      // Update user document
      transaction.set(userRef, {
        identityVerificationStatus: "pending",
        identityHash,
        idType: idType || "Citizen Government ID",
        idDocumentUrl: idDocumentUrl || null,
        identitySubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    });

    if (isDuplicate) {
      return res.status(409).json({
        error: "This identity is already associated with a CivicPulse account. Please sign in using your existing account.",
        isDuplicate: true,
      });
    }

    return res.json({
      success: true,
      status: "pending",
      message: "Identity verification document submitted successfully. Pending admin review.",
    });
  } catch (err) {
    console.error("[IDENTITY VERIFICATION ERROR]", err);
    return res.status(500).json({error: err.message || "Failed to process identity verification."});
  }
});

// Group matching helper endpoint for frontend / backend deduplication
server.post("/api/issues/find-group", async (req, res) => {
  try {
    const {latitude, longitude, category, maxRadiusMeters} = req.body;
    const radius = Number(maxRadiusMeters) || DEFAULT_GROUP_RADIUS_METERS;

    if (latitude === undefined || longitude === undefined || !category) {
      return res.status(400).json({error: "Missing latitude, longitude, or category."});
    }

    // Query active non-resolved issues from Firestore
    const snapshot = await db.collection("issues")
        .where("status", "in", ["Pending", "In Progress", "pending", "in progress"])
        .get();

    const activeIssues = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const match = findMatchingGroup(activeIssues, {
      latitude: Number(latitude),
      longitude: Number(longitude),
      category: String(category),
    }, radius);

    return res.json({
      matched: Boolean(match),
      matchedGroup: match || null,
      radiusMeters: radius,
    });
  } catch (err) {
    console.error("[GROUP FIND ERROR]", err);
    return res.status(500).json({error: err.message || "Failed to search for duplicate group."});
  }
});

// 5. Start Server
const PORT = process.env.PORT || 8080;
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`[SERVER] CivicPulse AI Backend listening on port ${PORT}`);
    startFirestoreListener();
  });
}

module.exports = {
  server,
  processIssue,
  initFirebaseAdmin,
  translateTextWithGemini,
  findMatchingGroup,
  calculateDistanceMeters,
  generateIdentityHash,
  normalizeGovernmentId,
};
