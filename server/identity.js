"use strict";

const crypto = require("node:crypto");

/**
 * Normalizes a citizen government ID string (strips whitespace, dashes, and casing).
 * @param {string} rawId The raw user-supplied ID number.
 * @return {string} Standardized ID string.
 */
function normalizeGovernmentId(rawId) {
  if (!rawId || typeof rawId !== "string") return "";
  return rawId.trim().toUpperCase().replace(/[\s\-_]/g, "");
}

/**
 * Generates a secure HMAC-SHA256 hash of a government identity number.
 * @param {string} rawId Raw government ID string.
 * @param {string} secret Server-side secret key.
 * @return {string} 64-character hex hash.
 */
function generateIdentityHash(rawId, secret = process.env.IDENTITY_SECRET || "civicpulse-secure-salt-2026") {
  const normalized = normalizeGovernmentId(rawId);
  if (!normalized) {
    throw new Error("Invalid or empty government ID provided.");
  }
  return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
}

module.exports = {
  normalizeGovernmentId,
  generateIdentityHash,
};
