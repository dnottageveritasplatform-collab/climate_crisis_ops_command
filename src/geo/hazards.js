/** Phase 2 Day 12 — flood-depth / hazard exposure GIS overlay (pilot read-only). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAtRiskTrips } from "../dispatch/index.js";
import { getActiveCorridorStatus } from "./esri.js";

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

function loadFloodDepthFile() {
  const filePath = process.env.FLOOD_DEPTH_PATH || defaultDemoPath;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return {
    collection: raw,
    meta: {
      ok: true,
      source: raw.source || "demo_json",
      serviceName: raw.serviceName || "pilot-flood-depth-demo",
      featureCount: raw.features?.length || 0,
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

function activeZones(level) {
  const { collection } = loadFloodDepthLayer();
  return (collection.features || []).filter(
    (f) => level >= (f.properties?.activeAtLevel ?? 2)
  );
}

/** SVG-ready flood polygons for command map underlay. */
export function buildFloodMapOverlay(level = 2) {
  return activeZones(level).map((f) => {
    const p = f.properties || {};
    const style = depthStyle(p.depthBand);
    const ring = f.geometry?.coordinates?.[0] || [];
    const labelPt = project(
      ring[Math.floor(ring.length / 2)]?.[0] ?? -77.31,
      ring[Math.floor(ring.length / 2)]?.[1] ?? 25.05
    );
    return {
      id: p.id,
      name: p.name,
      depthInches: p.depthInches,
      depthBand: p.depthBand,
      linkedCorridors: p.linkedCorridors || [],
      path: ringToSvgPath(ring),
      label: { x: labelPt.x, y: labelPt.y, text: `${p.depthInches}"` },
      ...style,
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

  return {
    ok: true,
    phase: "phase-2-day-12",
    level,
    mode: "flood_depth_overlay",
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

  return {
    ok: true,
    phase: "phase-2-day-12",
    headline: "Flood-depth hazard overlay — read-only GIS exposure polygons",
    ...layer.meta,
    ...crossRef,
  };
}

export function getFloodHazardStatus() {
  const crossRef = buildFloodHazardCrossRef(2);
  const layer = loadFloodDepthLayer();

  return {
    ok: true,
    phase: "phase-2-day-12",
    featureCount: layer.meta.featureCount,
    activeZoneCount: crossRef.activeZoneCount,
    corridorLinkedZoneCount: crossRef.corridorLinkedZoneCount,
    tripExposureCount: crossRef.tripExposureCount,
    sampleZones: crossRef.zoneMatches?.slice(0, 3).map((z) => ({
      zoneId: z.zoneId,
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
      features: payload.features,
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
