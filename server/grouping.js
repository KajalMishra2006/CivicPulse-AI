"use strict";

/**
 * CivicPulse Issue Deduplication & Grouping Module
 * Groups civic reports within a configurable geographic radius (default 100m)
 * sharing the same category and semantic context.
 */

const DEFAULT_GROUP_RADIUS_METERS = 100;

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 * @param {number} lat1 Latitude of point 1.
 * @param {number} lon1 Longitude of point 1.
 * @param {number} lat2 Latitude of point 2.
 * @param {number} lon2 Longitude of point 2.
 * @return {number} Distance in meters, or Infinity if coordinates are invalid.
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null || lat1 === undefined || isNaN(Number(lat1)) ||
    lon1 === null || lon1 === undefined || isNaN(Number(lon1)) ||
    lat2 === null || lat2 === undefined || isNaN(Number(lat2)) ||
    lon2 === null || lon2 === undefined || isNaN(Number(lon2))
  ) {
    return Infinity;
  }

  const R = 6371e3; // Earth radius in meters
  const phi1 = (Number(lat1) * Math.PI) / 180;
  const phi2 = (Number(lat2) * Math.PI) / 180;
  const deltaPhi = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const deltaLambda = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if two civic issues represent the same problem category.
 * @param {string} categoryA Category of first issue.
 * @param {string} categoryB Category of second issue.
 * @return {boolean} True if categories match.
 */
function isMatchingCategory(categoryA, categoryB) {
  if (!categoryA || !categoryB) return false;
  const catA = String(categoryA).trim().toLowerCase();
  const catB = String(categoryB).trim().toLowerCase();
  return catA === catB;
}

/**
 * Searches an array of existing issues for an active matching group.
 * @param {Array<object>} existingIssues Active issue groups from Firestore.
 * @param {object} newIssue The newly submitted issue object.
 * @param {number} maxRadiusMeters Geographic tolerance threshold (default: 100m).
 * @return {object|null} Matching group object or null if none found.
 */
function findMatchingGroup(existingIssues = [], newIssue = {}, maxRadiusMeters = DEFAULT_GROUP_RADIUS_METERS) {
  if (!newIssue || !Array.isArray(existingIssues) || existingIssues.length === 0) {
    return null;
  }

  const newLat = newIssue.latitude;
  const newLng = newIssue.longitude;
  const newCategory = newIssue.category;

  if (newLat === null || newLat === undefined || newLng === null || newLng === undefined) {
    return null; // Cannot group geographically without coordinates
  }

  let closestMatch = null;
  let minDistance = Infinity;

  for (const group of existingIssues) {
    // Only group with active issues (do not group with resolved or rejected issues)
    const status = String(group.status || "Pending").toLowerCase();
    if (status === "resolved" || status === "rejected") {
      continue;
    }

    // Must match category
    if (!isMatchingCategory(group.category, newCategory)) {
      continue;
    }

    const dist = calculateDistanceMeters(newLat, newLng, group.latitude, group.longitude);
    if (dist <= maxRadiusMeters && dist < minDistance) {
      minDistance = dist;
      closestMatch = {
        ...group,
        matchDistanceMeters: Math.round(dist),
      };
    }
  }

  return closestMatch;
}

module.exports = {
  calculateDistanceMeters,
  isMatchingCategory,
  findMatchingGroup,
  DEFAULT_GROUP_RADIUS_METERS,
};
