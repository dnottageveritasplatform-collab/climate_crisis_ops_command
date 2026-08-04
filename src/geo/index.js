import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { corridorStatusForLevel, getAtRiskTrips, loadDispatch } from "../dispatch/index.js";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");

const MAP = {
  viewBox: { width: 800, height: 480 },
  bbox: { minLon: -77.36, maxLon: -77.24, minLat: 25.03, maxLat: 25.10 },
};

function readGeo(file) {
  return JSON.parse(fs.readFileSync(path.join(geoRoot, file), "utf8"));
}

/** Load static GeoJSON corridor + facility layers. */
export function loadGeoLayers() {
  return {
    corridors: readGeo("corridors.json"),
    facilities: readGeo("facilities.json"),
  };
}

function project(lon, lat) {
  const { bbox, viewBox } = MAP;
  const x = ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * viewBox.width;
  const y = viewBox.height - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * viewBox.height;
  return { x: Math.round(x), y: Math.round(y) };
}

function corridorColor(status) {
  if (status === "closed") return "#ff6b6b";
  if (status === "restricted") return "#ffb347";
  return "#5fd4a4";
}

/** Build map payload with projected SVG-ready layers for the command UI. */
export function buildMapLayers(level = 2) {
  const { corridors, facilities } = loadGeoLayers();
  const corridorStatus = corridorStatusForLevel(level);
  const atRiskIds = new Set(getAtRiskTrips(level).map((t) => t.id));
  const trips = loadDispatch();

  const projectedCorridors = corridors.features.map((f) => {
    const id = f.properties.id;
    const status = corridorStatus[id] || f.properties.status || "open";
    const coords = f.geometry.coordinates.map(([lon, lat]) => project(lon, lat));
    return {
      id,
      name: f.properties.name,
      status,
      color: corridorColor(status),
      svg: {
        x1: coords[0].x,
        y1: coords[0].y,
        x2: coords[1].x,
        y2: coords[1].y,
        dash: status === "restricted" ? "8 4" : undefined,
      },
    };
  });

  const projectedFacilities = facilities.features.map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const pt = project(lon, lat);
    const role = f.properties.role;
    return {
      id: f.properties.id,
      name: f.properties.name,
      role,
      color: role === "hospital_partner" ? "#ff6b6b" : "#00abc9",
      svg: { x: pt.x, y: pt.y, r: role === "hospital_partner" ? 12 : 10 },
    };
  });

  const projectedTrips = trips.map((t) => {
    const pt = project(t.pickupLon, t.pickupLat);
    const atRisk = atRiskIds.has(t.id);
    return {
      id: t.id,
      priority: t.priority,
      pickup: t.pickup,
      corridor: t.corridor,
      atRisk,
      color: atRisk ? "#ffc72c" : "#7f8f9f",
      svg: { x: pt.x, y: pt.y, r: atRisk ? 6 : 4 },
    };
  });

  const atRiskPts = projectedTrips.filter((t) => t.atRisk).map((t) => t.svg);
  const zone = atRiskPts.length
    ? {
        cx: Math.round(atRiskPts.reduce((s, p) => s + p.x, 0) / atRiskPts.length),
        cy: Math.round(atRiskPts.reduce((s, p) => s + p.y, 0) / atRiskPts.length),
        rx: 140,
        ry: 70,
      }
    : { cx: 400, cy: 270, rx: 140, ry: 70 };

  return {
    ok: true,
    level,
    demo: true,
    serviceArea: "New Providence · DEMO",
    viewBox: `0 0 ${MAP.viewBox.width} ${MAP.viewBox.height}`,
    bbox: MAP.bbox,
    zone,
    corridors: projectedCorridors,
    facilities: projectedFacilities,
    trips: projectedTrips,
    atRiskCount: atRiskIds.size,
    corridorStatus,
  };
}

export { MAP };
