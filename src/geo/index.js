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

/** Simplified New Providence + Paradise Island landmass for map underlay. */
export function buildIslandOverlay() {
  const collection = readGeo("new-providence.json");
  return collection.features.map((f) => {
    const labelPt = project(
      f.properties.id === "NP-PARADISE" ? -77.292 : -77.295,
      f.properties.id === "NP-PARADISE" ? 25.092 : 25.055
    );
    return {
      id: f.properties.id,
      name: f.properties.name,
      kind: f.properties.kind,
      path: ringToSvgPath(f.geometry.coordinates[0]),
      label: { x: labelPt.x, y: labelPt.y },
    };
  });
}

function lineToSvgPath(coords) {
  return coords
    .map(([lon, lat], i) => {
      const p = project(lon, lat);
      return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
    })
    .join(" ");
}

function lineLengthPx(coords) {
  let len = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = project(coords[i - 1][0], coords[i - 1][1]);
    const b = project(coords[i][0], coords[i][1]);
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

function lineMidpoint(coords) {
  const mid = coords[Math.floor(coords.length / 2)];
  return project(mid[0], mid[1]);
}

const STREET_STYLE = {
  primary: { width: 3, opacity: 0.85, color: "#8fa89a", label: true },
  trunk: { width: 3.2, opacity: 0.9, color: "#9fb5a8", label: true },
  secondary: { width: 2, opacity: 0.72, color: "#6b8578", label: true },
  tertiary: { width: 1.2, opacity: 0.5, color: "#4a6358", label: false },
  motorway: { width: 3.5, opacity: 0.9, color: "#a8beb2", label: true },
};

/** Real street centerlines + names from OpenStreetMap (Nassau / New Providence bbox). */
export function buildStreetOverlay() {
  let features = [];
  try {
    features = readGeo("streets.json").features;
  } catch {
    features = [];
  }
  try {
    features = features.concat(readGeo("streets-manual.json").features);
  } catch {
    /* optional manual corrections */
  }

  const seenLabels = new Set();
  const IMPORTANT = /shirley|eastern|bay street|paradise|carmichael|collins|mackey|nassau/i;

  return features.map((f) => {
    const coords = f.geometry.coordinates;
    const hw = f.properties.highway;
    const style = STREET_STYLE[hw] || STREET_STYLE.tertiary;
    const len = lineLengthPx(coords);
    const mid = lineMidpoint(coords);
    const name = f.properties.name;
    const labelKey = `${name}-${Math.round(mid.x / 16)}-${Math.round(mid.y / 16)}`;
    const forceLabel = f.properties.label === true && IMPORTANT.test(name);
    const showLabel =
      (style.label || forceLabel) &&
      (forceLabel || len >= (hw === "primary" || hw === "trunk" ? 22 : hw === "secondary" ? 35 : 999)) &&
      !seenLabels.has(labelKey);
    if (showLabel) seenLabels.add(labelKey);

    return {
      name,
      highway: hw,
      manual: f.properties.manual === true,
      path: lineToSvgPath(coords),
      width: f.properties.manual ? style.width + 0.5 : style.width,
      opacity: style.opacity,
      color: f.properties.manual ? "#a8c4b4" : style.color,
      label: showLabel ? { x: mid.x, y: mid.y - 2, text: name } : null,
    };
  });
}

function corridorColor(status) {
  if (status === "closed") return "#ff6b6b";
  if (status === "restricted") return "#ffb347";
  return "#5fd4a4";
}

/** Public or private hospital partner facility. */
export function isHospitalPartner(role) {
  return role === "hospital_partner" || role === "hospital_partner_private";
}

export function facilityDisplayColor(role) {
  if (role === "hospital_partner") return "#ff6b6b";
  if (role === "hospital_partner_private") return "#c084fc";
  return "#00abc9";
}

let lastTriageRanking = null;

/** Persist latest triage ranking for map sync (Day 11). */
export function setLastTriageRanking(ranking) {
  lastTriageRanking = ranking;
}

export function getLastTriageRanking() {
  return lastTriageRanking;
}

function computeZone(svgPoints, fallback = { cx: 400, cy: 270, rx: 140, ry: 70 }) {
  if (!svgPoints.length) return fallback;
  const cx = Math.round(svgPoints.reduce((s, p) => s + p.x, 0) / svgPoints.length);
  const cy = Math.round(svgPoints.reduce((s, p) => s + p.y, 0) / svgPoints.length);
  const maxDx = Math.max(...svgPoints.map((p) => Math.abs(p.x - cx)), 60);
  const maxDy = Math.max(...svgPoints.map((p) => Math.abs(p.y - cy)), 40);
  return { cx, cy, rx: Math.min(180, maxDx + 40), ry: Math.min(100, maxDy + 30) };
}

/** Build map layers synced to Triage agent output — pins, zone, corridor conflicts. */
export function buildMapLayersFromTriage(ranking) {
  if (!ranking) return buildMapLayers(2);

  const level = ranking.level ?? 2;
  const { corridors, facilities } = loadGeoLayers();
  const trips = loadDispatch();
  const tripById = Object.fromEntries(trips.map((t) => [t.id, t]));

  const corridorById = Object.fromEntries(
    (ranking.corridorConflicts || []).map((c) => [c.corridor, c])
  );
  const facilityById = Object.fromEntries(
    (ranking.rankedFacilities || []).map((f) => [f.id, f])
  );

  const projectedCorridors = corridors.features.map((f) => {
    const id = f.properties.id;
    const conflict = corridorById[id];
    const status = conflict?.status || f.properties.status || "open";
    const coords = f.geometry.coordinates.map(([lon, lat]) => project(lon, lat));
    return {
      id,
      name: conflict?.name || f.properties.name,
      status,
      severity: conflict?.severity || (status === "closed" ? "critical" : status === "restricted" ? "high" : "open"),
      atRiskTrips: conflict?.atRiskTrips ?? 0,
      color: corridorColor(status),
      svg: {
        x1: coords[0].x,
        y1: coords[0].y,
        x2: coords[1].x,
        y2: coords[1].y,
        dash: status === "restricted" ? "8 4" : status === "closed" ? "4 4" : undefined,
        width: conflict?.severity === "critical" ? 6 : 4,
      },
    };
  });

  const projectedFacilities = facilities.features.map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const pt = project(lon, lat);
    const role = f.properties.role;
    const impact = facilityById[f.properties.id];
    const rank = impact?.rank;
    const baseR = isHospitalPartner(role) ? 12 : 10;
    return {
      id: f.properties.id,
      name: f.properties.name,
      role,
      rank,
      impactScore: impact?.impactScore ?? 0,
      p1Count: impact?.p1Count ?? 0,
      color: facilityDisplayColor(role),
      svg: { x: pt.x, y: pt.y, r: rank === 1 ? baseR + 4 : rank ? baseR + 2 : baseR },
    };
  });

  const projectedTrips = (ranking.rankedTrips || [])
    .map((rt) => {
      const trip = tripById[rt.id];
      if (!trip) return null;
      const pt = project(trip.pickupLon, trip.pickupLat);
      const corridorConflict = corridorById[trip.corridor];
      const hot =
        rt.priority === "P1" ||
        corridorConflict?.severity === "critical" ||
        (rt.reasons || []).some((r) => /CLOSED|RESTRICTED/.test(r));
      return {
        id: rt.id,
        rank: rt.rank,
        priority: rt.priority,
        pickup: rt.pickup,
        corridor: rt.corridor,
        conflictScore: rt.conflictScore,
        atRisk: hot,
        color: hot ? "#ffc72c" : "#a78bfa",
        svg: { x: pt.x, y: pt.y, r: hot ? 7 : 5 },
      };
    })
    .filter(Boolean);

  const atRiskCount = projectedTrips.filter((t) => t.atRisk).length;
  const zone = computeZone(projectedTrips.map((t) => t.svg));

  const corridorStatus = Object.fromEntries(
    projectedCorridors.map((c) => [c.id, c.status])
  );

  return {
    ok: true,
    syncSource: "triage",
    level,
    demo: true,
    serviceArea: ranking.geography || "New Providence · DEMO",
    viewBox: `0 0 ${MAP.viewBox.width} ${MAP.viewBox.height}`,
    bbox: MAP.bbox,
    zone,
    corridors: projectedCorridors,
    facilities: projectedFacilities,
    trips: projectedTrips,
    atRiskCount,
    corridorStatus,
    triageSummary: ranking.summary,
    conflictCount: (ranking.corridorConflicts || []).filter((c) => c.severity !== "watch").length,
    island: buildIslandOverlay(),
    streets: buildStreetOverlay(),
  };
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
      color: facilityDisplayColor(role),
      svg: { x: pt.x, y: pt.y, r: isHospitalPartner(role) ? 12 : 10 },
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
  const zone = computeZone(atRiskPts);

  return {
    ok: true,
    syncSource: "level",
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
    island: buildIslandOverlay(),
    streets: buildStreetOverlay(),
  };
}

export { MAP };
