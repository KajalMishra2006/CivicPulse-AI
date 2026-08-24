"use strict";

const admin = require("firebase-admin");
const {setGlobalOptions} = require("firebase-functions");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {analyzeIssueWithGemini} = require("./gemini");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Global Cloud Functions Configuration
const REGION = "asia-south1";
setGlobalOptions({
  region: REGION,
  maxInstances: 10,
});

// Define the Gemini API Key secret for secure server-side access
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Trigger: Fires automatically whenever a new issue is created in Firestore.
 * Performs language detection, translation, category, and priority scoring.
 */
exports.onIssueCreated = onDocumentCreated(
    {
      document: "issues/{issueId}",
      region: REGION,
      secrets: [geminiApiKey],
      retry: false,
    },
    async (event) => {
      const snap = event.data;
      if (!snap) {
        logger.warn("onIssueCreated: No snapshot data found.");
        return;
      }

      const issueId = event.params.issueId;
      const issueData = snap.data();

      // Idempotency check: Skip if already processed
      if (issueData.aiProcessedAt || issueData.aiStatus === "COMPLETED") {
        logger.info(`onIssueCreated: Issue ${issueId} already processed.`);
        return;
      }

      logger.info(`onIssueCreated: Starting AI analysis for ${issueId}`, {
        title: issueData.title,
        category: issueData.category,
      });

      const issueRef = db.collection("issues").doc(issueId);
      const effectiveApiKey = geminiApiKey.value() ||
        process.env.GEMINI_API_KEY;

      try {
        const aiResult = await analyzeIssueWithGemini(
            issueData,
            effectiveApiKey,
        );

        logger.info(`onIssueCreated: AI analysis succeeded for ${issueId}`, {
          priority: aiResult.priority,
          score: aiResult.priorityScore,
          category: aiResult.category,
          language: aiResult.language,
        });

        // Update issue with AI fields while preserving original inputs
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

        logger.info(`onIssueCreated: Doc ${issueId} updated with AI result.`);
      } catch (err) {
        logger.error(`onIssueCreated: AI failed for issue ${issueId}`, {
          error: err.message,
          stack: err.stack,
        });

        // Record failure gracefully without corrupting original issue
        await issueRef.update({
          aiStatus: "FAILED",
          aiError: err.message || "Unknown error during AI analysis",
          aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch((updateErr) => {
          logger.error(
              `onIssueCreated: Failed to record failure for ${issueId}`,
              updateErr,
          );
        });
      }
    },
);

/**
 * Callable Function: Test or on-demand trigger to classify an issue payload.
 * Useful for local testing and debugging with the Firebase Emulator.
 */
exports.classifyCivicIssue = onCall(
    {
      region: REGION,
      secrets: [geminiApiKey],
    },
    async (request) => {
      const issueData = request.data || {};
      if (!issueData.title && !issueData.description) {
        throw new HttpsError(
            "invalid-argument",
            "Either title or description is required for classification.",
        );
      }

      const effectiveApiKey = geminiApiKey.value() ||
        process.env.GEMINI_API_KEY;

      try {
        const result = await analyzeIssueWithGemini(
            issueData,
            effectiveApiKey,
        );
        return {
          success: true,
          data: result,
        };
      } catch (err) {
        logger.error("classifyCivicIssue: Error during classification", err);
        throw new HttpsError(
            "internal",
            err.message || "Failed to classify issue",
        );
      }
    },
);
