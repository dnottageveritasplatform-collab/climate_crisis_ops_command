/** Phase 2 Day 1 — read-only CAD / dispatch overlay adapter (CSV + webhook stub). */

import { getAtRiskTrips, loadDispatch } from "../dispatch/index.js";
import { loadCadCsv } from "./adapters/csv.js";
import { MAP, projectPoint } from "../geo/map-constants.js";

export const CAD_SCOPE_GUARD =
  "CAD overlay — read-only situational feeds; pilot handoff accept links nemtRunId only (Day 4). No PSAP, no full dispatch write-back.";

function project(lon, lat) {
  return projectPoint(lon, lat);
}

function unitColor(status) {
  if (status === "en_route" || status === "at_scene") return "#38bdf8";
  if (status === "available") return "#5fd4a4";
  return "#7f8f9f";
}

let cachedOverlay = null;
let lastIngestAt = null;

/** Ingest CAD export rows — CSV file by default; webhook payload uses same shape. */
export function ingestCadFeed(source = "csv") {
  const runs = source === "csv" ? loadCadCsv() : [];
  const units = buildUnitIndex(runs);

  cachedOverlay = {
    runs,
    units: Object.values(units),
    runCount: runs.length,
    unitCount: Object.keys(units).length,
    source,
    ingestedAt: new Date().toISOString(),
  };
  lastIngestAt = cachedOverlay.ingestedAt;
  return cachedOverlay;
}

function buildUnitIndex(runs) {
  const units = {};
  for (const run of runs) {
    if (!units[run.unitId]) {
      units[run.unitId] = {
        unitId: run.unitId,
        status: run.unitStatus,
        agency: run.agency,
        activeRuns: [],
        lat: run.lat,
        lon: run.lon,
      };
    }
    units[run.unitId].activeRuns.push(run.runId);
    units[run.unitId].status = run.unitStatus;
    units[run.unitId].lat = run.lat;
    units[run.unitId].lon = run.lon;
  }
  return units;
}

export function getCadOverlay({ refresh = false } = {}) {
  if (!cachedOverlay || refresh) ingestCadFeed("csv");
  return {
    ok: true,
    phase: "phase-2-day-1",
    mode: "read_only",
    scopeGuard: CAD_SCOPE_GUARD,
    adapter: process.env.CAD_FEED_URL ? "rest" : "csv",
    ...cachedOverlay,
  };
}

/** Cross-reference CCOC at-risk trips with CAD run / incident IDs for audit. */
export function buildCadCrossReference(level = 2) {
  const overlay = getCadOverlay();
  const atRisk = getAtRiskTrips(level);
  const runByTrip = Object.fromEntries(overlay.runs.map((r) => [r.tripId, r]));
  const dispatchById = Object.fromEntries(loadDispatch().map((t) => [t.id, t]));

  const matches = [];
  const unmatched = [];

  for (const trip of atRisk) {
    const cad = runByTrip[trip.id];
    if (cad) {
      matches.push({
        tripId: trip.id,
        priority: trip.priority,
        pickup: trip.pickup,
        facility: trip.facility,
        corridor: trip.corridor,
        runId: cad.runId,
        incidentId: cad.incidentId,
        unitId: cad.unitId,
        unitStatus: cad.unitStatus,
        agency: cad.agency,
      });
    } else {
      unmatched.push({ tripId: trip.id, priority: trip.priority, reason: "no_cad_run" });
    }
  }

  return {
    ok: true,
    phase: "phase-2-day-1",
    level,
    atRiskCount: atRisk.length,
    matchedCount: matches.length,
    unmatchedCount: unmatched.length,
    matches,
    unmatched,
    scopeGuard: CAD_SCOPE_GUARD,
    ingestedAt: overlay.ingestedAt,
  };
}

export function buildCadSummary(level = 2) {
  const overlay = getCadOverlay();
  const crossRef = buildCadCrossReference(level);
  const statusCounts = overlay.runs.reduce((acc, r) => {
    acc[r.unitStatus] = (acc[r.unitStatus] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    phase: "phase-2-day-1",
    headline: "CAD read-only overlay — trip + unit layers",
    level,
    runCount: overlay.runCount,
    unitCount: overlay.unitCount,
    unitStatusCounts: statusCounts,
    atRiskTrips: crossRef.atRiskCount,
    cadMatched: crossRef.matchedCount,
    crossReferenceRate:
      crossRef.atRiskCount > 0
        ? Math.round((crossRef.matchedCount / crossRef.atRiskCount) * 100)
        : 100,
    scopeGuard: CAD_SCOPE_GUARD,
    adapter: overlay.adapter,
    ingestedAt: overlay.ingestedAt,
  };
}

/** Map-ready unit pins from CAD overlay (read-only situational layer). */
export function buildCadMapUnits({ level = 2, atRiskTripIds } = {}) {
  const overlay = getCadOverlay();
  const atRiskSet = new Set(atRiskTripIds || getAtRiskTrips(level).map((t) => t.id));

  const units = overlay.units.map((unit) => {
    const pt = project(unit.lon, unit.lat);
    const linkedRuns = overlay.runs.filter((r) => r.unitId === unit.unitId);
    const atRiskLinked = linkedRuns.some((r) => atRiskSet.has(r.tripId));
    const r = atRiskLinked ? 9 : 7;
    return {
      unitId: unit.unitId,
      status: unit.status,
      agency: unit.agency,
      activeRuns: unit.activeRuns,
      atRiskLinked,
      color: unitColor(unit.status),
      lon: unit.lon,
      lat: unit.lat,
      svg: { x: pt.x + 14, y: pt.y - 12, r },
    };
  });

  return {
    ok: true,
    unitCount: units.length,
    atRiskLinkedUnits: units.filter((u) => u.atRiskLinked).length,
    units,
  };
}

/** Webhook stub — accepts pilot CAD JSON array; read-only ingest only. */
export function ingestCadWebhook(payload) {
  if (!Array.isArray(payload)) {
    throw new Error("CAD webhook payload must be an array of run records");
  }

  const runs = payload.map((row) => ({
    runId: row.run_id || row.runId,
    incidentId: row.incident_id || row.incidentId,
    tripId: row.trip_id || row.tripId,
    unitId: row.unit_id || row.unitId,
    unitStatus: row.unit_status || row.unitStatus || "unknown",
    agency: row.agency || "unknown",
    incidentType: row.incident_type || row.incidentType || "medical_transport",
    dispatchedAt: row.dispatched_at || row.dispatchedAt || new Date().toISOString(),
    lat: Number(row.lat),
    lon: Number(row.lon),
    destination: row.destination || "",
  }));

  const units = buildUnitIndex(runs);
  cachedOverlay = {
    runs,
    units: Object.values(units),
    runCount: runs.length,
    unitCount: Object.keys(units).length,
    source: "webhook",
    ingestedAt: new Date().toISOString(),
  };
  lastIngestAt = cachedOverlay.ingestedAt;

  return {
    ok: true,
    ingested: runs.length,
    unitCount: Object.keys(units).length,
    source: "webhook",
    ingestedAt: cachedOverlay.ingestedAt,
  };
}

export function getCadIngestStatus() {
  return {
    ok: true,
    lastIngestAt,
    runCount: cachedOverlay?.runCount ?? 0,
    source: cachedOverlay?.source ?? null,
  };
}

/** Verify NEMT handoff accept run ID exists in CAD and matches linked trip. */
export function verifyHandoffCadLink(nemtRunId, linkedTripId) {
  const overlay = getCadOverlay();
  const run = overlay.runs.find((r) => r.runId === nemtRunId);
  if (!run) {
    return { ok: false, reason: "run_not_in_cad", nemtRunId };
  }
  if (linkedTripId && run.tripId !== linkedTripId) {
    return {
      ok: false,
      reason: "trip_mismatch",
      nemtRunId,
      linkedTripId,
      cadTripId: run.tripId,
    };
  }
  return {
    ok: true,
    runId: run.runId,
    tripId: run.tripId,
    incidentId: run.incidentId,
    unitId: run.unitId,
  };
}
