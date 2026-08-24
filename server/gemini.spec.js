"use strict";

const {describe, it} = require("node:test");
const assert = require("node:assert");
const {
  validateAIOutput,
  normalizePriorityScore,
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
} = require("./gemini");

describe("CivicPulse Standalone Server Gemini Validation", () => {
  it("should validate and format complete HIGH priority output", () => {
    const raw = {
      language: "Marathi",
      translatedText: "There is an exposed live electrical wire on the road.",
      category: "Electricity",
      priority: "HIGH",
      priorityScore: 95,
      reason: "Exposed live wire poses immediate electrocution hazard.",
    };

    const validated = validateAIOutput(raw, {
      category: "Electricity",
      description: "Original text",
    });

    assert.strictEqual(validated.language, "Marathi");
    assert.strictEqual(
        validated.translatedText,
        "There is an exposed live electrical wire on the road.",
    );
    assert.strictEqual(validated.category, "Electricity");
    assert.strictEqual(validated.priority, "HIGH");
    assert.strictEqual(validated.priorityScore, 95);
    assert.strictEqual(
        validated.reason,
        "Exposed live wire poses immediate electrocution hazard.",
    );
  });

  it("should fallback gracefully when raw output is missing fields", () => {
    const raw = null;
    const fallback = {
      category: "Roads",
      description: "Pothole on 2nd avenue",
    };

    const validated = validateAIOutput(raw, fallback);

    assert.strictEqual(validated.language, "English");
    assert.strictEqual(validated.category, "Roads");
    assert.strictEqual(validated.priority, "MEDIUM");
    assert.strictEqual(validated.priorityScore, 65);
  });

  it("should normalize inconsistent priority and score combinations", () => {
    // HIGH priority: must be 80-100
    assert.strictEqual(normalizePriorityScore("HIGH", 30), 80);
    assert.strictEqual(normalizePriorityScore("HIGH", 120), 100);
    assert.strictEqual(normalizePriorityScore("HIGH", 85), 85);
    assert.strictEqual(normalizePriorityScore("HIGH", undefined), 90);

    // MEDIUM priority: must be 50-79
    assert.strictEqual(normalizePriorityScore("MEDIUM", 20), 50);
    assert.strictEqual(normalizePriorityScore("MEDIUM", 95), 79);
    assert.strictEqual(normalizePriorityScore("MEDIUM", 65), 65);
    assert.strictEqual(normalizePriorityScore("MEDIUM", undefined), 65);

    // LOW priority: must be 10-49
    assert.strictEqual(normalizePriorityScore("LOW", 80), 49);
    assert.strictEqual(normalizePriorityScore("LOW", 5), 10);
    assert.strictEqual(normalizePriorityScore("LOW", 35), 35);
    assert.strictEqual(normalizePriorityScore("LOW", undefined), 30);
  });

  it("should normalize mismatched priority/score combination", () => {
    const inconsistentHigh = {
      priority: "HIGH",
      priorityScore: 40,
    };
    const validatedHigh = validateAIOutput(inconsistentHigh);
    assert.strictEqual(validatedHigh.priority, "HIGH");
    assert.strictEqual(validatedHigh.priorityScore, 80);

    const inconsistentLow = {
      priority: "LOW",
      priorityScore: 95,
    };
    const validatedLow = validateAIOutput(inconsistentLow);
    assert.strictEqual(validatedLow.priority, "LOW");
    assert.strictEqual(validatedLow.priorityScore, 49);
  });

  it("should enforce allowed categories and priorities", () => {
    const raw = {
      category: "invalid_category",
      priority: "SUPER_URGENT",
    };

    const validated = validateAIOutput(raw, {category: "Water"});
    assert(ALLOWED_CATEGORIES.includes(validated.category));
    assert(ALLOWED_PRIORITIES.includes(validated.priority));
    assert.strictEqual(validated.category, "Water");
    assert.strictEqual(validated.priority, "MEDIUM");
    assert.strictEqual(validated.priorityScore, 65);
  });
});
