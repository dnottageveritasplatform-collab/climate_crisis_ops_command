/** Phase 2 Day 6 — ESRI / ArcGIS corridor feature service adapter (pilot stub). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const ESRI_CORRIDOR_SCOPE_GUARD =
  "Pilot ESRI corridor layer — replaces static GeoJSON when agency provides feature service; read-only closure overlay.";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultDemoPath = path.join(geoRoot, "esri-corridors-demo.json");

let cachedLayer = null;

function staticCorridorStatus(level) {
  if (level >= 3) return { "CORR-01": "closed", "CORR-02": "closed" };
  if (level >= 2) return { "CORR-01": "open", "CORR-02": "restricted" };
  return { "CORR-01": "open", "CORR-02": "open" };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/** Normalize ESRI FeatureServer JSON → GeoJSON FeatureCollection. */
export function normalizeEsriCorridors(esriPayload) {
  const features = (esriPayload.features || []).map((f) => {
    const attrs = f.attributes || f.properties || {};
    const paths = f.geometry?.paths?.[0] || f.geometry?.coordinates || [];
    const coords = paths.map(([lon, lat]) => [Number(lon), Number(lat)]);
    return {
      type: "Feature",
      properties: {
        id: attrs.id,
        name: attrs.name,
        floodRisk: attrs.floodRisk,
        status: attrs.status || "open",
        restrictedAtLevel: attrs.restrictedAtLevel ?? null,
        closedAtLevel: attrs.closedAtLevel ?? null,
        agency: attrs.agency || "pilot_gis",
        layerSource: attrs.layerSource || "esri",
        objectId: attrs.OBJECTID,
      },
      geometry: { type: "LineString", coordinates: coords },
    };
  });

  return {
    type: "FeatureCollection",
    metadata: {
      source: esriPayload.source || "esri_feature_service",
      serviceName: esriPayload.serviceName,
      updatedAt: esriPayload.updatedAt,
      scopeGuard: esriPayload.scopeGuard || ESRI_CORRIDOR_SCOPE_GUARD,
    },
    features,
  };
}

function useStaticGeoJson() {
  return process.env.ESRI_USE_STATIC === "true";
}

/** Load corridor layer — ESRI demo/file by default; static GeoJSON fallback. */
export function loadCorridorLayer({ refresh = false } = {}) {
  if (cachedLayer && !refresh) return cachedLayer;

  if (useStaticGeoJson()) {
    const staticCollection = readJson(path.join(geoRoot, "corridors.json"));
    cachedLayer = {
      collection: staticCollection,
      meta: {
        ok: true,
        phase: "phase-2-day-6",
        source: "static_geojson",
        adapter: "geojson",
        featureCount: staticCollection.features?.length || 0,
        scopeGuard: "Static GeoJSON corridors (ESRI_USE_STATIC=true)",
        ingestedAt: new Date().toISOString(),
      },
    };
    return cachedLayer;
  }

  const filePath = process.env.ESRI_CORRIDOR_PATH || defaultDemoPath;
  const configuredUrl = process.env.ESRI_CORRIDOR_URL || null;
  const esriPayload = readJson(filePath);
  const collection = normalizeEsriCorridors(esriPayload);

  cachedLayer = {
    collection,
    meta: {
      ok: true,
      phase: "phase-2-day-6",
      source: "esri_feature_service",
      adapter: configuredUrl ? "rest" : "demo_json",
      configuredUrl,
      serviceName: esriPayload.serviceName,
      featureCount: collection.features.length,
      agency: collection.features[0]?.properties?.agency,
      scopeGuard: ESRI_CORRIDOR_SCOPE_GUARD,
      ingestedAt: new Date().toISOString(),
    },
  };
  return cachedLayer;
}

/** Corridor status from ESRI feature attributes (restrictedAtLevel / closedAtLevel). */
export function corridorStatusFromLayer(collection, level = 2) {
  const status = {};
  for (const f of collection.features || []) {
    const p = f.properties || {};
    const id = p.id;
    if (!id) continue;
    if (p.closedAtLevel != null && level >= p.closedAtLevel) {
      status[id] = "closed";
    } else if (p.restrictedAtLevel != null && level >= p.restrictedAtLevel) {
      status[id] = "restricted";
    } else {
      status[id] = p.status || "open";
    }
  }
  return status;
}

/** Active corridor status — ESRI layer when loaded, else sprint static rules. */
export function getActiveCorridorStatus(level = 2) {
  const layer = loadCorridorLayer();
  if (layer.meta.source === "esri_feature_service") {
    return corridorStatusFromLayer(layer.collection, level);
  }
  return staticCorridorStatus(level);
}

export function getCorridorLayerMeta() {
  return loadCorridorLayer().meta;
}

export function buildEsriCorridorSummary(level = 2) {
  const layer = loadCorridorLayer();
  const status = getActiveCorridorStatus(level);
  return {
    ok: true,
    phase: "phase-2-day-6",
    level,
    ...layer.meta,
    corridorStatus: status,
    corridors: layer.collection.features.map((f) => ({
      id: f.properties.id,
      name: f.properties.name,
      status: status[f.properties.id],
      floodRisk: f.properties.floodRisk,
      layerSource: f.properties.layerSource,
    })),
  };
}

export function ingestEsriCorridorWebhook(payload) {
  if (!payload?.features?.length) {
    throw new Error("ESRI webhook payload must include features array");
  }
  const collection = normalizeEsriCorridors(payload);
  cachedLayer = {
    collection,
    meta: {
      ok: true,
      phase: "phase-2-day-6",
      source: "esri_feature_service",
      adapter: "webhook",
      featureCount: collection.features.length,
      scopeGuard: ESRI_CORRIDOR_SCOPE_GUARD,
      ingestedAt: new Date().toISOString(),
    },
  };
  return {
    ok: true,
    ingested: collection.features.length,
    source: "webhook",
    ingestedAt: cachedLayer.meta.ingestedAt,
  };
}
