/** Phase 2 Day 11 — corridor-aware routing preview (read-only advisory). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAtRiskTrips } from "../dispatch/index.js";
import { getActiveCorridorStatus } from "./esri.js";

export const ROUTING_PREVIEW_SCOPE_GUARD =
  "Corridor-aware routing preview — read-only alternate route advisories; not turn-by-turn dispatch or navigation authority.";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultAlternatesPath = path.join(geoRoot, "routing-alternates-demo.json");

let cachedAlternates = null;

function loadAlternatesConfig({ refresh = false } = {}) {
  if (cachedAlternates && !refresh) return cachedAlternates;

  const filePath = process.env.ROUTING_ALTERNATES_PATH || defaultAlternatesPath;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  cachedAlternates = {
    alternates: raw.alternates || [],
    scopeGuard: raw.scopeGuard || ROUTING_PREVIEW_SCOPE_GUARD,
    source: path.basename(filePath).includes("demo") ? "demo_json" : "custom_json",
    loadedAt: new Date().toISOString(),
  };
  return cachedAlternates;
}

function findAlternateForCorridor(corridorId, corridorStatus, alternates) {
  return alternates.find(
    (a) => a.corridorId === corridorId && (a.statusWhen || []).includes(corridorStatus)
  );
}

/** Cross-reference at-risk trips with corridor restrictions and alternate route rules. */
export function buildRoutingPreviewCrossRef(level = 2) {
  const config = loadAlternatesConfig();
  const corridorStatus = getActiveCorridorStatus(level);
  const atRisk = getAtRiskTrips(level);

  const restrictedCorridors = Object.entries(corridorStatus)
    .filter(([, st]) => st !== "open")
    .map(([id, status]) => ({ id, status }));

  const corridorAdvisories = restrictedCorridors
    .map(({ id, status }) => {
      const alt = findAlternateForCorridor(id, status, config.alternates);
      if (!alt) return null;
      return {
        corridorId: id,
        corridorStatus: status,
        alternateRouteId: alt.alternateRouteId,
        alternateName: alt.alternateName,
        advisory: alt.advisory,
        sopRef: alt.sopRef,
        streetNames: alt.streetNames || [],
      };
    })
    .filter(Boolean);

  const tripAdvisories = atRisk
    .map((trip) => {
      const status = corridorStatus[trip.corridor];
      if (!status || status === "open") return null;
      const alt = findAlternateForCorridor(trip.corridor, status, config.alternates);
      if (!alt) return null;
      return {
        tripId: trip.id,
        priority: trip.priority,
        pickup: trip.pickup,
        facility: trip.facility,
        corridor: trip.corridor,
        corridorStatus: status,
        alternateRouteId: alt.alternateRouteId,
        alternateName: alt.alternateName,
        advisory: alt.advisory,
        sopRef: alt.sopRef,
      };
    })
    .filter(Boolean);

  return {
    ok: true,
    phase: "phase-2-day-11",
    level,
    mode: "advisory_preview",
    atRiskCount: atRisk.length,
    restrictedCorridorCount: restrictedCorridors.length,
    corridorAdvisoryCount: corridorAdvisories.length,
    tripAdvisoryCount: tripAdvisories.length,
    advisoryCount: tripAdvisories.length,
    corridorAdvisories,
    tripAdvisories,
    matches: tripAdvisories,
    scopeGuard: config.scopeGuard,
    source: config.source,
    ingestedAt: config.loadedAt,
  };
}

export function buildRoutingPreviewSummary(level = 2) {
  const config = loadAlternatesConfig();
  const crossRef = buildRoutingPreviewCrossRef(level);

  return {
    ok: true,
    phase: "phase-2-day-11",
    headline: "Corridor-aware routing preview — read-only alternate route advisories",
    alternateRuleCount: config.alternates.length,
    ...crossRef,
  };
}

/** Compact status for Monitor agent tool. */
export function getRoutingPreviewStatus() {
  const config = loadAlternatesConfig();
  const crossRef = buildRoutingPreviewCrossRef(2);

  return {
    ok: true,
    phase: "phase-2-day-11",
    alternateRuleCount: config.alternates.length,
    restrictedCorridorCount: crossRef.restrictedCorridorCount,
    tripAdvisoryCount: crossRef.tripAdvisoryCount,
    corridorAdvisoryCount: crossRef.corridorAdvisoryCount,
    sampleAdvisories: crossRef.tripAdvisories.slice(0, 3).map((a) => ({
      tripId: a.tripId,
      corridor: a.corridor,
      alternateName: a.alternateName,
    })),
    scopeGuard: ROUTING_PREVIEW_SCOPE_GUARD,
    source: config.source,
  };
}

export function ingestRoutingAlternatesWebhook(payload) {
  if (!payload || !Array.isArray(payload.alternates)) {
    throw new Error("Routing alternates webhook payload must include alternates array");
  }

  cachedAlternates = {
    alternates: payload.alternates,
    scopeGuard: payload.scopeGuard || ROUTING_PREVIEW_SCOPE_GUARD,
    source: "webhook",
    loadedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    ingested: payload.alternates.length,
    source: "webhook",
    ingestedAt: cachedAlternates.loadedAt,
  };
}
