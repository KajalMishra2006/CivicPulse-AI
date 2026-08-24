"use strict";

require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const admin = require("firebase-admin");
const {analyzeIssueWithGemini} = require("./gemini");

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
server.use(express.json());

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
  if (issueData.aiProcessedAt ||
      issueData.aiStatus === "COMPLETED" ||
      inFlightProcessing.has(issueId)) {
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
};
