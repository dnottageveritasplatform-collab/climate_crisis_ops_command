/** Phase 3b Day 1+ — commercial urban flood adapter (Fathom/JBA-style Nassau urban clip). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAtRiskTrips } from "../dispatch/index.js";
import { getActiveCorridorStatus } from "./esri.js";
import {
  fetchUrbanFloodFromVendor,
  getUrbanFloodVendorConfig,
  getUrbanFloodVendorStatus,
  getUrbanFloodStaleThresholdHours,
  readUrbanFloodCache,
} from "./urban-flood-vendor.js";
import { convertUrbanFloodExport, DEFAULT_CLIP_PATH } from "./urban-flood-convert.js";
import { buildFloodMergeSnapshot } from "./hazards.js";

export {
  fetchUrbanFloodFromVendor,
  getUrbanFloodVendorConfig,
  getUrbanFloodVendorStatus,
  getUrbanFloodStaleThresholdHours,
  convertUrbanFloodExport,
};
export { DEFAULT_CLIP_PATH } from "./urban-flood-convert.js";

export const URBAN_FLOOD_SCOPE_GUARD =
  "Commercial urban flood — licensed fine-resolution pluvial guidance for downtown Nassau; commercial_model confidence only; not agency hydrology authority.";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultDemoPath = path.join(geoRoot, "urban-flood-nassau-demo.json");

/** Tighter urban core bbox than GloFAS Nassau clip. */
export const URBAN_FLOOD_CLIP_BBOX = {
  minLon: -77.34,
  maxLon: -77.3,
  minLat: 25.04,
  maxLat: 25.08,
};

let cachedLayer = null;

export function isUrbanFloodEnabled() {
  return String(process.env.URBAN_FLOOD_ENABLED || "").toLowerCase() === "true";
}

export function getUrbanFloodVendor() {
  return (process.env.URBAN_FLOOD_VENDOR || "demo").trim().toLowerCase();
}

export function parseUrbanFloodClipBbox(raw = process.env.URBAN_FLOOD_CLIP_BBOX) {
  if (!raw) return { ...URBAN_FLOOD_CLIP_BBOX };
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return { ...URBAN_FLOOD_CLIP_BBOX };
  }
  const [minLon, maxLon, minLat, maxLat] = parts;
  return { minLon, maxLon, minLat, maxLat };
}

function normalizeFeature(feature) {
  const p = feature.properties || {};
  return {
    ...feature,
    properties: {
      ...p,
      source: p.source || "commercial",
      confidence: p.confidence || "commercial_model",
      vendor: p.vendor || getUrbanFloodVendor(),
    },
  };
}

function loadUrbanFloodFromFile(filePath, sourceLabel, fetchMode) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const features = (raw.features || []).map(normalizeFeature);
  return {
    collection: { ...raw, features },
    meta: {
      ok: true,
      source: raw.source || sourceLabel,
      serviceName: raw.serviceName || "urban-flood-vendor",
      provider: raw.provider || "Commercial urban flood (demo)",
      vendor: raw.vendor || getUrbanFloodVendor(),
      featureCount: features.length,
      gridResolutionDeg: raw.gridResolutionDeg ?? null,
      clipBbox: raw.clipBbox || parseUrbanFloodClipBbox(),
      clipPath: filePath,
      scopeGuard: raw.scopeGuard || URBAN_FLOOD_SCOPE_GUARD,
      fetchMode: fetchMode || readUrbanFloodCache()?.fetchMode || raw.source || sourceLabel,
      vendorLastSuccessfulFetchAt: readUrbanFloodCache()?.lastSuccessfulFetchAt || null,
      vendorCatalogueOk: readUrbanFloodCache()?.catalogueOk ?? false,
      conversionPending: readUrbanFloodCache()?.conversionPending ?? !fs.existsSync(DEFAULT_CLIP_PATH),
      ingestedAt: new Date().toISOString(),
    },
  };
}

function resolveUrbanFloodLayerFile() {
  const clipPath = process.env.URBAN_FLOOD_CLIP_PATH || DEFAULT_CLIP_PATH;
  const useDemo = String(process.env.URBAN_FLOOD_DEMO ?? "true").toLowerCase() !== "false";
  if (fs.existsSync(clipPath)) {
    return { filePath: clipPath, sourceLabel: "urban_flood_clip", fetchMode: "vendor_grid_converted" };
  }
  if (useDemo) {
    return {
      filePath: process.env.URBAN_FLOOD_DEMO_PATH || defaultDemoPath,
      sourceLabel: "urban_flood_demo",
      fetchMode: "demo_json",
    };
  }
  return null;
}

function loadUrbanFloodLayerFile() {
  const resolved = resolveUrbanFloodLayerFile();
  if (!resolved) {
    return {
      collection: { type: "FeatureCollection", features: [] },
      meta: {
        ok: false,
        source: "urban_flood_empty",
        featureCount: 0,
        vendor: getUrbanFloodVendor(),
        scopeGuard: URBAN_FLOOD_SCOPE_GUARD,
        fetchMode: "empty",
        ingestedAt: new Date().toISOString(),
      },
    };
  }
  return loadUrbanFloodFromFile(resolved.filePath, resolved.sourceLabel, resolved.fetchMode);
}

export function loadUrbanFloodLayer({ refresh = false } = {}) {
  if (cachedLayer && !refresh) return cachedLayer;
  cachedLayer = loadUrbanFloodLayerFile();
  return cachedLayer;
}

export const URBAN_FLOOD_ESCALATION_MIN_LEVEL =
  Number(process.env.URBAN_FLOOD_ESCALATION_MIN_LEVEL) || 2;

function resolveUrbanFloodRefreshPolicy(level, doRefresh) {
  if (!isUrbanFloodEnabled()) return "urban_flood_disabled";
  if (doRefresh) return "escalation_refresh";
  return "skipped_below_L2";
}

/** Phase 3b Day 7 — refresh vendor clip only when escalation level warrants gap-fill. */
export function shouldRefreshUrbanFloodOnPipeline(level = 2) {
  if (!isUrbanFloodEnabled()) return false;
  return level >= URBAN_FLOOD_ESCALATION_MIN_LEVEL;
}

function buildUrbanFloodMergeSnapshot(level = 2) {
  if (!isUrbanFloodEnabled()) return null;
  return buildFloodMergeSnapshot(level);
}

/** Phase 3b Day 2+ — vendor metadata probe + Day 3 grid→polygon conversion. */
export async function syncUrbanFloodLayer(level = 2, { refresh = true } = {}) {
  const cfg = getUrbanFloodVendorConfig();
  let vendor = null;
  if (cfg.live && refresh) {
    vendor = await fetchUrbanFloodFromVendor({ refresh });
  } else if (refresh) {
    vendor = {
      ok: true,
      reason: "escalation_clip_reload",
      fetchMode: readUrbanFloodCache()?.fetchMode || loadUrbanFloodLayerFile().meta.fetchMode,
      vendor: cfg.vendor,
      lastSuccessfulFetchAt: readUrbanFloodCache()?.lastSuccessfulFetchAt || null,
      conversionPending: readUrbanFloodCache()?.conversionPending ?? false,
    };
  } else {
    vendor = {
      ok: false,
      reason: "live_disabled",
      fetchMode: readUrbanFloodCache()?.fetchMode || "demo_json",
    };
  }
  if (refresh) loadUrbanFloodLayer({ refresh: true });
  const crossRef = buildUrbanFloodCrossRef(level);
  const vendorStatus = getUrbanFloodVendorStatus();
  return {
    ...crossRef,
    ok: true,
    phase: "phase-3b-day-7",
    mode: "urban_flood_vendor_sync",
    vendor,
    conversion: vendor?.conversion || null,
    vendorStatus,
    lastSuccessfulFetchAt: vendor?.lastSuccessfulFetchAt || vendorStatus.lastSuccessfulFetchAt,
    fetchMode: vendor?.fetchMode || vendorStatus.fetchMode,
    clipPath: vendor?.clipPath || vendorStatus.clipPath,
    fallback: vendor?.ok ? null : vendor?.fallback || "demo_json",
    conversionPending: vendor?.conversionPending ?? vendorStatus.conversionPending ?? true,
  };
}

function buildUrbanFloodStatusOnlyStep(level) {
  const layer = loadUrbanFloodLayer({ refresh: false });
  const crossRef = buildUrbanFloodCrossRef(level);
  const vendorStatus = getUrbanFloodVendorStatus();
  return {
    ...crossRef,
    ok: true,
    phase: "phase-3b-day-7",
    mode: "urban_flood_status_only",
    skippedRefresh: true,
    vendorStatus,
    lastSuccessfulFetchAt: vendorStatus.lastSuccessfulFetchAt,
    fetchMode: layer.meta.fetchMode || vendorStatus.fetchMode,
    staleHours: vendorStatus.staleHours,
    staleWarning: vendorStatus.staleWarning,
    staleThresholdHours: getUrbanFloodStaleThresholdHours(),
    conversionPending: layer.meta.conversionPending ?? vendorStatus.conversionPending ?? true,
  };
}

/** Phase 3b Day 6+ — pipeline sync step for orchestrator + audit + Monitor tool. */
export async function buildUrbanFloodPipelineSyncStep(level = 2, { refresh, floodHazardSync } = {}) {
  const cfg = getUrbanFloodVendorConfig();
  const doRefresh = refresh ?? shouldRefreshUrbanFloodOnPipeline(level);
  const vendorStatus = getUrbanFloodVendorStatus();
  const sync =
    doRefresh && isUrbanFloodEnabled()
      ? await syncUrbanFloodLayer(level, { refresh: true })
      : buildUrbanFloodStatusOnlyStep(level);

  const mergeMeta =
    floodHazardSync?.urbanFloodEnabled != null
      ? {
          mergeRule: floodHazardSync.mergeRule,
          agencyZoneCount: floodHazardSync.agencyZoneCount,
          commercialGapZoneCount: floodHazardSync.commercialGapZoneCount,
          glofasGapZoneCount: floodHazardSync.glofasGapZoneCount,
          suppressedCommercialZoneCount: floodHazardSync.suppressedCommercialZoneCount,
          suppressedGlofasZoneCount: floodHazardSync.suppressedGlofasZoneCount,
          floodBadgeLabel: floodHazardSync.floodBadgeLabel,
        }
      : buildUrbanFloodMergeSnapshot(level);

  const floodBadgeLabel =
    mergeMeta && isUrbanFloodEnabled() ? mergeMeta.floodBadgeLabel ?? null : null;

  return {
    ...sync,
    step: "urban_flood_sync",
    phase: "phase-3b-day-7",
    monitorTool: "get_urban_flood_status",
    enabled: isUrbanFloodEnabled(),
    refreshed: doRefresh && isUrbanFloodEnabled(),
    skippedRefresh: !doRefresh || !isUrbanFloodEnabled(),
    refreshPolicy: resolveUrbanFloodRefreshPolicy(level, doRefresh && isUrbanFloodEnabled()),
    escalationMinLevel: URBAN_FLOOD_ESCALATION_MIN_LEVEL,
    mergeRule: mergeMeta?.mergeRule || (isUrbanFloodEnabled() ? "agency_wins_then_commercial_then_glofas" : "urban_flood_disabled"),
    agencyZoneCount: mergeMeta?.agencyZoneCount ?? null,
    commercialGapZoneCount: mergeMeta?.commercialGapZoneCount ?? sync.activeZoneCount,
    glofasGapZoneCount: mergeMeta?.glofasGapZoneCount ?? null,
    suppressedCommercialZoneCount: mergeMeta?.suppressedCommercialZoneCount ?? 0,
    suppressedGlofasZoneCount: mergeMeta?.suppressedGlofasZoneCount ?? null,
    floodBadgeLabel,
    vendor: cfg.vendor,
    vendorStatus: sync.vendorStatus ?? vendorStatus,
    conversionPending: sync.conversionPending ?? true,
    staleHours: sync.staleHours ?? vendorStatus.staleHours,
    staleWarning: sync.staleWarning ?? vendorStatus.staleWarning,
    staleThresholdHours: getUrbanFloodStaleThresholdHours(),
    syncAt: new Date().toISOString(),
  };
}

export function getUrbanFloodStatus(level = 2) {
  const crossRef = buildUrbanFloodCrossRef(level);
  const layer = cachedLayer || loadUrbanFloodLayerFile();
  const vendorStatus = getUrbanFloodVendorStatus();
  const mergeMeta = buildUrbanFloodMergeSnapshot(level);
  const doRefresh = shouldRefreshUrbanFloodOnPipeline(level);

  return {
    ok: true,
    phase: "phase-3b-day-7",
    pipelineStep: "urban_flood_sync",
    monitorTool: "get_urban_flood_status",
    enabled: isUrbanFloodEnabled(),
    vendor: getUrbanFloodVendor(),
    featureCount: layer.meta.featureCount,
    activeZoneCount: crossRef.activeZoneCount,
    corridorLinkedZoneCount: crossRef.corridorLinkedZoneCount,
    tripExposureCount: crossRef.tripExposureCount,
    fetchMode: layer.meta.fetchMode,
    vendorStatus,
    lastSuccessfulFetchAt: vendorStatus.lastSuccessfulFetchAt,
    staleWarning: vendorStatus.staleWarning,
    staleHours: vendorStatus.staleHours,
    staleThresholdHours: getUrbanFloodStaleThresholdHours(),
    refreshPolicy: resolveUrbanFloodRefreshPolicy(level, doRefresh),
    refreshed: doRefresh,
    skippedRefresh: !doRefresh,
    escalationMinLevel: URBAN_FLOOD_ESCALATION_MIN_LEVEL,
    conversionPending: layer.meta.conversionPending ?? vendorStatus.conversionPending ?? true,
    mergeRule: mergeMeta?.mergeRule || (isUrbanFloodEnabled() ? "agency_wins_then_commercial_then_glofas" : "disabled"),
    agencyZoneCount: mergeMeta?.agencyZoneCount ?? null,
    commercialGapZoneCount: mergeMeta?.commercialGapZoneCount ?? crossRef.activeZoneCount,
    glofasGapZoneCount: mergeMeta?.glofasGapZoneCount ?? null,
    suppressedCommercialZoneCount: mergeMeta?.suppressedCommercialZoneCount ?? 0,
    suppressedGlofasZoneCount: mergeMeta?.suppressedGlofasZoneCount ?? null,
    floodBadgeLabel: mergeMeta?.floodBadgeLabel ?? null,
    gridResolutionDeg: layer.meta.gridResolutionDeg ?? null,
    clipBbox: layer.meta.clipBbox ?? parseUrbanFloodClipBbox(),
    sampleZones: crossRef.zoneMatches?.slice(0, 3).map((z) => ({
      zoneId: z.zoneId,
      confidence: z.confidence,
      depthInches: z.depthInches,
      vendor: z.vendor,
      linkedCorridors: z.linkedCorridors,
    })),
    scopeGuard: URBAN_FLOOD_SCOPE_GUARD,
    source: layer.meta.source,
  };
}

export function activeUrbanFloodZones(level, layer = cachedLayer || loadUrbanFloodLayerFile()) {
  if (!isUrbanFloodEnabled()) return [];
  return (layer.collection.features || []).filter(
    (f) => level >= (f.properties?.activeAtLevel ?? 2)
  );
}

export function buildUrbanFloodCrossRef(level = 2) {
  const corridorStatus = getActiveCorridorStatus(level);
  const atRisk = getAtRiskTrips(level);
  const layer = cachedLayer || loadUrbanFloodLayerFile();
  const zones = activeUrbanFloodZones(level, layer);

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
        source: p.source || "commercial",
        confidence: p.confidence || "commercial_model",
        vendor: p.vendor || getUrbanFloodVendor(),
        depthInches: p.depthInches,
        depthBand: p.depthBand,
        returnPeriodYears: p.returnPeriodYears,
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
    phase: "phase-3b-day-7",
    level,
    mode: "commercial_urban_flood",
    enabled: isUrbanFloodEnabled(),
    vendor: getUrbanFloodVendor(),
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
    scopeGuard: URBAN_FLOOD_SCOPE_GUARD,
    ingestedAt: layer.meta.ingestedAt,
    fetchMode: layer.meta.fetchMode,
  };
}

export function buildUrbanFloodSummary(level = 2) {
  const layer = cachedLayer || loadUrbanFloodLayerFile();
  const crossRef = buildUrbanFloodCrossRef(level);

  return {
    ok: true,
    phase: "phase-3b-day-7",
    headline: "Commercial urban flood — fine pluvial guidance for downtown Nassau",
    enabled: isUrbanFloodEnabled(),
    mergeRule: isUrbanFloodEnabled() ? "agency_wins_then_commercial_then_glofas" : "disabled",
    vendorStatus: getUrbanFloodVendorStatus(),
    ...layer.meta,
    ...crossRef,
  };
}

export function ingestUrbanFloodWebhook(payload) {
  if (!payload || !Array.isArray(payload.features)) {
    throw new Error("Urban flood webhook payload must include features array");
  }

  const features = payload.features.map(normalizeFeature);
  cachedLayer = {
    collection: {
      type: "FeatureCollection",
      features,
      scopeGuard: payload.scopeGuard || URBAN_FLOOD_SCOPE_GUARD,
      source: payload.source || "urban_flood_webhook",
      serviceName: payload.serviceName || "urban-flood-vendor",
      vendor: payload.vendor || getUrbanFloodVendor(),
      updatedAt: payload.updatedAt || new Date().toISOString(),
    },
    meta: {
      ok: true,
      source: payload.source || "urban_flood_webhook",
      serviceName: payload.serviceName || "urban-flood-vendor",
      provider: payload.provider || "Commercial urban flood",
      vendor: payload.vendor || getUrbanFloodVendor(),
      featureCount: features.length,
      scopeGuard: payload.scopeGuard || URBAN_FLOOD_SCOPE_GUARD,
      fetchMode: "webhook",
      ingestedAt: new Date().toISOString(),
    },
  };

  return {
    ok: true,
    ingested: features.length,
    source: "urban_flood_webhook",
    vendor: cachedLayer.meta.vendor,
    ingestedAt: cachedLayer.meta.ingestedAt,
  };
}
