/** Phase 2 Day 3 — fire / police read-only situational awareness + COP export. */

import { getActiveCorridorStatus, getCorridorLayerMeta } from "../geo/esri.js";
import { buildRoutingPreviewCrossRef } from "../geo/routing.js";
import { buildFloodHazardCrossRef } from "../geo/hazards.js";
import { buildCadSummary } from "../cad/index.js";
import { buildTransportDeskSummary, getHandoffWriteBackStatus } from "../transport-desk/index.js";
import { buildEnrichedDispatchSummary } from "../cad/enrichment.js";
import { fetchSignals } from "../signals/index.js";
import { loadPublicSafetyFeed } from "./adapters/json.js";

export const PUBLIC_SAFETY_SCOPE_GUARD =
  "Read-only public-safety unit overlay — no dispatch authority, no PSAP replacement.";

const MAP = {
  viewBox: { width: 800, height: 480 },
  bbox: { minLon: -77.36, maxLon: -77.24, minLat: 25.03, maxLat: 25.10 },
};

function project(lon, lat) {
  const { bbox, viewBox } = MAP;
  const x = ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * viewBox.width;
  const y = viewBox.height - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * viewBox.height;
  return { x: Math.round(x), y: Math.round(y) };
}

function unitColor(agency, status) {
  if (agency === "fire") return status === "staging" || status === "on_scene" ? "#f97316" : "#fb923c";
  if (agency === "police") return status === "on_scene" ? "#3b82f6" : "#60a5fa";
  return "#94a3b8";
}

let cachedOverlay = null;

export function ingestPublicSafetyFeed(source = "json") {
  const feed = loadPublicSafetyFeed();
  cachedOverlay = {
    units: feed.units || [],
    unitCount: (feed.units || []).length,
    source,
    ingestedAt: new Date().toISOString(),
    scopeGuard: PUBLIC_SAFETY_SCOPE_GUARD,
  };
  return cachedOverlay;
}

export function getPublicSafetyOverlay({ refresh = false } = {}) {
  if (!cachedOverlay || refresh) ingestPublicSafetyFeed("json");
  const fireCount = cachedOverlay.units.filter((u) => u.agency === "fire").length;
  const policeCount = cachedOverlay.units.filter((u) => u.agency === "police").length;

  return {
    ok: true,
    phase: "phase-2-day-3",
    mode: "read_only",
    scopeGuard: PUBLIC_SAFETY_SCOPE_GUARD,
    adapter: process.env.PUBLIC_SAFETY_URL ? "rest" : "json",
    ...cachedOverlay,
    fireCount,
    policeCount,
  };
}

/** Compact status for Monitor agent tool. */
export function getPublicSafetyStatus() {
  const overlay = getPublicSafetyOverlay();
  const corridorUnits = overlay.units.filter((u) => u.corridor);

  return {
    ok: true,
    phase: "phase-2-day-3",
    unitCount: overlay.unitCount,
    fireCount: overlay.fireCount,
    policeCount: overlay.policeCount,
    corridorAssignments: corridorUnits.map((u) => ({
      unitId: u.unitId,
      agency: u.agency,
      corridor: u.corridor,
      status: u.status,
      assignment: u.assignment,
    })),
    scopeGuard: PUBLIC_SAFETY_SCOPE_GUARD,
    ingestedAt: overlay.ingestedAt,
  };
}

/** Units assigned to corridors with restricted/closed status at escalation level. */
export function buildPublicSafetyCorridorCrossRef(level = 2) {
  const overlay = getPublicSafetyOverlay();
  const corridorStatus = getActiveCorridorStatus(level);

  const matches = overlay.units
    .filter((u) => u.corridor && corridorStatus[u.corridor] && corridorStatus[u.corridor] !== "open")
    .map((u) => ({
      unitId: u.unitId,
      agency: u.agency,
      agencyLabel: u.agencyLabel,
      status: u.status,
      corridor: u.corridor,
      corridorStatus: corridorStatus[u.corridor],
      assignment: u.assignment,
    }));

  return {
    ok: true,
    phase: "phase-2-day-3",
    level,
    unitCount: overlay.unitCount,
    matchedCount: matches.length,
    matches,
    scopeGuard: PUBLIC_SAFETY_SCOPE_GUARD,
    ingestedAt: overlay.ingestedAt,
  };
}

export function buildPublicSafetySummary(level = 2) {
  const overlay = getPublicSafetyOverlay();
  const crossRef = buildPublicSafetyCorridorCrossRef(level);

  return {
    ok: true,
    phase: "phase-2-day-3",
    headline: "Fire / police situational overlay — read-only EOC feed",
    level,
    unitCount: overlay.unitCount,
    fireCount: overlay.fireCount,
    policeCount: overlay.policeCount,
    corridorAssignedUnits: crossRef.matchedCount,
    units: overlay.units.map((u) => ({
      unitId: u.unitId,
      agency: u.agency,
      agencyLabel: u.agencyLabel,
      status: u.status,
      corridor: u.corridor,
      assignment: u.assignment,
    })),
    scopeGuard: PUBLIC_SAFETY_SCOPE_GUARD,
    adapter: overlay.adapter,
    ingestedAt: overlay.ingestedAt,
  };
}

/** Map-ready fire/police unit markers (diamond shape via SVG path). */
export function buildPublicSafetyMapUnits({ level = 2 } = {}) {
  const overlay = getPublicSafetyOverlay();
  const corridorStatus = getActiveCorridorStatus(level);
  const crossRefIds = new Set(
    buildPublicSafetyCorridorCrossRef(level).matches.map((m) => m.unitId)
  );

  const units = overlay.units.map((u) => {
    const pt = project(u.lon, u.lat);
    const onRestrictedCorridor =
      u.corridor && corridorStatus[u.corridor] && corridorStatus[u.corridor] !== "open";
    const hot = crossRefIds.has(u.unitId) || onRestrictedCorridor;
    const r = hot ? 9 : 7;
    const color = unitColor(u.agency, u.status);
    return {
      unitId: u.unitId,
      agency: u.agency,
      agencyLabel: u.agencyLabel,
      status: u.status,
      corridor: u.corridor,
      assignment: u.assignment,
      onRestrictedCorridor: hot,
      color,
      svg: { x: pt.x - 12, y: pt.y - 12, r, shape: u.agency === "fire" ? "diamond" : "shield" },
    };
  });

  return {
    ok: true,
    unitCount: units.length,
    corridorLinkedUnits: units.filter((u) => u.onRestrictedCorridor).length,
    units,
  };
}

/** Common operating picture JSON export for EOC briefings. */
export async function buildCopExport(level = 2) {
  const signals = await fetchSignals({ refresh: false });
  const publicSafety = buildPublicSafetySummary(level);
  const cad = buildCadSummary(level);
  const transportDesk = buildTransportDeskSummary(level);
  const writeBack = getHandoffWriteBackStatus();
  const enrichedDispatch = buildEnrichedDispatchSummary(level);
  const corridorCrossRef = buildPublicSafetyCorridorCrossRef(level);
  const corridorMeta = getCorridorLayerMeta();
  const routingPreview = buildRoutingPreviewCrossRef(level);
  const floodHazard = buildFloodHazardCrossRef(level);

  return {
    ok: true,
    phase: "phase-2-day-12",
    exportType: "common_operating_picture",
    generatedAt: new Date().toISOString(),
    level,
    scopeGuard: PUBLIC_SAFETY_SCOPE_GUARD,
    situation: {
      event: signals.event,
      label: signals.label,
      level: signals.level,
      serviceArea: signals.serviceArea,
    },
    corridors: getActiveCorridorStatus(level),
    corridorLayer: {
      source: corridorMeta.source,
      adapter: corridorMeta.adapter,
      serviceName: corridorMeta.serviceName,
      featureCount: corridorMeta.featureCount,
    },
    publicSafety: {
      unitCount: publicSafety.unitCount,
      fireCount: publicSafety.fireCount,
      policeCount: publicSafety.policeCount,
      corridorAssignments: corridorCrossRef.matches,
      units: publicSafety.units,
    },
    nemtCad: {
      runCount: cad.runCount,
      atRiskMatched: cad.cadMatched,
      cadLinkedAtRisk: enrichedDispatch.cadLinkedAtRisk,
      liveUnitStatusCounts: enrichedDispatch.liveUnitStatusCounts,
    },
    transportDesk: {
      pendingHandoffs: transportDesk.pendingHandoffs,
      assignedHandoffs: transportDesk.assignedHandoffs,
      bedPressure: transportDesk.bedPressureSummary,
      writeBackEnabled: transportDesk.writeBackEnabled,
      lastWriteBack: writeBack.lastWriteBack,
    },
    routingPreview: {
      tripAdvisoryCount: routingPreview.tripAdvisoryCount,
      corridorAdvisoryCount: routingPreview.corridorAdvisoryCount,
      tripAdvisories: routingPreview.tripAdvisories?.slice(0, 6),
      corridorAdvisories: routingPreview.corridorAdvisories,
      scopeGuard: routingPreview.scopeGuard,
    },
    floodHazard: {
      activeZoneCount: floodHazard.activeZoneCount,
      corridorLinkedZoneCount: floodHazard.corridorLinkedZoneCount,
      tripExposureCount: floodHazard.tripExposureCount,
      zoneMatches: floodHazard.zoneMatches?.slice(0, 6),
      tripExposures: floodHazard.tripExposures,
      scopeGuard: floodHazard.scopeGuard,
    },
    disclaimer: "Synthetic demo COP — read-only feeds; not authoritative for dispatch.",
  };
}

export function ingestPublicSafetyWebhook(payload) {
  if (!payload || !Array.isArray(payload.units)) {
    throw new Error("Public safety webhook payload must include units array");
  }

  cachedOverlay = {
    units: payload.units,
    unitCount: payload.units.length,
    source: "webhook",
    ingestedAt: new Date().toISOString(),
    scopeGuard: PUBLIC_SAFETY_SCOPE_GUARD,
  };

  return {
    ok: true,
    ingested: payload.units.length,
    source: "webhook",
    ingestedAt: cachedOverlay.ingestedAt,
  };
}
