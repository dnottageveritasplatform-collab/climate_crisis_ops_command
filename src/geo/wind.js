/** Phase 2 Day 13 — wind-exposure / gust hazard GIS overlay (pilot read-only). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAtRiskTrips } from "../dispatch/index.js";
import { getActiveCorridorStatus } from "./esri.js";

export const WIND_HAZARD_SCOPE_GUARD =
  "Pilot wind-exposure GIS overlay — read-only gust polygons for situational awareness; not meteorology authority or automated road closure.";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultDemoPath = path.join(geoRoot, "wind-exposure-demo.json");

import { MAP, projectPoint } from "./map-constants.js";

let cachedLayer = null;

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

function windStyle(band) {
  if (band === "hurricane") {
    return { fill: "rgba(168, 85, 247, 0.28)", stroke: "#a855f7", opacity: 0.85 };
  }
  if (band === "strong") {
    return { fill: "rgba(249, 115, 22, 0.24)", stroke: "#f97316", opacity: 0.8 };
  }
  return { fill: "rgba(251, 191, 36, 0.18)", stroke: "#fbbf24", opacity: 0.75 };
}

function loadWindExposureFile() {
  const filePath = process.env.WIND_EXPOSURE_PATH || defaultDemoPath;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return {
    collection: raw,
    meta: {
      ok: true,
      source: raw.source || "demo_json",
      serviceName: raw.serviceName || "pilot-wind-exposure-demo",
      featureCount: raw.features?.length || 0,
      scopeGuard: raw.scopeGuard || WIND_HAZARD_SCOPE_GUARD,
      ingestedAt: new Date().toISOString(),
    },
  };
}

export function loadWindExposureLayer({ refresh = false } = {}) {
  if (cachedLayer && !refresh) return cachedLayer;
  cachedLayer = loadWindExposureFile();
  return cachedLayer;
}

function activeZones(level) {
  const { collection } = loadWindExposureLayer();
  return (collection.features || []).filter(
    (f) => level >= (f.properties?.activeAtLevel ?? 2)
  );
}

/** SVG-ready wind-exposure polygons for command map underlay. */
export function buildWindMapOverlay(level = 2) {
  return activeZones(level).map((f) => {
    const p = f.properties || {};
    const style = windStyle(p.windBand);
    const ring = f.geometry?.coordinates?.[0] || [];
    const labelPt = project(
      ring[Math.floor(ring.length / 2)]?.[0] ?? -77.31,
      ring[Math.floor(ring.length / 2)]?.[1] ?? 25.05
    );
    return {
      id: p.id,
      name: p.name,
      gustMph: p.gustMph,
      windBand: p.windBand,
      linkedCorridors: p.linkedCorridors || [],
      ring,
      tier: p.windBand,
      path: ringToSvgPath(ring),
      label: { x: labelPt.x, y: labelPt.y, text: `${p.gustMph}mph` },
      ...style,
    };
  });
}

export function buildWindHazardCrossRef(level = 2) {
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
        gustMph: p.gustMph,
        windBand: p.windBand,
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
    phase: "phase-2-day-13",
    level,
    mode: "wind_exposure_overlay",
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
    scopeGuard: WIND_HAZARD_SCOPE_GUARD,
    ingestedAt: loadWindExposureLayer().meta.ingestedAt,
  };
}

export function buildWindHazardSummary(level = 2) {
  const layer = loadWindExposureLayer();
  const crossRef = buildWindHazardCrossRef(level);

  return {
    ok: true,
    phase: "phase-2-day-13",
    headline: "Wind-exposure hazard overlay — read-only GIS gust polygons",
    ...layer.meta,
    ...crossRef,
  };
}

export function getWindHazardStatus() {
  const crossRef = buildWindHazardCrossRef(2);
  const layer = loadWindExposureLayer();

  return {
    ok: true,
    phase: "phase-2-day-13",
    featureCount: layer.meta.featureCount,
    activeZoneCount: crossRef.activeZoneCount,
    corridorLinkedZoneCount: crossRef.corridorLinkedZoneCount,
    tripExposureCount: crossRef.tripExposureCount,
    sampleZones: crossRef.zoneMatches?.slice(0, 3).map((z) => ({
      zoneId: z.zoneId,
      gustMph: z.gustMph,
      windBand: z.windBand,
      linkedCorridors: z.linkedCorridors,
    })),
    scopeGuard: WIND_HAZARD_SCOPE_GUARD,
    source: layer.meta.source,
  };
}

export function ingestWindExposureWebhook(payload) {
  if (!payload || !Array.isArray(payload.features)) {
    throw new Error("Wind exposure webhook payload must include features array");
  }

  cachedLayer = {
    collection: {
      type: "FeatureCollection",
      features: payload.features,
      scopeGuard: payload.scopeGuard || WIND_HAZARD_SCOPE_GUARD,
      source: "webhook",
      serviceName: payload.serviceName || "agency_gis",
      updatedAt: payload.updatedAt || new Date().toISOString(),
    },
    meta: {
      ok: true,
      source: "webhook",
      serviceName: payload.serviceName || "agency_gis",
      featureCount: payload.features.length,
      scopeGuard: payload.scopeGuard || WIND_HAZARD_SCOPE_GUARD,
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
