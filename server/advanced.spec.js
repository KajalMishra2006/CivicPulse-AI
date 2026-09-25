"use strict";

const {describe, it} = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateDistanceMeters,
  findMatchingGroup,
  isMatchingCategory,
} = require("./grouping");
const {
  generateIdentityHash,
  normalizeGovernmentId,
} = require("./identity");

describe("CivicPulse Advanced Feature Unit Tests", () => {
  describe("Geographic Distance & Issue Deduplication", () => {
    it("should calculate 0 meters for identical GPS coordinates", () => {
      const dist = calculateDistanceMeters(18.9894, 73.1175, 18.9894, 73.1175);
      assert.equal(Math.round(dist), 0);
    });

    it("should calculate approximately ~15-20 meters for very close nearby coordinates", () => {
      // 0.0001 deg difference is approx ~11 meters
      const dist = calculateDistanceMeters(18.9894, 73.1175, 18.9895, 73.1176);
      assert.ok(dist > 0 && dist < 30, `Expected distance < 30m, got ${dist}`);
    });

    it("should group issues with same category within 100m tolerance", () => {
      const existing = [
        {
          id: "GROUP_1",
          title: "Large pothole on main road",
          category: "Roads",
          latitude: 18.9894,
          longitude: 73.1175,
          status: "Pending",
        },
      ];

      const newReport = {
        title: "Dangerous crater here",
        category: "Roads",
        latitude: 18.9896,
        longitude: 73.1177,
      };

      const match = findMatchingGroup(existing, newReport, 100);
      assert.ok(match !== null, "Should have matched group");
      assert.equal(match.id, "GROUP_1");
    });

    it("should NOT group issues with different categories even if at exact same location", () => {
      const existing = [
        {
          id: "GROUP_1",
          title: "Large pothole on main road",
          category: "Roads",
          latitude: 18.9894,
          longitude: 73.1175,
          status: "Pending",
        },
      ];

      const newReport = {
        title: "Broken streetlight not glowing",
        category: "Streetlight",
        latitude: 18.9894,
        longitude: 73.1175,
      };

      const match = findMatchingGroup(existing, newReport, 100);
      assert.equal(match, null, "Different category should not match");
    });

    it("should NOT group issues if distance exceeds 100 meters", () => {
      const existing = [
        {
          id: "GROUP_1",
          title: "Pothole in Ward 4",
          category: "Roads",
          latitude: 18.9894,
          longitude: 73.1175,
          status: "Pending",
        },
      ];

      // Point ~2 km away
      const newReport = {
        title: "Another pothole in Ward 12",
        category: "Roads",
        latitude: 19.0100,
        longitude: 73.1300,
      };

      const match = findMatchingGroup(existing, newReport, 100);
      assert.equal(match, null, "Distant issues should not match");
    });

    it("should NOT group with already resolved issues", () => {
      const existing = [
        {
          id: "GROUP_OLD",
          title: "Fixed pothole",
          category: "Roads",
          latitude: 18.9894,
          longitude: 73.1175,
          status: "Resolved",
        },
      ];

      const newReport = {
        title: "New pothole formed",
        category: "Roads",
        latitude: 18.9894,
        longitude: 73.1175,
      };

      const match = findMatchingGroup(existing, newReport, 100);
      assert.equal(match, null, "Resolved group should not match new complaints");
    });
  });

  describe("Citizen Identity Normalization & HMAC-SHA256 Hashing", () => {
    it("should normalize ID by stripping spaces, hyphens, and standardizing case", () => {
      const raw1 = "  abc-1234 5678  ";
      const raw2 = "ABC12345678";
      assert.equal(normalizeGovernmentId(raw1), "ABC12345678");
      assert.equal(normalizeGovernmentId(raw2), "ABC12345678");
    });

    it("should generate identical HMAC-SHA256 hash for equivalent government IDs", () => {
      const secret = "test-secret-salt-2026";
      const hash1 = generateIdentityHash("ABC-9876-5432", secret);
      const hash2 = generateIdentityHash("  abc 9876 5432 ", secret);
      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);
    });

    it("should generate distinct hashes for different government IDs", () => {
      const secret = "test-secret-salt-2026";
      const hash1 = generateIdentityHash("ID-AAAA-1111", secret);
      const hash2 = generateIdentityHash("ID-BBBB-2222", secret);
      assert.notEqual(hash1, hash2);
    });
  });

  describe("Priority Sorting & Status Separation", () => {
    it("should sort issues by score DESC, and timestamp DESC for tie-breakers", () => {
      const list = [
        {id: "A", priorityScore: 65, createdAt: 1000},
        {id: "B", priorityScore: 82, createdAt: 2000},
        {id: "C", priorityScore: 82, createdAt: 3000}, // same score, newer
        {id: "D", priorityScore: 30, createdAt: 4000},
      ];

      const sorted = [...list].sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        return b.createdAt - a.createdAt;
      });

      assert.deepEqual(
          sorted.map((s) => s.id),
          ["C", "B", "A", "D"],
      );
    });
  });
});
