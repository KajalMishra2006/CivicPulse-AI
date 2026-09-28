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
const {
  normalizeEmail,
  normalizeGovernmentId,
  normalizePhoneNumber,
  generateIdentityHash,
  generatePhoneHash,
  maskGovernmentId,
  maskPhoneNumber,
} = require("./identity");

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

// Secure Citizen Identity Uniqueness Validation Endpoint
server.post("/api/citizen/check-uniqueness", async (req, res) => {
  try {
    const {email, phone, mobileNumber, governmentId, idNumber, uid} = req.body;
    const rawEmail = email;
    const rawPhone = phone || mobileNumber;
    const rawId = governmentId || idNumber;

    if (!rawEmail || typeof rawEmail !== "string" || !rawEmail.trim()) {
      return res.status(400).json({error: "Email address is required.", field: "email"});
    }
    if (!rawPhone || !rawPhone.toString().trim()) {
      return res.status(400).json({error: "Phone number is required.", field: "phone"});
    }
    if (!rawId || !rawId.toString().trim()) {
      return res.status(400).json({error: "Government ID card number is required.", field: "governmentId"});
    }

    const normEmail = normalizeEmail(rawEmail);
    const normPhone = normalizePhoneNumber(rawPhone);
    const normId = normalizeGovernmentId(rawId);

    if (normPhone.length < 7) {
      return res.status(400).json({error: "Please enter a valid phone number (at least 7 digits).", field: "phone"});
    }
    if (normId.length < 4) {
      return res.status(400).json({error: "Government ID card number must be at least 4 characters.", field: "governmentId"});
    }

    const idHash = generateIdentityHash(rawId);
    const phoneHash = generatePhoneHash(rawPhone);

    // 1. Check Email Uniqueness in users collection
    const emailQuery = await db.collection("users").where("email", "==", normEmail).get();
    for (const docSnap of emailQuery.docs) {
      if (docSnap.id !== uid) {
        return res.status(409).json({
          error: "This email address is already registered. Please sign in instead.",
          field: "email",
          isDuplicate: true,
        });
      }
    }

    // 2. Check Phone Uniqueness in identityRegistry & users collection
    const phoneRegDoc = await db.collection("identityRegistry").doc(`phone_${phoneHash}`).get();
    if (phoneRegDoc.exists) {
      const regData = phoneRegDoc.data();
      if (regData.uid && regData.uid !== uid) {
        return res.status(409).json({
          error: "This phone number is already registered with another account.",
          field: "phone",
          isDuplicate: true,
        });
      }
    }
    const phoneUserQuery = await db.collection("users").where("phoneHash", "==", phoneHash).get();
    for (const docSnap of phoneUserQuery.docs) {
      if (docSnap.id !== uid) {
        return res.status(409).json({
          error: "This phone number is already registered with another account.",
          field: "phone",
          isDuplicate: true,
        });
      }
    }
    const rawPhoneUserQuery = await db.collection("users").where("mobileNumber", "==", normPhone).get();
    for (const docSnap of rawPhoneUserQuery.docs) {
      if (docSnap.id !== uid) {
        return res.status(409).json({
          error: "This phone number is already registered with another account.",
          field: "phone",
          isDuplicate: true,
        });
      }
    }

    // 3. Check Government ID Uniqueness in identityRegistry & users collection
    const idRegDoc = await db.collection("identityRegistry").doc(idHash).get();
    if (idRegDoc.exists) {
      const regData = idRegDoc.data();
      if (regData.uid && regData.uid !== uid) {
        return res.status(409).json({
          error: "This Government ID card number is already registered with another account.",
          field: "governmentId",
          isDuplicate: true,
        });
      }
    }
    const idUserQuery = await db.collection("users").where("identityHash", "==", idHash).get();
    for (const docSnap of idUserQuery.docs) {
      if (docSnap.id !== uid) {
        return res.status(409).json({
          error: "This Government ID card number is already registered with another account.",
          field: "governmentId",
          isDuplicate: true,
        });
      }
    }

    return res.json({
      valid: true,
      normalizedEmail: normEmail,
      normalizedPhone: normPhone,
      normalizedId: normId,
      identityHash: idHash,
      phoneHash: phoneHash,
      maskedId: maskGovernmentId(rawId),
      maskedPhone: maskPhoneNumber(rawPhone),
    });
  } catch (err) {
    console.error("[CHECK UNIQUENESS ERROR]", err);
    return res.status(500).json({error: err.message || "Failed to validate identity uniqueness."});
  }
});

// Secure Citizen Identity Registration Endpoint (Reserves hashes in identityRegistry)
server.post("/api/citizen/register-identity", async (req, res) => {
  try {
    const {uid, email, mobileNumber, phone, idNumber, governmentId} = req.body;
    if (!uid || typeof uid !== "string") {
      return res.status(400).json({error: "Missing or invalid 'uid'."});
    }
    const rawEmail = email;
    const rawPhone = phone || mobileNumber;
    const rawId = governmentId || idNumber;

    if (!rawEmail || !rawPhone || !rawId) {
      return res.status(400).json({error: "Email, phone number, and government ID are all required."});
    }

    const normEmail = normalizeEmail(rawEmail);
    const normPhone = normalizePhoneNumber(rawPhone);
    const normId = normalizeGovernmentId(rawId);

    const idHash = generateIdentityHash(rawId);
    const phoneHash = generatePhoneHash(rawPhone);
    const maskedId = maskGovernmentId(rawId);
    const maskedPhone = maskPhoneNumber(rawPhone);

    const idRegistryRef = db.collection("identityRegistry").doc(idHash);
    const phoneRegistryRef = db.collection("identityRegistry").doc(`phone_${phoneHash}`);
    const userRef = db.collection("users").doc(uid);

    let isDuplicate = false;
    let duplicateField = null;

    await db.runTransaction(async (transaction) => {
      const [idDoc, phoneDoc] = await Promise.all([
        transaction.get(idRegistryRef),
        transaction.get(phoneRegistryRef),
      ]);

      if (idDoc.exists && idDoc.data().uid && idDoc.data().uid !== uid) {
        isDuplicate = true;
        duplicateField = "governmentId";
        return;
      }
      if (phoneDoc.exists && phoneDoc.data().uid && phoneDoc.data().uid !== uid) {
        isDuplicate = true;
        duplicateField = "phone";
        return;
      }

      transaction.set(idRegistryRef, {
        uid,
        identityHash: idHash,
        type: "government_id",
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});

      transaction.set(phoneRegistryRef, {
        uid,
        phoneHash,
        type: "phone",
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});

      transaction.set(userRef, {
        identityHash: idHash,
        phoneHash: phoneHash,
        maskedIdNumber: maskedId,
        maskedPhone: maskedPhone,
        accountStatus: "active",
        verified: true,
        identityVerificationStatus: "verified",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    });

    if (isDuplicate) {
      return res.status(409).json({
        error: duplicateField === "phone" ?
          "This phone number is already registered with another account." :
          "This Government ID card number is already registered with another account.",
        field: duplicateField,
        isDuplicate: true,
      });
    }

    return res.json({
      success: true,
      message: "Citizen identity verified and registered successfully.",
      maskedId,
      maskedPhone,
    });
  } catch (err) {
    console.error("[REGISTER IDENTITY ERROR]", err);
    return res.status(500).json({error: err.message || "Failed to register citizen identity."});
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

/**
 * Validates officer creation permissions based on the strict 5-tier role hierarchy:
 * - Super Admin can create State Admin in any state.
 * - State Admin can create District Officer ONLY in their state.
 * - District Officer can create Taluka Officer ONLY in their district.
 * - Taluka Officer, Citizen, or others CANNOT create any officers.
 */
function validateOfficerCreationPermissions(caller, newOfficerData) {
  if (!caller || !caller.role) {
    return { allowed: false, error: "Caller authentication and role are required." };
  }

  const callerRole = String(caller.role).toLowerCase();
  const targetRole = String(newOfficerData.role || "").toLowerCase();

  const allowedRoles = ["state_admin", "district_officer", "taluka_officer"];
  if (!allowedRoles.includes(targetRole)) {
    return {
      allowed: false,
      error: `Invalid target role '${targetRole}'. Allowed roles: ${allowedRoles.join(", ")}.`
    };
  }

  // 1. Super Admin
  if (callerRole === "super_admin" || callerRole === "admin") {
    if (targetRole !== "state_admin") {
      return {
        allowed: false,
        error: "Super Admin can directly create only State Admins according to the hierarchy."
      };
    }
    if (!newOfficerData.stateId && !newOfficerData.stateName && !newOfficerData.state) {
      return { allowed: false, error: "State is required for State Admin appointment." };
    }
    return { allowed: true };
  }

  // 2. State Admin
  if (callerRole === "state_admin") {
    if (targetRole !== "district_officer") {
      return {
        allowed: false,
        error: "State Admin can directly create only District Officers within their state."
      };
    }
    const callerState = String(caller.stateId || caller.stateName || caller.state || "").toLowerCase().replace(/[\s_-]/g, "");
    const targetState = String(newOfficerData.stateId || newOfficerData.stateName || newOfficerData.state || "").toLowerCase().replace(/[\s_-]/g, "");
    if (!callerState || !targetState || callerState !== targetState) {
      return {
        allowed: false,
        error: `State Admin can only create District Officers within their own state (${caller.stateName || caller.state || callerState}).`
      };
    }
    if (!newOfficerData.districtId && !newOfficerData.districtName && !newOfficerData.district) {
      return { allowed: false, error: "District is required for District Officer appointment." };
    }
    return { allowed: true };
  }

  // 3. District Officer (including legacy district_admin)
  if (callerRole === "district_officer" || callerRole === "district_admin") {
    if (targetRole !== "taluka_officer") {
      return {
        allowed: false,
        error: "District Officer can directly create only Taluka Officers within their district."
      };
    }
    const callerDist = String(caller.districtId || caller.districtName || caller.district || "").toLowerCase().replace(/[\s_-]/g, "");
    const targetDist = String(newOfficerData.districtId || newOfficerData.districtName || newOfficerData.district || "").toLowerCase().replace(/[\s_-]/g, "");
    if (!callerDist || !targetDist || callerDist !== targetDist) {
      return {
        allowed: false,
        error: `District Officer can only create Taluka Officers within their own district (${caller.districtName || caller.district || callerDist}).`
      };
    }
    if (!newOfficerData.talukaId && !newOfficerData.talukaName && !newOfficerData.taluka) {
      return { allowed: false, error: "Taluka is required for Taluka Officer appointment." };
    }
    return { allowed: true };
  }

  // 4. Taluka Officer, Citizen, etc.
  return {
    allowed: false,
    error: `Role '${callerRole}' does not have administrative authority to create government officers.`
  };
}

// 5. Direct Hierarchical Officer Provisioning Endpoint
server.post("/api/officers/create", async (req, res) => {
  try {
    const {
      callerUid,
      email,
      password,
      name,
      role,
      stateId,
      stateName,
      state,
      districtId,
      districtName,
      district,
      talukaId,
      talukaName,
      taluka,
      department,
      designation,
      employeeId,
      mobileNumber
    } = req.body;

    if (!callerUid) {
      return res.status(401).json({ error: "Missing caller UID." });
    }
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: "Missing required officer fields: email, password, name, role." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    // Lookup caller in Firestore
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (!callerDoc.exists) {
      return res.status(403).json({ error: "Caller profile does not exist." });
    }
    const caller = callerDoc.data();

    const permCheck = validateOfficerCreationPermissions(caller, {
      role,
      stateId: stateId || state,
      stateName: stateName || state,
      state: stateName || state,
      districtId: districtId || district,
      districtName: districtName || district,
      district: districtName || district,
      talukaId: talukaId || taluka,
      talukaName: talukaName || taluka,
      taluka: talukaName || taluka,
    });

    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }

    const normEmail = normalizeEmail(email);
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: normEmail,
        password,
        displayName: name.trim(),
      });
    } catch (authErr) {
      if (authErr.code === "auth/email-already-in-use") {
        userRecord = await admin.auth().getUserByEmail(normEmail);
      } else {
        throw authErr;
      }
    }

    const newUid = userRecord.uid;
    const targetState = stateName || state || "";
    const targetDistrict = role === "state_admin" ? null : (districtName || district || null);
    const targetTaluka = role === "taluka_officer" ? (talukaName || taluka || null) : null;

    const officerDocData = {
      uid: newUid,
      email: normEmail,
      name: name.trim(),
      role,
      accountStatus: "active",
      verified: true,
      stateId: stateId || (targetState ? targetState.toLowerCase().replace(/\s+/g, "_") : ""),
      stateName: targetState,
      state: targetState,
      districtId: targetDistrict ? (districtId || targetDistrict.toLowerCase().replace(/\s+/g, "_")) : null,
      districtName: targetDistrict,
      district: targetDistrict,
      talukaId: targetTaluka ? (talukaId || targetTaluka.toLowerCase().replace(/\s+/g, "_")) : null,
      talukaName: targetTaluka,
      taluka: targetTaluka,
      department: (department || "").trim(),
      designation: (designation || "").trim(),
      employeeId: (employeeId || "").trim(),
      mobileNumber: mobileNumber || "",
      createdBy: callerUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(newUid).set(officerDocData, { merge: true });

    return res.json({
      success: true,
      message: `Successfully created officer ${name} (${role}).`,
      officer: {
        uid: newUid,
        email: normEmail,
        name: name.trim(),
        role,
        state: targetState,
        district: targetDistrict,
        taluka: targetTaluka,
      }
    });
  } catch (err) {
    console.error("[OFFICER CREATE ERROR]", err);
    return res.status(500).json({ error: err.message || "Failed to create officer." });
  }
});

// 6. Start Server
const PORT = process.env.PORT || 8080;
if (require.main === module && process.env.NODE_ENV !== "test") {
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
  generatePhoneHash,
  normalizeGovernmentId,
  normalizePhoneNumber,
  normalizeEmail,
  maskGovernmentId,
  maskPhoneNumber,
  validateOfficerCreationPermissions,
};
