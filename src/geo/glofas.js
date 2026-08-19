/** Phase 3 Day 1+ — GloFAS / Copernicus EWDS gap-fill flood adapter (Nassau clip). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAtRiskTrips } from "../dispatch/index.js";
import { getActiveCorridorStatus } from "./esri.js";
import {
  fetchGlofasFromCds,
  getGlofasCdsConfig,
  getGlofasCdsStatus,
  getGlofasStaleThresholdHours,
  readGlofasCdsCache,
} from "./glofas-cds.js";
import { DEFAULT_CLIP_PATH } from "./glofas-convert.js";
import { MAP, MAP_BBOX, projectPoint } from "./map-constants.js";

export { fetchGlofasFromCds, getGlofasCdsConfig, getGlofasCdsStatus, getGlofasStaleThresholdHours };

export const NASSAU_CLIP_BBOX = MAP_BBOX;

export const GLOFAS_SCOPE_GUARD =
  "GloFAS gap-fill — coarse Copernicus river/discharge guidance clipped to New Providence; model_estimated confidence only; not agency hydrology authority.";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultDemoPath = path.join(geoRoot, "glofas-nassau-demo.json");

let cachedLayer = null;

export function isGlofasEnabled() {
  return String(process.env.GLOFAS_ENABLED || "").toLowerCase() === "true";
}

export function parseGlofasClipBbox(raw = process.env.GLOFAS_CLIP_BBOX) {
  if (!raw) return { ...NASSAU_CLIP_BBOX };
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return { ...NASSAU_CLIP_BBOX };
  }
  const [minLon, maxLon, minLat, maxLat] = parts;
  return { minLon, maxLon, minLat, maxLat };
}

function project(lon, lat) {
  return projectPoint(lon, lat);
}

function ringToSvgPath(ring) {
  if (!ring?.length) return "";
  return ring
    .map(([lon, lat], i) => {
      const p = project(lon, lat);
      return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
    })
    .join(" ")
    .concat(" Z");
}

function depthStyle(band) {
  if (band === "major") {
    return { fill: "rgba(2, 132, 199, 0.22)", stroke: "#0284c7", opacity: 0.75 };
  }
  if (band === "moderate") {
    return { fill: "rgba(14, 165, 233, 0.18)", stroke: "#0ea5e9", opacity: 0.72 };
  }
  return { fill: "rgba(56, 189, 248, 0.12)", stroke: "#38bdf8", opacity: 0.68 };
}

function normalizeFeature(feature) {
  const p = feature.properties || {};
  return {
    ...feature,
    properties: {
      ...p,
      source: p.source || "glofas",
      confidence: p.confidence || "model_estimated",
    },
  };
}

export function normalizeAgencyFeature(feature) {
  const p = feature.properties || {};
  return {
    ...feature,
    properties: {
      ...p,
      source: p.source === "glofas" ? "agency" : p.source || "agency",
      confidence: p.confidence === "model_estimated" ? "agency_confirmed" : p.confidence || "agency_confirmed",
    },
  };
}

function loadGlofasFromFile(filePath, sourceLabel, fetchMode) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const features = (raw.features || []).map(normalizeFeature);
  const cdsCache = readGlofasCdsCache();
  return {
    collection: { ...raw, features },
    meta: {
      ok: true,
      source: raw.source || sourceLabel,
      serviceName: raw.serviceName || "cems-glofas-forecast",
      provider: raw.provider || "Copernicus EMS GloFAS",
      featureCount: features.length,
      gridResolutionDeg: raw.gridResolutionDeg ?? 0.05,
      clipBbox: raw.clipBbox || parseGlofasClipBbox(),
      clipPath: filePath,
      scopeGuard: raw.scopeGuard || GLOFAS_SCOPE_GUARD,
      fetchMode: fetchMode || cdsCache?.fetchMode || raw.source || sourceLabel,
      cdsLastSuccessfulFetchAt: cdsCache?.lastSuccessfulFetchAt || null,
      cdsCatalogueOk: cdsCache?.catalogueOk ?? false,
      conversionPending: cdsCache?.conversionPending ?? false,
      ingestedAt: new Date().toISOString(),
    },
  };
}

function resolveGlofasLayerFile() {
  const clipPath = process.env.GLOFAS_CLIP_PATH || DEFAULT_CLIP_PATH;
  const useDemo = String(process.env.GLOFAS_DEMO ?? "true").toLowerCase() !== "false";
  if (fs.existsSync(clipPath)) {
    return { filePath: clipPath, sourceLabel: "glofas_clip", fetchMode: "cds_grid_converted" };
  }
  if (useDemo) {
    return {
      filePath: process.env.GLOFAS_DEMO_PATH || defaultDemoPath,
      sourceLabel: "glofas_demo",
      fetchMode: readGlofasCdsCache()?.fetchMode || "demo_json",
    };
  }
  return null;
}

function loadGlofasLayerFile() {
  const resolved = resolveGlofasLayerFile();
  if (!resolved) {
    return {
      collection: { type: "FeatureCollection", features: [] },
      meta: {
        ok: false,
        source: "glofas_empty",
        featureCount: 0,
        scopeGuard: GLOFAS_SCOPE_GUARD,
        fetchMode: "empty",
        conversionPending: false,
        ingestedAt: new Date().toISOString(),
      },
    };
  }
  return loadGlofasFromFile(resolved.filePath, resolved.sourceLabel, resolved.fetchMode);
}

export function loadGlofasLayer({ refresh = false } = {}) {
  if (cachedLayer && !refresh) return cachedLayer;
  cachedLayer = loadGlofasLayerFile();
  return cachedLayer;
}

/** Phase 3 Day 3+ — CDS metadata + grid→polygon conversion + cache. */
export async function syncGlofasFloodLayer(level = 2, { refresh = true } = {}) {
  const cfg = getGlofasCdsConfig();
  let cds = null;
  if (cfg.live || refresh) {
    cds = await fetchGlofasFromCds({ refresh });
  } else {
    cds = { ok: false, reason: "live_disabled", fetchMode: readGlofasCdsCache()?.fetchMode || "demo_json" };
  }
  if (refresh) loadGlofasLayer({ refresh: true });
  const crossRef = buildGlofasCrossRef(level);
  const cdsStatus = getGlofasCdsStatus();
  return {
    ...crossRef,
    ok: true,
    phase: "phase-3-day-10",
    mode: "glofas_cds_sync",
    cds,
    conversion: cds?.conversion || null,
    cdsStatus,
    lastSuccessfulFetchAt: cds?.lastSuccessfulFetchAt || cdsStatus.lastSuccessfulFetchAt,
    fetchMode: cds?.fetchMode || cdsStatus.fetchMode,
    clipPath: cds?.clipPath || cdsStatus.clipPath,
    fallback: cds?.ok ? null : cds?.fallback || "demo_json",
  };
}

function loadAgencyFloodFeaturesForLevel(level) {
  const filePath = process.env.FLOOD_DEPTH_PATH || path.join(geoRoot, "flood-depth-demo.json");
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return (raw.features || [])
    .map(normalizeAgencyFeature)
    .filter((f) => level >= (f.properties?.activeAtLevel ?? 2));
}

export const GLOFAS_ESCALATION_MIN_LEVEL = Number(process.env.GLOFAS_ESCALATION_MIN_LEVEL) || 2;

function resolveGlofasRefreshPolicy(level, doRefresh) {
  if (!isGlofasEnabled()) return "glofas_disabled";
  if (doRefresh) return "escalation_refresh";
  return "skipped_below_L2";
}

/** Phase 3 Day 7 — refresh CDS + clip only when escalation level warrants gap-fill. */
export function shouldRefreshGlofasOnPipeline(level = 2) {
  if (!isGlofasEnabled()) return false;
  return level >= GLOFAS_ESCALATION_MIN_LEVEL;
}

function buildGlofasStatusOnlyStep(level) {
  const layer = loadGlofasLayer({ refresh: false });
  const crossRef = buildGlofasCrossRef(level);
  const cdsStatus = getGlofasCdsStatus();
  return {
    ...crossRef,
    ok: true,
    phase: "phase-3-day-10",
    mode: "glofas_status_only",
    skippedRefresh: true,
    cdsStatus,
    lastSuccessfulFetchAt: cdsStatus.lastSuccessfulFetchAt,
    fetchMode: layer.meta.fetchMode || cdsStatus.fetchMode,
    staleHours: cdsStatus.staleHours,
    staleWarning: cdsStatus.staleWarning,
    staleThresholdHours: getGlofasStaleThresholdHours(),
  };
}

function buildGlofasMergeSnapshot(level = 2) {
  if (!isGlofasEnabled()) return null;
  const layer = cachedLayer || loadGlofasLayerFile();
  const agency = loadAgencyFloodFeaturesForLevel(level);
  const glofas = activeGlofasZones(level, layer);
  return mergeGlofasGapFill(agency, glofas);
}

/** Phase 3 Day 6+ — pipeline step payload for orchestrator + audit. */
export async function buildGlofasPipelineSyncStep(level = 2, { refresh, floodHazardSync } = {}) {
  const doRefresh = refresh ?? shouldRefreshGlofasOnPipeline(level);
  const cdsStatus = getGlofasCdsStatus();
  const sync = doRefresh
    ? await syncGlofasFloodLayer(level, { refresh: true })
    : buildGlofasStatusOnlyStep(level);
  const mergeMeta =
    floodHazardSync?.glofasEnabled != null
      ? {
          mergeRule: floodHazardSync.mergeRule,
          agencyZoneCount: floodHazardSync.agencyZoneCount,
          glofasGapZoneCount: floodHazardSync.glofasGapZoneCount,
          suppressedGlofasZoneCount: floodHazardSync.suppressedGlofasZoneCount,
        }
      : buildGlofasMergeSnapshot(level);
  const floodBadgeLabel =
    mergeMeta && isGlofasEnabled()
      ? `${mergeMeta.agencyZoneCount} agency + ${mergeMeta.glofasGapZoneCount} glofas zone(s)`
      : null;

  return {
    ...sync,
    step: "glofas_flood_sync",
    phase: "phase-3-day-10",
    monitorTool: "get_glofas_flood_status",
    refreshed: doRefresh,
    skippedRefresh: !doRefresh,
    refreshPolicy: resolveGlofasRefreshPolicy(level, doRefresh),
    escalationMinLevel: GLOFAS_ESCALATION_MIN_LEVEL,
    mergeRule: mergeMeta?.mergeRule || (isGlofasEnabled() ? "agency_wins_corridor" : "glofas_only"),
    agencyZoneCount: mergeMeta?.agencyZoneCount ?? null,
    glofasGapZoneCount: mergeMeta?.glofasGapZoneCount ?? sync.activeZoneCount,
    suppressedGlofasZoneCount: mergeMeta?.suppressedGlofasZoneCount ?? 0,
    floodBadgeLabel,
    staleHours: sync.staleHours ?? cdsStatus.staleHours,
    staleWarning: sync.staleWarning ?? cdsStatus.staleWarning,
    staleThresholdHours: getGlofasStaleThresholdHours(),
    syncAt: new Date().toISOString(),
  };
}

export function activeGlofasZones(level, layer = cachedLayer || loadGlofasLayerFile()) {
  return (layer.collection.features || []).filter(
    (f) => level >= (f.properties?.activeAtLevel ?? 2)
  );
}

/** Agency corridors covered suppress GloFAS gap-fill on same corridor. */
export function mergeGlofasGapFill(agencyFeatures, glofasFeatures) {
  const agencyCorridors = new Set();
  for (const f of agencyFeatures) {
    for (const c of f.properties?.linkedCorridors || []) agencyCorridors.add(c);
  }
  const suppressed = [];
  const gapFill = [];
  for (const f of glofasFeatures) {
    const linked = f.properties?.linkedCorridors || [];
    const overlapsAgency = linked.length && linked.every((c) => agencyCorridors.has(c));
    if (overlapsAgency) {
      suppressed.push(f);
      continue;
    }
    gapFill.push(f);
  }
  const normalizedAgency = agencyFeatures.map(normalizeAgencyFeature);
  const normalizedGap = gapFill.map(normalizeFeature);
  return {
    features: [...normalizedAgency, ...normalizedGap],
    mergeRule: "agency_wins_corridor",
    agencyZoneCount: normalizedAgency.length,
    glofasGapZoneCount: normalizedGap.length,
    suppressedGlofasZoneCount: suppressed.length,
    suppressedGlofasZones: suppressed.map((f) => ({
      zoneId: f.properties?.id,
      name: f.properties?.name,
      linkedCorridors: f.properties?.linkedCorridors || [],
      reason: "agency_corridor_override",
    })),
  };
}

export function buildGlofasMapOverlay(level = 2) {
  const layer = cachedLayer || loadGlofasLayerFile();
  return activeGlofasZones(level, layer).map((f) => {
    const p = f.properties || {};
    const style = depthStyle(p.depthBand);
    const ring = f.geometry?.coordinates?.[0] || [];
    const labelPt = project(
      ring[Math.floor(ring.length / 2)]?.[0] ?? -77.31,
      ring[Math.floor(ring.length / 2)]?.[1] ?? 25.05
    );
    const labelText =
      p.returnPeriodYears != null
        ? `~${p.returnPeriodYears}yr`
        : "model";
    return {
      id: p.id,
      name: p.name,
      source: "glofas",
      confidence: p.confidence || "model_estimated",
      depthInches: p.depthInches,
      depthBand: p.depthBand,
      returnPeriodYears: p.returnPeriodYears,
      linkedCorridors: p.linkedCorridors || [],
      path: ringToSvgPath(ring),
      label: { x: labelPt.x, y: labelPt.y, text: labelText },
      strokeDasharray: "4 2",
      ...style,
    };
  });
}

export function buildGlofasCrossRef(level = 2) {
  const corridorStatus = getActiveCorridorStatus(level);
  const atRisk = getAtRiskTrips(level);
  const layer = cachedLayer || loadGlofasLayerFile();
  const zones = activeGlofasZones(level, layer);

  const restrictedCorridors = Object.entries(corridorStatus)
    .filter(([, st]) => st !== "open")
    .map(([id]) => id);

  const zoneMatches = zones
    .map((f) => {
      const p = f.properties || {};
      const linked = (p.linkedCorridors || []).filter((c) => restrictedCorridors.includes(c));
      if (!linked.length && level < 3) return null;
      return {
        zoneId: p.id,
        name: p.name,
        source: "glofas",
        confidence: p.confidence || "model_estimated",
        depthInches: p.depthInches,
        depthBand: p.depthBand,
        returnPeriodYears: p.returnPeriodYears,
        dischargeM3s: p.dischargeM3s,
        linkedCorridors: p.linkedCorridors || [],
        restrictedLinkedCorridors: linked,
        corridorStatus: linked.reduce((acc, id) => ({ ...acc, [id]: corridorStatus[id] }), {}),
      };
    })
    .filter(Boolean);

  const exposedTrips = atRisk.filter((t) =>
    zoneMatches.some((z) => (z.linkedCorridors || []).includes(t.corridor))
  );

  return {
    ok: true,
    phase: "phase-3-day-10",
    level,
    mode: "glofas_gap_fill",
    activeZoneCount: zones.length,
    corridorLinkedZoneCount: zoneMatches.length,
    tripExposureCount: exposedTrips.length,
    zoneMatches,
    tripExposures: exposedTrips.slice(0, 6).map((t) => ({
      tripId: t.id,
      corridor: t.corridor,
      priority: t.priority,
      pickup: t.pickup,
    })),
    scopeGuard: GLOFAS_SCOPE_GUARD,
    ingestedAt: layer.meta.ingestedAt,
    fetchMode: layer.meta.fetchMode,
  };
}

export function buildGlofasSummary(level = 2) {
  const layer = cachedLayer || loadGlofasLayerFile();
  const crossRef = buildGlofasCrossRef(level);

  return {
    ok: true,
    phase: "phase-3-day-10",
    headline: "GloFAS gap-fill — Copernicus coarse flood guidance clipped to Nassau",
    enabled: isGlofasEnabled(),
    ...layer.meta,
    ...crossRef,
  };
}

export function getGlofasFloodStatus(level = 2) {
  const crossRef = buildGlofasCrossRef(level);
  const layer = cachedLayer || loadGlofasLayerFile();
  const cdsStatus = getGlofasCdsStatus();
  const mergeMeta = buildGlofasMergeSnapshot(level);

  return {
    ok: true,
    phase: "phase-3-day-10",
    pipelineStep: "glofas_flood_sync",
    monitorTool: "get_glofas_flood_status",
    enabled: isGlofasEnabled(),
    featureCount: layer.meta.featureCount,
    activeZoneCount: crossRef.activeZoneCount,
    corridorLinkedZoneCount: crossRef.corridorLinkedZoneCount,
    tripExposureCount: crossRef.tripExposureCount,
    fetchMode: layer.meta.fetchMode,
    cds: cdsStatus,
    lastSuccessfulFetchAt: cdsStatus.lastSuccessfulFetchAt,
    staleWarning: cdsStatus.staleWarning,
    staleHours: cdsStatus.staleHours,
    staleThresholdHours: getGlofasStaleThresholdHours(),
    refreshPolicy: resolveGlofasRefreshPolicy(level, shouldRefreshGlofasOnPipeline(level)),
    refreshed: shouldRefreshGlofasOnPipeline(level),
    skippedRefresh: !shouldRefreshGlofasOnPipeline(level),
    escalationMinLevel: GLOFAS_ESCALATION_MIN_LEVEL,
    conversionPending: layer.meta.conversionPending ?? cdsStatus.conversionPending ?? false,
    gridResolutionDeg: layer.meta.gridResolutionDeg,
    clipBbox: layer.meta.clipBbox,
    mergeRule: mergeMeta?.mergeRule || (isGlofasEnabled() ? "agency_wins_corridor" : null),
    agencyZoneCount: mergeMeta?.agencyZoneCount ?? null,
    glofasGapZoneCount: mergeMeta?.glofasGapZoneCount ?? crossRef.activeZoneCount,
    suppressedGlofasZoneCount: mergeMeta?.suppressedGlofasZoneCount ?? 0,
    floodBadgeLabel:
      mergeMeta && isGlofasEnabled()
        ? `${mergeMeta.agencyZoneCount} agency + ${mergeMeta.glofasGapZoneCount} glofas zone(s)`
        : null,
    sampleZones: crossRef.zoneMatches?.slice(0, 3).map((z) => ({
      zoneId: z.zoneId,
      confidence: z.confidence,
      returnPeriodYears: z.returnPeriodYears,
      linkedCorridors: z.linkedCorridors,
    })),
    scopeGuard: GLOFAS_SCOPE_GUARD,
    source: layer.meta.source,
  };
}

export function ingestGlofasWebhook(payload) {
  if (!payload || !Array.isArray(payload.features)) {
    throw new Error("GloFAS webhook payload must include features array");
  }

  const features = payload.features.map(normalizeFeature);
  cachedLayer = {
    collection: {
      type: "FeatureCollection",
      features,
      scopeGuard: payload.scopeGuard || GLOFAS_SCOPE_GUARD,
      source: payload.source || "glofas_webhook",
      serviceName: payload.serviceName || "cems-glofas-forecast",
      updatedAt: payload.updatedAt || new Date().toISOString(),
    },
    meta: {
      ok: true,
      source: payload.source || "glofas_webhook",
      serviceName: payload.serviceName || "cems-glofas-forecast",
      provider: payload.provider || "Copernicus EMS GloFAS",
      featureCount: features.length,
      scopeGuard: payload.scopeGuard || GLOFAS_SCOPE_GUARD,
      fetchMode: "webhook",
      ingestedAt: new Date().toISOString(),
    },
  };

  return {
    ok: true,
    ingested: features.length,
    source: "glofas_webhook",
    ingestedAt: cachedLayer.meta.ingestedAt,
  };
}
