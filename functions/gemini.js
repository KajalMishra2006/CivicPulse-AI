"use strict";

const {GoogleGenAI} = require("@google/genai");

const ALLOWED_CATEGORIES = [
  "Roads",
  "Garbage",
  "Streetlight",
  "Water",
  "Drainage",
  "Electricity",
  "Other",
];

const ALLOWED_PRIORITIES = ["HIGH", "MEDIUM", "LOW"];

/**
 * Prompt instruction for Gemini to classify civic issues independently.
 */
const SYSTEM_INSTRUCTION = [
  "You are the CivicPulse-AI civic intelligence engine.",
  "Your role is to analyze civic complaints submitted by citizens.",
  "",
  "Tasks:",
  "1. Detect the original language of the submission.",
  "2. Translate/normalize title and description into clear English.",
  "3. Categorize into ONE of: Roads, Garbage, Streetlight, Water, " +
     "Drainage, Electricity, Other.",
  "4. Determine priority independently based solely on the real-world " +
     "danger, urgency, and severity described in the title and description:",
  "   - HIGH (Score 80-100): Immediate threat to life or serious safety, " +
     "gas leaks, live electrical wires, sparking, sinkholes, open manholes, " +
     "severe flooding threatening life/property, collapsing structures.",
  "   - MEDIUM (Score 50-79): Damaged infrastructure, broken streetlights, " +
     "garbage overflow, blocked drains, routine maintenance without hazard.",
  "   - LOW (Score 10-49): Minor cosmetic damage, graffiti, bench repair, " +
     "minor park maintenance, non-urgent noise.",
  "5. Ensure the priorityScore strictly matches the priority tier:",
  "   - HIGH: score must be between 80 and 100",
  "   - MEDIUM: score must be between 50 and 79",
  "   - LOW: score must be between 10 and 49",
  "6. Provide a 1-2 sentence justification for the assigned priority.",
  "",
  "Return a JSON object with this exact schema:",
  "{",
  "  \"language\": \"Detected language name\",",
  "  \"translatedText\": \"English translation of title and description\",",
  "  \"category\": \"Category name\",",
  "  \"priority\": \"HIGH | MEDIUM | LOW\",",
  "  \"priorityScore\": Integer matching the priority tier range,",
  "  \"reason\": \"Justification sentence\"",
  "}",
].join("\n");

/**
 * Normalize and clamp priority score to match the priority tier.
 * HIGH: 80 - 100
 * MEDIUM: 50 - 79
 * LOW: 10 - 49
 * @param {string} priority Priority tier (HIGH, MEDIUM, LOW).
 * @param {number|undefined} rawScore Raw score from model.
 * @return {number} Normalized integer score within exact tier range.
 */
function normalizePriorityScore(priority, rawScore) {
  const hasValidScore = typeof rawScore === "number" && !isNaN(rawScore);
  const parsedScore = hasValidScore ? Math.round(rawScore) : null;

  if (priority === "HIGH") {
    if (parsedScore !== null) {
      return Math.max(80, Math.min(100, parsedScore));
    }
    return 90;
  }

  if (priority === "LOW") {
    if (parsedScore !== null) {
      return Math.max(10, Math.min(49, parsedScore));
    }
    return 30;
  }

  // Default / MEDIUM
  if (parsedScore !== null) {
    return Math.max(50, Math.min(79, parsedScore));
  }
  return 65;
}

/**
 * Validate and sanitize AI classification output.
 * @param {object} rawOutput Parsed JSON output from Gemini.
 * @param {object} fallbackData Existing issue data.
 * @return {object} Validated classification result.
 */
function validateAIOutput(rawOutput, fallbackData = {}) {
  const result = {
    language: "English",
    translatedText: "",
    category: fallbackData.category || "Other",
    priority: "MEDIUM",
    priorityScore: 65,
    reason: "Standard priority evaluation applied.",
  };

  if (!rawOutput || typeof rawOutput !== "object") {
    return result;
  }

  // 1. Language
  if (typeof rawOutput.language === "string" && rawOutput.language.trim()) {
    result.language = rawOutput.language.trim();
  }

  // 2. Translated Text
  if (typeof rawOutput.translatedText === "string" &&
      rawOutput.translatedText.trim()) {
    result.translatedText = rawOutput.translatedText.trim();
  } else {
    result.translatedText = fallbackData.description ||
      fallbackData.title || "";
  }

  // 3. Category Validation
  if (typeof rawOutput.category === "string") {
    const matchedCategory = ALLOWED_CATEGORIES.find(
        (c) => c.toLowerCase() === rawOutput.category.trim().toLowerCase(),
    );
    if (matchedCategory) {
      result.category = matchedCategory;
    }
  }

  // 4. Priority Validation
  if (typeof rawOutput.priority === "string") {
    const matchedPriority = ALLOWED_PRIORITIES.find(
        (p) => p === rawOutput.priority.trim().toUpperCase(),
    );
    if (matchedPriority) {
      result.priority = matchedPriority;
    }
  }

  // 5. Priority Score Normalization & Consistency
  result.priorityScore = normalizePriorityScore(
      result.priority,
      rawOutput.priorityScore,
  );

  // 6. Reason
  if (typeof rawOutput.reason === "string" && rawOutput.reason.trim()) {
    result.reason = rawOutput.reason.trim();
  }

  return result;
}

/**
 * Analyze an issue using Gemini AI independently of any pre-existing priority.
 * @param {object} issueData Issue document data.
 * @param {string} apiKey Gemini API Key.
 * @return {Promise<object>} Validated classification result.
 */
async function analyzeIssueWithGemini(issueData, apiKey) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in Cloud Functions.");
  }

  const ai = new GoogleGenAI({apiKey});

  const loc = issueData.location ||
    `${issueData.localArea || ""}, ${issueData.state || ""}`;

  // Priority independence: determine priority solely from title & description
  const promptText = [
    "Analyze the following civic issue independently based strictly on " +
    "its title and description:",
    `Title: ${issueData.title || "Untitled"}`,
    `Category: ${issueData.category || "Unspecified"}`,
    `Description: ${issueData.description || "No description provided"}`,
    `Location: ${loc}`,
  ].join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: promptText,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const responseText = response.text;
  let parsedJSON;

  try {
    parsedJSON = JSON.parse(responseText);
  } catch (parseErr) {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedJSON = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error(`Failed to parse Gemini output: ${parseErr.message}`);
    }
  }

  return validateAIOutput(parsedJSON, issueData);
}

module.exports = {
  analyzeIssueWithGemini,
  validateAIOutput,
  normalizePriorityScore,
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
};
