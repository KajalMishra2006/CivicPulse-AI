"use strict";

const crypto = require("node:crypto");

/**
 * Normalizes an email address string (trimmed and lowercased).
 * @param {string} rawEmail
 * @return {string}
 */
function normalizeEmail(rawEmail) {
  if (!rawEmail || typeof rawEmail !== "string") return "";
  return rawEmail.trim().toLowerCase();
}

/**
 * Normalizes a citizen government ID string (strips whitespace, dashes, underscores, and standardizes casing).
 * @param {string} rawId The raw user-supplied ID number.
 * @return {string} Standardized ID string.
 */
function normalizeGovernmentId(rawId) {
  if (!rawId || typeof rawId !== "string") return "";
  return rawId.trim().toUpperCase().replace(/[\s\-_]/g, "");
}

/**
 * Normalizes a citizen phone number (strips non-digits, preserves leading '+' if international).
 * @param {string} rawPhone
 * @return {string} Normalized phone digits string.
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string") return "";
  const trimmed = rawPhone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
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

/**
 * Generates a secure HMAC-SHA256 hash of a normalized phone number.
 * @param {string} rawPhone Raw phone number string.
 * @param {string} secret Server-side secret key.
 * @return {string} 64-character hex hash.
 */
function generatePhoneHash(rawPhone, secret = process.env.IDENTITY_SECRET || "civicpulse-secure-salt-2026") {
  const normalized = normalizePhoneNumber(rawPhone);
  if (!normalized) {
    throw new Error("Invalid or empty phone number provided.");
  }
  return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
}

/**
 * Masks a government ID for privacy (e.g. "ABC12345678" -> "XXXXXX5678" or "XXXXXX1234").
 * Shows only the last 4 characters.
 * @param {string} rawId
 * @return {string} Masked string.
 */
function maskGovernmentId(rawId) {
  const normalized = normalizeGovernmentId(rawId);
  if (!normalized) return "XXXXXX0000";
  if (normalized.length <= 4) {
    return "XXXX" + normalized;
  }
  const last4 = normalized.slice(-4);
  return "XXXXXX" + last4;
}

/**
 * Masks a phone number for privacy (e.g. "9876543210" -> "******3210").
 * Shows only the last 4 digits.
 * @param {string} rawPhone
 * @return {string} Masked string.
 */
function maskPhoneNumber(rawPhone) {
  const digits = (rawPhone || "").toString().replace(/\D/g, "");
  if (!digits) return "******0000";
  if (digits.length <= 4) {
    return "******" + digits;
  }
  const last4 = digits.slice(-4);
  return "******" + last4;
}

module.exports = {
  normalizeEmail,
  normalizeGovernmentId,
  normalizePhoneNumber,
  generateIdentityHash,
  generatePhoneHash,
  maskGovernmentId,
  maskPhoneNumber,
};
