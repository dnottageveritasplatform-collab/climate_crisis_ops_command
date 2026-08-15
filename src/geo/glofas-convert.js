/** Phase 3 Day 3 — GloFAS grid discharge → GeoJSON polygon conversion (MVP). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
export const DEFAULT_GRID_PATH = path.join(geoRoot, "glofas-grid-nassau-demo.json");
export const DEFAULT_CLIP_PATH = path.join(geoRoot, "glofas-nassau-latest.json");

const NASSAU_CLIP_BBOX = {
  minLon: -77.36,
  maxLon: -77.24,
  minLat: 25.03,
  maxLat: 25.10,
};

function parseClipBbox(raw = process.env.GLOFAS_CLIP_BBOX) {
  if (!raw) return { ...NASSAU_CLIP_BBOX };
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return { ...NASSAU_CLIP_BBOX };
  const [minLon, maxLon, minLat, maxLat] = parts;
  return { minLon, maxLon, minLat, maxLat };
}

export const DEFAULT_DISCHARGE_THRESHOLDS = {
  minorM3s: 75,
  moderateM3s: 120,
  majorM3s: 180,
};

export function dischargeToDepthBand(dischargeM3s, thresholds = DEFAULT_DISCHARGE_THRESHOLDS) {
  if (dischargeM3s >= thresholds.majorM3s) return "major";
  if (dischargeM3s >= thresholds.moderateM3s) return "moderate";
  if (dischargeM3s >= thresholds.minorM3s) return "minor";
  return null;
}

export function dischargeToReturnPeriodYears(dischargeM3s, thresholds = DEFAULT_DISCHARGE_THRESHOLDS) {
  const band = dischargeToDepthBand(dischargeM3s, thresholds);
  if (band === "major") return 10;
  if (band === "moderate") return 5;
  if (band === "minor") return 2;
  return null;
}

export function gridCellPolygon(centerLon, centerLat, resolutionDeg = 0.05) {
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

export function inferLinkedCorridors(lon, lat) {
  if (lon >= -77.30 && lat <= 25.06) return ["CORR-02"];
  if (lat >= 25.06 || lon <= -77.33) return ["CORR-01"];
  return ["CORR-02"];
}

function inClipBbox(lon, lat, bbox) {
  return lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat;
}

export function convertGlofasGridToFeatures(grid, { minDischargeM3s } = {}) {
  const bbox = grid.clipBbox || parseClipBbox();
  const resolution = grid.gridResolutionDeg ?? 0.05;
  const thresholds = { ...DEFAULT_DISCHARGE_THRESHOLDS, ...(grid.thresholds || {}) };
  const floor = minDischargeM3s ?? grid.dischargeThresholdM3s ?? thresholds.minorM3s;

  const features = (grid.cells || [])
    .filter((cell) => inClipBbox(cell.lon, cell.lat, bbox))
    .filter((cell) => cell.dischargeM3s >= floor)
    .map((cell, index) => {
      const depthBand = dischargeToDepthBand(cell.dischargeM3s, thresholds);
      const returnPeriodYears =
        cell.returnPeriodYears ?? dischargeToReturnPeriodYears(cell.dischargeM3s, thresholds);
      const linkedCorridors = cell.linkedCorridors || inferLinkedCorridors(cell.lon, cell.lat);
      return {
        type: "Feature",
        properties: {
          id: cell.id || `GLOFAS-GRID-${String(index + 1).padStart(2, "0")}`,
          name: cell.name || `GloFAS grid cell · ${depthBand} discharge`,
          source: "glofas",
          confidence: "model_estimated",
          dischargeM3s: cell.dischargeM3s,
          dischargePercentile: cell.percentile ?? null,
          returnPeriodYears,
          depthBand,
          depthInches: null,
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
    scopeGuard: grid.scopeGuard || "GloFAS grid conversion — model_estimated confidence only",
    source: grid.source || "glofas_grid",
    serviceName: grid.serviceName || "cems-glofas-forecast-grid",
    provider: grid.provider || "Copernicus EMS GloFAS",
    updatedAt: new Date().toISOString(),
    clipBbox: bbox,
    gridResolutionDeg: resolution,
    dischargeThresholdM3s: floor,
    features,
  };
}

export function loadGlofasGridFile(filePath = process.env.GLOFAS_GRID_PATH || DEFAULT_GRID_PATH) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return { grid: raw, gridPath: filePath };
}

export function convertGlofasGridFile({
  gridPath = process.env.GLOFAS_GRID_PATH || DEFAULT_GRID_PATH,
  clipPath = process.env.GLOFAS_CLIP_PATH || DEFAULT_CLIP_PATH,
} = {}) {
  const { grid } = loadGlofasGridFile(gridPath);
  const collection = convertGlofasGridToFeatures(grid);
  const dir = path.dirname(clipPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(clipPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  return {
    ok: true,
    gridPath,
    clipPath,
    featureCount: collection.features.length,
    filteredBelowThreshold: (grid.cells?.length || 0) - collection.features.length,
    fetchMode: "cds_grid_converted",
    conversionPending: false,
    collection,
  };
}
