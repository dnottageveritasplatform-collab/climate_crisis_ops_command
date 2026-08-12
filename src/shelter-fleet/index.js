/** Phase 2 Day 7 — shelter capacity + fleet logistics coordination feed. */

import { getAtRiskTrips } from "../dispatch/index.js";
import { getActiveCorridorStatus } from "../geo/esri.js";
import { loadShelterFleetFeed } from "./adapters/json.js";

export const SHELTER_FLEET_SCOPE_GUARD =
  "Shelter + fleet coordination signals — extended HITL personas; not shelter ops authority or fleet dispatch.";

let cachedFeed = null;

export function ingestShelterFleetFeed(source = "json") {
  const feed = loadShelterFleetFeed();
  cachedFeed = {
    shelters: feed.shelters || [],
    fleet: feed.fleet || [],
    shelterCount: (feed.shelters || []).length,
    fleetCount: (feed.fleet || []).length,
    source,
    ingestedAt: new Date().toISOString(),
    scopeGuard: feed.scopeGuard || SHELTER_FLEET_SCOPE_GUARD,
  };
  return cachedFeed;
}

export function getShelterFleetOverlay({ refresh = false } = {}) {
  if (!cachedFeed || refresh) ingestShelterFleetFeed("json");
  const acceptingShelters = cachedFeed.shelters.filter((s) => s.status === "accepting").length;
  const availableFleet = cachedFeed.fleet.filter((f) => f.status === "available").length;

  return {
    ok: true,
    phase: "phase-2-day-7",
    mode: "coordination",
    scopeGuard: SHELTER_FLEET_SCOPE_GUARD,
    adapter: process.env.SHELTER_FLEET_URL ? "rest" : "json",
    ...cachedFeed,
    acceptingShelters,
    availableFleetAssets: availableFleet,
    extendedHitlPersonas: ["shelter_coordinator", "fleet_logistics"],
  };
}

/** Compact status for Monitor agent tool. */
export function getShelterFleetStatus() {
  const overlay = getShelterFleetOverlay();
  const nearCapacity = overlay.shelters.filter((s) => s.status === "near_capacity");

  return {
    ok: true,
    phase: "phase-2-day-7",
    shelterCount: overlay.shelterCount,
    fleetCount: overlay.fleetCount,
    acceptingShelters: overlay.acceptingShelters,
    availableFleetAssets: overlay.availableFleetAssets,
    nearCapacityShelters: nearCapacity.map((s) => ({
      shelterId: s.shelterId,
      name: s.name,
      availableBeds: s.availableBeds,
      corridor: s.corridor,
    })),
    fleetSummary: overlay.fleet.map((f) => ({
      assetId: f.assetId,
      type: f.type,
      status: f.status,
      corridor: f.corridor,
    })),
    scopeGuard: SHELTER_FLEET_SCOPE_GUARD,
    ingestedAt: overlay.ingestedAt,
  };
}

/** Cross-reference at-risk trips with shelter capacity + fleet on restricted corridors. */
export function buildShelterFleetCrossRef(level = 2) {
  const overlay = getShelterFleetOverlay();
  const corridorStatus = getActiveCorridorStatus(level);
  const atRisk = getAtRiskTrips(level);

  const restrictedCorridors = Object.entries(corridorStatus)
    .filter(([, st]) => st !== "open")
    .map(([id]) => id);

  const shelterMatches = overlay.shelters
    .filter((s) => s.corridor && restrictedCorridors.includes(s.corridor))
    .map((s) => ({
      shelterId: s.shelterId,
      name: s.name,
      corridor: s.corridor,
      corridorStatus: corridorStatus[s.corridor],
      availableBeds: s.availableBeds,
      status: s.status,
    }));

  const fleetMatches = overlay.fleet
    .filter((f) => f.corridor && restrictedCorridors.includes(f.corridor))
    .map((f) => ({
      assetId: f.assetId,
      type: f.type,
      status: f.status,
      corridor: f.corridor,
      corridorStatus: corridorStatus[f.corridor],
    }));

  const atRiskOnRestricted = atRisk.filter((t) => restrictedCorridors.includes(t.corridor));

  return {
    ok: true,
    phase: "phase-2-day-7",
    level,
    atRiskCount: atRisk.length,
    atRiskOnRestrictedCount: atRiskOnRestricted.length,
    matchedShelterCount: shelterMatches.length,
    matchedFleetCount: fleetMatches.length,
    matchedCount: shelterMatches.length + fleetMatches.length,
    shelterMatches,
    fleetMatches,
    atRiskOnRestricted: atRiskOnRestricted.slice(0, 6).map((t) => ({
      tripId: t.id,
      corridor: t.corridor,
      priority: t.priority,
    })),
    scopeGuard: SHELTER_FLEET_SCOPE_GUARD,
    ingestedAt: overlay.ingestedAt,
  };
}

export function buildShelterFleetSummary(level = 2) {
  const overlay = getShelterFleetOverlay();
  const crossRef = buildShelterFleetCrossRef(level);

  return {
    ok: true,
    phase: "phase-2-day-7",
    headline: "Shelter + fleet logistics coordination — extended HITL personas",
    level,
    shelterCount: overlay.shelterCount,
    fleetCount: overlay.fleetCount,
    acceptingShelters: overlay.acceptingShelters,
    availableFleetAssets: overlay.availableFleetAssets,
    corridorLinkedShelters: crossRef.matchedShelterCount,
    corridorLinkedFleet: crossRef.matchedFleetCount,
    shelters: overlay.shelters,
    fleet: overlay.fleet,
    extendedHitlPersonas: overlay.extendedHitlPersonas,
    scopeGuard: SHELTER_FLEET_SCOPE_GUARD,
    adapter: overlay.adapter,
    ingestedAt: overlay.ingestedAt,
  };
}

export function ingestShelterFleetWebhook(payload) {
  if (!payload || (!Array.isArray(payload.shelters) && !Array.isArray(payload.fleet))) {
    throw new Error("Shelter/fleet webhook payload must include shelters and/or fleet arrays");
  }

  cachedFeed = {
    shelters: payload.shelters || cachedFeed?.shelters || [],
    fleet: payload.fleet || cachedFeed?.fleet || [],
    shelterCount: (payload.shelters || cachedFeed?.shelters || []).length,
    fleetCount: (payload.fleet || cachedFeed?.fleet || []).length,
    source: "webhook",
    ingestedAt: new Date().toISOString(),
    scopeGuard: SHELTER_FLEET_SCOPE_GUARD,
  };

  return {
    ok: true,
    ingested: { shelters: cachedFeed.shelterCount, fleet: cachedFeed.fleetCount },
    source: "webhook",
    ingestedAt: cachedFeed.ingestedAt,
  };
}
