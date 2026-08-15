/** Phase 2 Day 12 — flood-depth / hazard exposure GIS overlay (pilot read-only). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAtRiskTrips } from "../dispatch/index.js";
import { getActiveCorridorStatus } from "./esri.js";
import {
  activeGlofasZones,
  isGlofasEnabled,
  loadGlofasLayer,
  mergeGlofasGapFill,
  normalizeAgencyFeature,
} from "./glofas.js";
import {
  activeUrbanFloodZones,
  isUrbanFloodEnabled,
  loadUrbanFloodLayer,
} from "./urban-flood.js";

export const FLOOD_HAZARD_SCOPE_GUARD =
  "Pilot flood-depth GIS overlay — read-only hazard polygons for situational awareness; not hydrology authority or automated road closure.";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultDemoPath = path.join(geoRoot, "flood-depth-demo.json");

const MAP = {
  viewBox: { width: 800, height: 480 },
  bbox: { minLon: -77.36, maxLon: -77.24, minLat: 25.03, maxLat: 25.10 },
};

let cachedLayer = null;

function project(lon, lat) {
  const { bbox, viewBox } = MAP;
  const x = ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * viewBox.width;
  const y = viewBox.height - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * viewBox.height;
  return { x: Math.round(x), y: Math.round(y) };
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
    return { fill: "rgba(2, 132, 199, 0.32)", stroke: "#0284c7", opacity: 0.85 };
  }
  if (band === "moderate") {
    return { fill: "rgba(14, 165, 233, 0.24)", stroke: "#0ea5e9", opacity: 0.8 };
  }
  return { fill: "rgba(56, 189, 248, 0.16)", stroke: "#38bdf8", opacity: 0.75 };
}

/** Phase 3b Day 5 — commercial urban pluvial map styling (dotted violet). */
function commercialDepthStyle(band) {
  if (band === "major") {
    return { fill: "rgba(124, 58, 237, 0.30)", stroke: "#7c3aed", opacity: 0.88 };
  }
  if (band === "moderate") {
    return { fill: "rgba(139, 92, 246, 0.22)", stroke: "#8b5cf6", opacity: 0.85 };
  }
  return { fill: "rgba(167, 139, 250, 0.18)", stroke: "#a78bfa", opacity: 0.82 };
}

function loadFloodDepthFile() {
  const filePath = process.env.FLOOD_DEPTH_PATH || defaultDemoPath;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const features = (raw.features || []).map(normalizeAgencyFeature);
  return {
    collection: { ...raw, features },
    meta: {
      ok: true,
      source: raw.source || "demo_json",
      serviceName: raw.serviceName || "pilot-flood-depth-demo",
      featureCount: features.length,
      scopeGuard: raw.scopeGuard || FLOOD_HAZARD_SCOPE_GUARD,
      ingestedAt: new Date().toISOString(),
    },
  };
}

export function loadFloodDepthLayer({ refresh = false } = {}) {
  if (cachedLayer && !refresh) return cachedLayer;
  cachedLayer = loadFloodDepthFile();
  return cachedLayer;
}

function agencyActiveZones(level) {
  const { collection } = loadFloodDepthLayer();
  return (collection.features || []).filter(
    (f) => level >= (f.properties?.activeAtLevel ?? 2)
  );
}

function corridorsFromFeatures(features) {
  const corridors = new Set();
  for (const f of features) {
    for (const c of f.properties?.linkedCorridors || []) corridors.add(c);
  }
  return corridors;
}

function normalizeCommercialFeature(feature) {
  const p = feature.properties || {};
  return {
    ...feature,
    properties: {
      ...p,
      source: p.source || "commercial",
      confidence: p.confidence || "commercial_model",
    },
  };
}

function filterGapFill(features, blockCorridors, suppressReason) {
  const gapFill = [];
  const suppressed = [];
  for (const f of features) {
    const linked = f.properties?.linkedCorridors || [];
    const blocked = linked.length && linked.every((c) => blockCorridors.has(c));
    if (blocked) {
      suppressed.push({
        zoneId: f.properties?.id,
        name: f.properties?.name,
        linkedCorridors: linked,
        reason: suppressReason,
      });
      continue;
    }
    gapFill.push(f);
  }
  return { gapFill, suppressed };
}

/** Agency → commercial urban → GloFAS gap-fill (Phase 3b Day 4). */
export function mergeUrbanCommercialGapFill(agencyFeatures, commercialFeatures, glofasFeatures = []) {
  const agencyCorridors = corridorsFromFeatures(agencyFeatures);
  const { gapFill: commercialGap, suppressed: suppressedCommercial } = filterGapFill(
    commercialFeatures,
    agencyCorridors,
    "agency_corridor_override"
  );
  const commercialCorridors = corridorsFromFeatures(commercialGap);
  const glofasBlock = new Set([...agencyCorridors, ...commercialCorridors]);
  const { gapFill: glofasGap, suppressed: suppressedGlofas } = filterGapFill(
    glofasFeatures,
    glofasBlock,
    "commercial_or_agency_corridor_override"
  );

  const normalizedAgency = agencyFeatures.map(normalizeAgencyFeature);
  const normalizedCommercial = commercialGap.map(normalizeCommercialFeature);
  const normalizedGlofas = glofasGap.map((f) => {
    const p = f.properties || {};
    return {
      ...f,
      properties: {
        ...p,
        source: p.source || "glofas",
        confidence: p.confidence || "model_estimated",
      },
    };
  });

  return {
    features: [...normalizedAgency, ...normalizedCommercial, ...normalizedGlofas],
    mergeRule: "agency_wins_then_commercial_then_glofas",
    agencyZoneCount: normalizedAgency.length,
    commercialGapZoneCount: normalizedCommercial.length,
    glofasGapZoneCount: normalizedGlofas.length,
    suppressedCommercialZoneCount: suppressedCommercial.length,
    suppressedGlofasZoneCount: suppressedGlofas.length,
    suppressedCommercialZones: suppressedCommercial,
    suppressedGlofasZones: suppressedGlofas,
    floodBadgeLabel: `${normalizedAgency.length} agency + ${normalizedGlofas.length} glofas + ${normalizedCommercial.length} urban zone(s)`,
  };
}

function mergeFloodStack(level) {
  const agency = agencyActiveZones(level);
  const urbanOn = isUrbanFloodEnabled();
  const glofasOn = isGlofasEnabled();

  if (!urbanOn && !glofasOn) {
    return {
      features: agency,
      mergeRule: "agency_only",
      agencyZoneCount: agency.length,
      commercialGapZoneCount: 0,
      glofasGapZoneCount: 0,
      suppressedCommercialZoneCount: 0,
      suppressedGlofasZoneCount: 0,
      suppressedCommercialZones: [],
      suppressedGlofasZones: [],
      floodBadgeLabel: `${agency.length} flood zone(s)`,
    };
  }

  if (urbanOn && glofasOn) {
    const commercial = activeUrbanFloodZones(level, loadUrbanFloodLayer());
    const glofas = activeGlofasZones(level, loadGlofasLayer());
    return mergeUrbanCommercialGapFill(agency, commercial, glofas);
  }

  if (urbanOn) {
    const commercial = activeUrbanFloodZones(level, loadUrbanFloodLayer());
    return mergeUrbanCommercialGapFill(agency, commercial, []);
  }

  return mergeGlofasGapFill(agency, activeGlofasZones(level, loadGlofasLayer()));
}

let cachedMergeMeta = null;

function activeZones(level) {
  const merged = mergeFloodStack(level);
  cachedMergeMeta = merged;
  return merged.features;
}

/** Prefer agency_confirmed, then commercial_model, then model_estimated for a corridor. */
export function resolveFloodZoneForCorridor(zoneMatches, corridor) {
  const matches = (zoneMatches || []).filter((z) =>
    (z.linkedCorridors || []).includes(corridor)
  );
  return (
    matches.find((z) => z.confidence === "agency_confirmed") ||
    matches.find((z) => z.confidence === "commercial_model") ||
    matches.find((z) => z.confidence === "model_estimated") ||
    matches[0] ||
    null
  );
}

export function getFloodMergeMeta() {
  return cachedMergeMeta;
}

/** Merge counts + badge for urban_flood_sync / Monitor tool (Phase 3b Day 6). */
export function buildFloodMergeSnapshot(level = 2) {
  buildFloodHazardCrossRef(level);
  const meta = getFloodMergeMeta();
  if (!meta) return null;
  return {
    mergeRule: meta.mergeRule,
    agencyZoneCount: meta.agencyZoneCount,
    commercialGapZoneCount: meta.commercialGapZoneCount,
    glofasGapZoneCount: meta.glofasGapZoneCount,
    suppressedCommercialZoneCount: meta.suppressedCommercialZoneCount,
    suppressedGlofasZoneCount: meta.suppressedGlofasZoneCount,
    floodBadgeLabel: meta.floodBadgeLabel,
  };
}

/** SVG-ready flood polygons for command map underlay. */
function floodZoneMapLabel(p) {
  const isGlofas = p.source === "glofas" || p.confidence === "model_estimated";
  const isCommercial = p.confidence === "commercial_model" || p.source === "commercial";
  if (isGlofas) {
    if (p.returnPeriodYears != null) {
      return { text: `~${p.returnPeriodYears}yr`, kind: "return_period" };
    }
    return { text: "model", kind: "model" };
  }
  if (isCommercial) {
    if (p.depthInches != null) {
      return { text: `${p.depthInches}"`, kind: "depth" };
    }
    return { text: "urban model", kind: "commercial_model" };
  }
  if (p.depthInches != null) {
    return { text: `${p.depthInches}"`, kind: "depth" };
  }
  return { text: p.depthBand || "flood", kind: "depth" };
}

function zoneConfidence(z) {
  return z.confidence ?? z.properties?.confidence;
}

export function buildFloodMapBadge(zones, level = 2) {
  const agencyZoneCount = zones.filter((z) => zoneConfidence(z) === "agency_confirmed").length;
  const glofasGapZoneCount = zones.filter((z) => zoneConfidence(z) === "model_estimated").length;
  const commercialGapZoneCount = zones.filter((z) => zoneConfidence(z) === "commercial_model").length;
  const glofasEnabled = isGlofasEnabled();
  const urbanEnabled = isUrbanFloodEnabled();
  let badgeLabel;
  if (urbanEnabled && glofasEnabled) {
    badgeLabel = `${agencyZoneCount} agency + ${glofasGapZoneCount} glofas + ${commercialGapZoneCount} urban zone(s)`;
  } else if (glofasEnabled) {
    badgeLabel = `${agencyZoneCount} agency + ${glofasGapZoneCount} glofas zone(s)`;
  } else if (urbanEnabled) {
    badgeLabel = `${agencyZoneCount} agency + ${commercialGapZoneCount} urban zone(s)`;
  } else {
    badgeLabel = `${zones.length} flood zone(s)`;
  }
  return {
    agencyZoneCount,
    glofasGapZoneCount,
    commercialGapZoneCount,
    totalCount: zones.length,
    glofasEnabled,
    urbanEnabled,
    badgeLabel,
    level,
  };
}

export function buildFloodMapOverlay(level = 2, { features } = {}) {
  const zoneFeatures = features ?? activeZones(level);
  return zoneFeatures.map((f) => {
    const p = f.properties || {};
    const isCommercial = p.confidence === "commercial_model" || p.source === "commercial";
    const isModel = p.source === "glofas" || p.confidence === "model_estimated";
    const style = isCommercial ? commercialDepthStyle(p.depthBand) : depthStyle(p.depthBand);
    const ring = f.geometry?.coordinates?.[0] || [];
    const labelPt = project(
      ring[Math.floor(ring.length / 2)]?.[0] ?? -77.31,
      ring[Math.floor(ring.length / 2)]?.[1] ?? 25.05
    );
    const label = floodZoneMapLabel(p);
    const calloutHeadline = (p.name || "Flood zone").split("·")[0].trim().slice(0, 34);
    const calloutDetail = isCommercial
      ? p.depthInches != null
        ? `${p.depthInches}" · urban model`
        : "urban model"
      : isModel
        ? label.text === "model"
          ? "GloFAS model"
          : `GloFAS · ${label.text}`
        : p.depthInches != null
          ? `${p.depthInches}" · agency`
          : "agency confirmed";
    return {
      id: p.id,
      name: p.name,
      source: p.source || "agency",
      confidence: p.confidence || "agency_confirmed",
      depthInches: isModel ? null : p.depthInches,
      depthBand: p.depthBand,
      returnPeriodYears: p.returnPeriodYears ?? null,
      linkedCorridors: p.linkedCorridors || [],
      path: ringToSvgPath(ring),
      label: { x: labelPt.x, y: labelPt.y, text: label.text, kind: label.kind },
      callout: {
        headline: calloutHeadline,
        detail: calloutDetail,
        tone: isCommercial ? "commercial" : isModel ? "glofas" : "agency",
      },
      fill: style.fill,
      stroke: style.stroke,
      opacity: style.opacity,
      strokeDasharray: isModel ? "4 2" : isCommercial ? "1 3" : undefined,
    };
  });
}

export function buildFloodHazardCrossRef(level = 2) {
  const corridorStatus = getActiveCorridorStatus(level);
  const atRisk = getAtRiskTrips(level);
  const zones = activeZones(level);

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
        source: p.source || "agency",
        confidence: p.confidence || "agency_confirmed",
        depthInches: p.depthInches,
        depthBand: p.depthBand,
        linkedCorridors: p.linkedCorridors || [],
        restrictedLinkedCorridors: linked,
        corridorStatus: linked.reduce((acc, id) => ({ ...acc, [id]: corridorStatus[id] }), {}),
      };
    })
    .filter(Boolean);

  const exposedTrips = atRisk.filter((t) =>
    zoneMatches.some((z) => (z.linkedCorridors || []).includes(t.corridor))
  );

  const mergeMeta = getFloodMergeMeta();
  const urbanOn = isUrbanFloodEnabled();
  const glofasOn = isGlofasEnabled();

  return {
    ok: true,
    phase: urbanOn ? "phase-3b-day-7" : glofasOn ? "phase-3-day-10" : "phase-2-day-12",
    level,
    mode: urbanOn && glofasOn
      ? "flood_depth_overlay+urban_commercial+glofas_gap_fill"
      : urbanOn
        ? "flood_depth_overlay+urban_commercial"
        : glofasOn
          ? "flood_depth_overlay+glofas_gap_fill"
          : "flood_depth_overlay",
    glofasEnabled: glofasOn,
    urbanFloodEnabled: urbanOn,
    mergeRule:
      mergeMeta?.mergeRule ||
      (urbanOn ? "agency_wins_then_commercial_then_glofas" : glofasOn ? "agency_wins_corridor" : "agency_only"),
    agencyZoneCount: mergeMeta?.agencyZoneCount ?? zones.filter((f) => f.properties?.confidence === "agency_confirmed").length,
    commercialGapZoneCount: mergeMeta?.commercialGapZoneCount ?? 0,
    glofasGapZoneCount: mergeMeta?.glofasGapZoneCount ?? 0,
    suppressedCommercialZoneCount: mergeMeta?.suppressedCommercialZoneCount ?? 0,
    suppressedGlofasZoneCount: mergeMeta?.suppressedGlofasZoneCount ?? 0,
    suppressedCommercialZones: mergeMeta?.suppressedCommercialZones ?? [],
    suppressedGlofasZones: mergeMeta?.suppressedGlofasZones ?? [],
    floodBadgeLabel: mergeMeta?.floodBadgeLabel ?? null,
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
    matches: zoneMatches,
    scopeGuard: FLOOD_HAZARD_SCOPE_GUARD,
    ingestedAt: loadFloodDepthLayer().meta.ingestedAt,
  };
}

export function buildFloodHazardSummary(level = 2) {
  const layer = loadFloodDepthLayer();
  const crossRef = buildFloodHazardCrossRef(level);
  const urbanOn = isUrbanFloodEnabled();
  const glofasOn = isGlofasEnabled();

  return {
    ok: true,
    phase: urbanOn ? "phase-3b-day-7" : glofasOn ? "phase-3-day-10" : "phase-2-day-12",
    headline: urbanOn && glofasOn
      ? "Flood overlay — agency GIS + commercial urban + GloFAS (agency → commercial → glofas)"
      : urbanOn
        ? "Flood overlay — agency GIS + commercial urban gap-fill"
        : glofasOn
          ? "Flood overlay — agency GIS + GloFAS gap-fill (agency_confirmed wins corridor)"
          : "Flood-depth hazard overlay — read-only GIS exposure polygons",
    glofasEnabled: glofasOn,
    urbanFloodEnabled: urbanOn,
    glofasGapZoneCount: crossRef.glofasGapZoneCount ?? 0,
    commercialGapZoneCount: crossRef.commercialGapZoneCount ?? 0,
    floodBadgeLabel: crossRef.floodBadgeLabel,
    ...layer.meta,
    ...crossRef,
  };
}

export function getFloodHazardStatus() {
  const crossRef = buildFloodHazardCrossRef(2);
  const layer = loadFloodDepthLayer();

  return {
    ok: true,
    phase: crossRef.phase,
    glofasEnabled: crossRef.glofasEnabled,
    urbanFloodEnabled: crossRef.urbanFloodEnabled,
    featureCount: layer.meta.featureCount,
    activeZoneCount: crossRef.activeZoneCount,
    commercialGapZoneCount: crossRef.commercialGapZoneCount ?? 0,
    glofasGapZoneCount: crossRef.glofasGapZoneCount ?? 0,
    suppressedCommercialZoneCount: crossRef.suppressedCommercialZoneCount ?? 0,
    suppressedGlofasZoneCount: crossRef.suppressedGlofasZoneCount ?? 0,
    mergeRule: crossRef.mergeRule,
    floodBadgeLabel: crossRef.floodBadgeLabel,
    corridorLinkedZoneCount: crossRef.corridorLinkedZoneCount,
    tripExposureCount: crossRef.tripExposureCount,
    sampleZones: crossRef.zoneMatches?.slice(0, 3).map((z) => ({
      zoneId: z.zoneId,
      confidence: z.confidence,
      depthInches: z.depthInches,
      linkedCorridors: z.linkedCorridors,
    })),
    scopeGuard: FLOOD_HAZARD_SCOPE_GUARD,
    source: layer.meta.source,
  };
}

export function ingestFloodDepthWebhook(payload) {
  if (!payload || !Array.isArray(payload.features)) {
    throw new Error("Flood depth webhook payload must include features array");
  }

  cachedLayer = {
    collection: {
      type: "FeatureCollection",
      features: payload.features.map(normalizeAgencyFeature),
      scopeGuard: payload.scopeGuard || FLOOD_HAZARD_SCOPE_GUARD,
      source: "webhook",
      serviceName: payload.serviceName || "agency_gis",
      updatedAt: payload.updatedAt || new Date().toISOString(),
    },
    meta: {
      ok: true,
      source: "webhook",
      serviceName: payload.serviceName || "agency_gis",
      featureCount: payload.features.length,
      scopeGuard: payload.scopeGuard || FLOOD_HAZARD_SCOPE_GUARD,
      ingestedAt: new Date().toISOString(),
    },
  };

  return {
    ok: true,
    ingested: payload.features.length,
    source: "webhook",
    ingestedAt: cachedLayer.meta.ingestedAt,
  };
}
