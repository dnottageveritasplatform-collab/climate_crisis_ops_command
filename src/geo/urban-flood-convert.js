/** Phase 3b Day 3 — commercial urban flood grid depth → GeoJSON polygon conversion (MVP). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
export const DEFAULT_GRID_PATH = path.join(geoRoot, "urban-flood-grid-nassau-demo.json");
export const DEFAULT_CLIP_PATH = path.join(geoRoot, "urban-flood-nassau-latest.json");

const URBAN_CLIP_BBOX = {
  minLon: -77.34,
  maxLon: -77.3,
  minLat: 25.04,
  maxLat: 25.08,
};

function parseClipBbox(raw = process.env.URBAN_FLOOD_CLIP_BBOX) {
  if (!raw) return { ...URBAN_CLIP_BBOX };
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return { ...URBAN_CLIP_BBOX };
  const [minLon, maxLon, minLat, maxLat] = parts;
  return { minLon, maxLon, minLat, maxLat };
}

export const DEFAULT_DEPTH_THRESHOLDS = {
  minorInches: 4,
  moderateInches: 8,
  majorInches: 12,
};

export function depthInchesToDepthBand(depthInches, thresholds = DEFAULT_DEPTH_THRESHOLDS) {
  if (depthInches >= thresholds.majorInches) return "major";
  if (depthInches >= thresholds.moderateInches) return "moderate";
  if (depthInches >= thresholds.minorInches) return "minor";
  return null;
}

export function depthInchesToReturnPeriodYears(depthInches, thresholds = DEFAULT_DEPTH_THRESHOLDS) {
  const band = depthInchesToDepthBand(depthInches, thresholds);
  if (band === "major") return 10;
  if (band === "moderate") return 10;
  if (band === "minor") return 5;
  return null;
}

export function gridCellPolygon(centerLon, centerLat, resolutionDeg = 0.001) {
  const half = resolutionDeg / 2;
  const minLon = centerLon - half;
  const maxLon = centerLon + half;
  const minLat = centerLat - half;
  const maxLat = centerLat + half;
  return [
    [
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ],
  ];
}

/** Urban core corridor inference — Bay Street / Shirley Street → CORR-02. */
export function inferUrbanLinkedCorridors(lon, lat) {
  if (lon >= -77.332 && lat >= 25.058) return ["CORR-02"];
  if (lon >= -77.328 && lat <= 25.057) return ["CORR-02"];
  return ["CORR-02"];
}

function inClipBbox(lon, lat, bbox) {
  return lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat;
}

export function convertUrbanFloodGridToFeatures(grid, { minDepthInches, vendor } = {}) {
  const bbox = grid.clipBbox || parseClipBbox();
  const resolution = grid.gridResolutionDeg ?? 0.001;
  const thresholds = { ...DEFAULT_DEPTH_THRESHOLDS, ...(grid.thresholds || {}) };
  const floor = minDepthInches ?? grid.depthThresholdInches ?? thresholds.minorInches;
  const gridVendor = vendor || grid.vendor || "demo";

  const features = (grid.cells || [])
    .filter((cell) => inClipBbox(cell.lon, cell.lat, bbox))
    .filter((cell) => cell.depthInches >= floor)
    .map((cell, index) => {
      const depthBand = depthInchesToDepthBand(cell.depthInches, thresholds);
      const returnPeriodYears =
        cell.returnPeriodYears ?? depthInchesToReturnPeriodYears(cell.depthInches, thresholds);
      const linkedCorridors = cell.linkedCorridors || inferUrbanLinkedCorridors(cell.lon, cell.lat);
      return {
        type: "Feature",
        properties: {
          id: cell.id || `URBAN-GRID-${String(index + 1).padStart(2, "0")}`,
          name: cell.name || `Urban pluvial cell · ${depthBand} (${cell.depthInches}" depth)`,
          source: "commercial",
          confidence: "commercial_model",
          vendor: gridVendor,
          depthInches: cell.depthInches,
          depthBand,
          returnPeriodYears,
          linkedCorridors,
          activeAtLevel: cell.activeAtLevel ?? 2,
          gridLon: cell.lon,
          gridLat: cell.lat,
        },
        geometry: {
          type: "Polygon",
          coordinates: gridCellPolygon(cell.lon, cell.lat, resolution),
        },
      };
    });

  return {
    type: "FeatureCollection",
    scopeGuard:
      grid.scopeGuard ||
      "Commercial urban grid conversion — commercial_model confidence only; not agency field hydrology.",
    source: grid.source || "urban_flood_grid",
    serviceName: grid.serviceName || "urban-flood-vendor-grid",
    provider: grid.provider || "Commercial urban flood (grid converted)",
    vendor: gridVendor,
    updatedAt: new Date().toISOString(),
    clipBbox: bbox,
    gridResolutionDeg: resolution,
    depthThresholdInches: floor,
    features,
  };
}

export function loadUrbanFloodGridFile(filePath = process.env.URBAN_FLOOD_GRID_PATH || DEFAULT_GRID_PATH) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return { grid: raw, gridPath: filePath };
}

export function convertUrbanFloodGridFile({
  gridPath = process.env.URBAN_FLOOD_GRID_PATH || DEFAULT_GRID_PATH,
  clipPath = process.env.URBAN_FLOOD_CLIP_PATH || DEFAULT_CLIP_PATH,
  vendor,
} = {}) {
  const { grid } = loadUrbanFloodGridFile(gridPath);
  const collection = convertUrbanFloodGridToFeatures(grid, { vendor });
  const dir = path.dirname(clipPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(clipPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  return {
    ok: true,
    gridPath,
    clipPath,
    featureCount: collection.features.length,
    filteredBelowThreshold: (grid.cells?.length || 0) - collection.features.length,
    fetchMode: "vendor_grid_converted",
    conversionPending: false,
    vendor: collection.vendor,
    collection,
  };
}

/** Roadmap alias — vendor export / grid sidecar → clipped GeoJSON. */
export const convertUrbanFloodExport = convertUrbanFloodGridFile;
