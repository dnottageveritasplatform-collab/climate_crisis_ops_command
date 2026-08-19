import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAtRiskTrips, loadDispatch } from "../dispatch/index.js";
import { buildCadMapUnits } from "../cad/index.js";
import { attachLiveCadToTrips } from "../cad/enrichment.js";
import { attachTransportDeskToFacilities } from "../transport-desk/index.js";
import { buildPublicSafetyMapUnits } from "../public-safety/index.js";
import { getActiveCorridorStatus, getCorridorLayerMeta, loadCorridorLayer } from "./esri.js";
import { buildFloodMapOverlay, buildFloodMapBadge } from "./hazards.js";
import { buildWindMapOverlay } from "./wind.js";
import { getGlofasCdsStatus, isGlofasEnabled } from "./glofas.js";
import { getUrbanFloodVendorStatus, isUrbanFloodEnabled } from "./urban-flood.js";
import { MAP, BASEMAP_REV, mapViewBoxString, projectPoint } from "./map-constants.js";
import { mainIslandRing } from "./land-mask.js";

export { MAP, mapViewBoxString };

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");

function readGeo(file) {
  return JSON.parse(fs.readFileSync(path.join(geoRoot, file), "utf8"));
}

/** Load corridor + facility layers (ESRI demo adapter by default on Day 6+). */
export function loadGeoLayers() {
  const corridorLayer = loadCorridorLayer();
  return {
    corridors: corridorLayer.collection,
    facilities: readGeo("facilities.json"),
    corridorMeta: corridorLayer.meta,
  };
}

export { getActiveCorridorStatus, getCorridorLayerMeta, buildEsriCorridorSummary } from "./esri.js";

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

/** Simplified New Providence + Paradise Island landmass for map underlay. */
export function buildIslandOverlay() {
  const mainPath = ringToSvgPath(mainIslandRing());
  const mainLabel = project(-77.295, 25.055);
  const paradiseLabel = project(-77.292, 25.092);
  return [
    {
      id: "NP-MAIN",
      name: "New Providence",
      kind: "main_island",
      path: mainPath,
      label: { x: mainLabel.x, y: mainLabel.y },
    },
    {
      id: "NP-PARADISE",
      name: "Paradise Island",
      kind: "island",
      path: ringToSvgPath([
        [-77.318, 25.078],
        [-77.3, 25.076],
        [-77.278, 25.079],
        [-77.268, 25.088],
        [-77.27, 25.097],
        [-77.288, 25.1],
        [-77.308, 25.099],
        [-77.318, 25.092],
        [-77.318, 25.078],
      ]),
      label: { x: paradiseLabel.x, y: paradiseLabel.y },
    },
  ];
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
  primary: { width: 1.8, opacity: 0.72, color: "#b8d4c8", label: true },
  trunk: { width: 2, opacity: 0.78, color: "#c2dccf", label: true },
  secondary: { width: 1.4, opacity: 0.62, color: "#8aa498", label: false },
  tertiary: { width: 0.8, opacity: 0.35, color: "#4a6358", label: false },
  motorway: { width: 2.2, opacity: 0.8, color: "#d0e6da", label: true },
};

const LABELED_STREET = {
  color: "#e8f5ef",
  importantColor: "#ffffff",
  widthBoost: 0.5,
  importantWidthBoost: 1,
  opacity: 0.88,
  importantOpacity: 0.95,
};

const IMPORTANT = /shirley|eastern|bay street|paradise|carmichael|collins|mackey|nassau/i;

function streetOverlayFromCoords(f, coords, seenLabels) {
  const hw = f.properties.highway;
  const style = STREET_STYLE[hw] || STREET_STYLE.tertiary;
  const len = lineLengthPx(coords);
  if (len < 3) return null;

  const mid = lineMidpoint(coords);
  const name = f.properties.name;
  const labelKey = `${name}-${Math.round(mid.x / 16)}-${Math.round(mid.y / 16)}`;
  const isImportant = Boolean(name && IMPORTANT.test(name));
  const minLen = isImportant ? 12 : hw === "primary" || hw === "trunk" ? 36 : hw === "secondary" ? 48 : 999;
  const showLabel =
    name &&
    (isImportant || style.label || f.properties.label === true) &&
    len >= minLen &&
    !seenLabels.has(labelKey);
  if (showLabel) seenLabels.add(labelKey);

  const labeled = Boolean(showLabel);
  const widthBoost = isImportant ? LABELED_STREET.importantWidthBoost : labeled ? LABELED_STREET.widthBoost : 0;
  const lineColor = labeled
    ? isImportant
      ? LABELED_STREET.importantColor
      : LABELED_STREET.color
    : f.properties.manual
      ? "#a8c4b4"
      : style.color;
  const lineOpacity = labeled
    ? isImportant
      ? LABELED_STREET.importantOpacity
      : LABELED_STREET.opacity
    : style.opacity;

  return {
    name,
    highway: hw,
    manual: f.properties.manual === true,
    important: isImportant,
    labeled,
    path: lineToSvgPath(coords),
    width: (f.properties.manual ? style.width + 0.5 : style.width) + widthBoost,
    opacity: lineOpacity,
    color: lineColor,
    label: showLabel ? { x: mid.x, y: mid.y - 2, text: name } : null,
  };
}

/** Real street centerlines + names from OpenStreetMap (Nassau / New Providence bbox). */
export function buildStreetOverlay() {
  let features = [];
  try {
    features = readGeo("streets.json").features;
  } catch {
    features = [];
  }

  const seenLabels = new Set();
  /** @type {ReturnType<typeof streetOverlayFromCoords>[]} */
  const overlays = [];

  for (const f of features) {
    const hw = f.properties.highway;
    if (hw === "tertiary" && !IMPORTANT.test(f.properties.name || "")) continue;
    const coords = f.geometry.coordinates;
    if (!coords || coords.length < 2) continue;
    const overlay = streetOverlayFromCoords(f, coords, seenLabels);
    if (overlay) overlays.push(overlay);
  }

  return overlays;
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
  if (role === "hospital_partner") return "#f97316";
  if (role === "hospital_partner_private") return "#c084fc";
  return "#38bdf8";
}

let lastTriageRanking = null;

/** Attach Phase 2 read-only overlays (CAD, transport desk, public safety, ESRI corridors). */
export function attachCadOverlay(layers) {
  if (!layers?.ok) return layers;
  const atRiskTripIds = (layers.trips || []).filter((t) => t.atRisk).map((t) => t.id);
  const level = layers.level ?? 2;
  const cad = buildCadMapUnits({ level, atRiskTripIds });
  const publicSafety = buildPublicSafetyMapUnits({ level });
  const facilities = attachTransportDeskToFacilities(layers.facilities || []);
  const trips = attachLiveCadToTrips(layers.trips || []);
  const corridorMeta = getCorridorLayerMeta();
  const floodZones = buildFloodMapOverlay(level);
  const floodMapBadge = buildFloodMapBadge(floodZones, level);
  const windZones = buildWindMapOverlay(level);
  const glofasCds = isGlofasEnabled() ? getGlofasCdsStatus() : null;
  const urbanVendor = isUrbanFloodEnabled() ? getUrbanFloodVendorStatus() : null;
  return {
    ...layers,
    facilities,
    trips,
    cadOverlay: true,
    transportDeskOverlay: true,
    publicSafetyOverlay: true,
    cadEnrichment: true,
    floodHazardOverlay: floodZones.length > 0,
    floodZones,
    floodZoneCount: floodMapBadge.totalCount,
    floodAgencyZoneCount: floodMapBadge.agencyZoneCount,
    floodGlofasGapZoneCount: floodMapBadge.glofasGapZoneCount,
    floodCommercialGapZoneCount: floodMapBadge.commercialGapZoneCount,
    floodBadgeLabel: floodMapBadge.badgeLabel,
    glofasFloodEnabled: floodMapBadge.glofasEnabled,
    urbanFloodEnabled: floodMapBadge.urbanEnabled,
    glofasStaleWarning: glofasCds?.staleWarning ?? false,
    glofasStaleHours: glofasCds?.staleHours ?? null,
    glofasStaleThresholdHours: glofasCds?.staleThresholdHours ?? null,
    urbanStaleWarning: urbanVendor?.staleWarning ?? false,
    urbanStaleHours: urbanVendor?.staleHours ?? null,
    urbanStaleThresholdHours: urbanVendor?.staleThresholdHours ?? null,
    windHazardOverlay: windZones.length > 0,
    windZones,
    windZoneCount: windZones.length,
    esriCorridorOverlay: corridorMeta.source === "esri_feature_service",
    corridorLayerSource: corridorMeta.source,
    corridorLayerAdapter: corridorMeta.adapter,
    corridorServiceName: corridorMeta.serviceName,
    cadUnitCount: cad.unitCount,
    cadUnits: cad.units,
    publicSafetyUnitCount: publicSafety.unitCount,
    publicSafetyUnits: publicSafety.units,
  };
}

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
      coords: f.geometry.coordinates,
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
      lon,
      lat,
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
        lon: trip.pickupLon,
        lat: trip.pickupLat,
        svg: { x: pt.x, y: pt.y, r: hot ? 7 : 5 },
      };
    })
    .filter(Boolean);

  const atRiskCount = projectedTrips.filter((t) => t.atRisk).length;
  const zone = computeZone(projectedTrips.map((t) => t.svg));

  const corridorStatus = Object.fromEntries(
    projectedCorridors.map((c) => [c.id, c.status])
  );

  return attachCadOverlay({
    ok: true,
    syncSource: "triage",
    level,
    demo: true,
    serviceArea: ranking.geography || "New Providence · DEMO",
    viewBox: mapViewBoxString(),
    mapPadLeft: MAP.viewBox.padLeft || 0,
    bbox: MAP.bbox,
    basemapRev: BASEMAP_REV,
    basemapUrl: "/api/geo/basemap",
    basemapSize: `${MAP.viewBox.width}x${MAP.viewBox.height}`,
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
  });
}

/** Build map payload with projected SVG-ready layers for the command UI. */
export function buildMapLayers(level = 2) {
  const { corridors, facilities } = loadGeoLayers();
  const corridorStatus = getActiveCorridorStatus(level);
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
      coords: f.geometry.coordinates,
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
      lon,
      lat,
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
      lon: t.pickupLon,
      lat: t.pickupLat,
      svg: { x: pt.x, y: pt.y, r: atRisk ? 6 : 4 },
    };
  });

  const atRiskPts = projectedTrips.filter((t) => t.atRisk).map((t) => t.svg);
  const zone = computeZone(atRiskPts);

  return attachCadOverlay({
    ok: true,
    syncSource: "level",
    level,
    demo: true,
    serviceArea: "New Providence · DEMO",
    viewBox: mapViewBoxString(),
    mapPadLeft: MAP.viewBox.padLeft || 0,
    bbox: MAP.bbox,
    basemapRev: BASEMAP_REV,
    basemapUrl: "/api/geo/basemap",
    basemapSize: `${MAP.viewBox.width}x${MAP.viewBox.height}`,
    zone,
    corridors: projectedCorridors,
    facilities: projectedFacilities,
    trips: projectedTrips,
    atRiskCount: atRiskIds.size,
    corridorStatus,
    island: buildIslandOverlay(),
    streets: buildStreetOverlay(),
  });
}
