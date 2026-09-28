"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { validateOfficerCreationPermissions } = require("./server");

describe("CivicPulse Role Hierarchy Officer Creation Tests", () => {
  const superAdminCaller = {
    uid: "super-1",
    role: "super_admin",
  };

  const stateAdminCallerMaharashtra = {
    uid: "state-admin-mh",
    role: "state_admin",
    stateId: "maharashtra",
    stateName: "Maharashtra",
  };

  const districtOfficerCallerPune = {
    uid: "dist-officer-pune",
    role: "district_officer",
    stateId: "maharashtra",
    districtId: "pune",
    districtName: "Pune",
  };

  const talukaOfficerCallerHaveli = {
    uid: "taluka-officer-haveli",
    role: "taluka_officer",
    stateId: "maharashtra",
    districtId: "pune",
    talukaId: "haveli",
  };

  const citizenCaller = {
    uid: "citizen-1",
    role: "citizen",
  };

  it("Super Admin can create State Admin in any state", () => {
    const result = validateOfficerCreationPermissions(superAdminCaller, {
      role: "state_admin",
      stateName: "Karnataka",
      stateId: "karnataka",
    });
    assert.strictEqual(result.allowed, true);
  });

  it("Super Admin cannot directly create District Officer (hierarchy violation)", () => {
    const result = validateOfficerCreationPermissions(superAdminCaller, {
      role: "district_officer",
      stateName: "Maharashtra",
      districtName: "Pune",
    });
    assert.strictEqual(result.allowed, false);
    assert.match(result.error, /State Admins/i);
  });

  it("State Admin can create District Officer in their own state", () => {
    const result = validateOfficerCreationPermissions(stateAdminCallerMaharashtra, {
      role: "district_officer",
      stateName: "Maharashtra",
      stateId: "maharashtra",
      districtName: "Nagpur",
      districtId: "nagpur",
    });
    assert.strictEqual(result.allowed, true);
  });

  it("State Admin cannot create District Officer in another state", () => {
    const result = validateOfficerCreationPermissions(stateAdminCallerMaharashtra, {
      role: "district_officer",
      stateName: "Gujarat",
      stateId: "gujarat",
      districtName: "Surat",
      districtId: "surat",
    });
    assert.strictEqual(result.allowed, false);
    assert.match(result.error, /own state/i);
  });

  it("State Admin cannot create Taluka Officer directly (hierarchy violation)", () => {
    const result = validateOfficerCreationPermissions(stateAdminCallerMaharashtra, {
      role: "taluka_officer",
      stateName: "Maharashtra",
      districtName: "Pune",
      talukaName: "Haveli",
    });
    assert.strictEqual(result.allowed, false);
    assert.match(result.error, /District Officers/i);
  });

  it("District Officer can create Taluka Officer in their own district", () => {
    const result = validateOfficerCreationPermissions(districtOfficerCallerPune, {
      role: "taluka_officer",
      stateName: "Maharashtra",
      districtName: "Pune",
      districtId: "pune",
      talukaName: "Haveli",
      talukaId: "haveli",
    });
    assert.strictEqual(result.allowed, true);
  });

  it("District Officer cannot create Taluka Officer in another district", () => {
    const result = validateOfficerCreationPermissions(districtOfficerCallerPune, {
      role: "taluka_officer",
      stateName: "Maharashtra",
      districtName: "Thane",
      districtId: "thane",
      talukaName: "Kalyan",
    });
    assert.strictEqual(result.allowed, false);
    assert.match(result.error, /own district/i);
  });

  it("Taluka Officer cannot create any officers", () => {
    const result = validateOfficerCreationPermissions(talukaOfficerCallerHaveli, {
      role: "taluka_officer",
      talukaName: "Haveli",
    });
    assert.strictEqual(result.allowed, false);
    assert.match(result.error, /not have administrative authority/i);
  });

  it("Citizen cannot create any officers", () => {
    const result = validateOfficerCreationPermissions(citizenCaller, {
      role: "state_admin",
      stateName: "Maharashtra",
    });
    assert.strictEqual(result.allowed, false);
    assert.match(result.error, /not have administrative authority/i);
  });
});
