/** Phase 3b Day 8 — commercial urban flood re-validation (Dorian FLOOD-04 vs agency GIS). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isUrbanFloodEnabled } from "./urban-flood.js";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultCatalogPath = path.join(geoRoot, "urban-flood-validation-catalog.json");

export const URBAN_FLOOD_VALIDATION_SCOPE_GUARD =
  "Commercial urban flood validation spike — fine mesh vs agency urban pluvial demo; decision gate only; not hydrology authority.";

const URBAN_ACCEPT_IOU = 0.5;
const PARTIAL_IOU = 0.25;

function readGeoJson(fileName) {
  const filePath = path.isAbsolute(fileName) ? fileName : path.join(geoRoot, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function getUrbanFloodValidationCatalog() {
  const catalogPath = process.env.URBAN_FLOOD_VALIDATION_CATALOG_PATH || defaultCatalogPath;
  const raw = readGeoJson(catalogPath);
  return {
    ok: true,
    phase: "phase-3b-day-8",
    scopeGuard: raw.scopeGuard || URBAN_FLOOD_VALIDATION_SCOPE_GUARD,
    events: raw.events || [],
  };
}

function ringBbox(ring = []) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { minLon, maxLon, minLat, maxLat };
}

function featureBbox(feature) {
  const ring = feature.geometry?.coordinates?.[0] || [];
  return ringBbox(ring);
}

function bboxArea(bbox) {
  return Math.max(0, bbox.maxLon - bbox.minLon) * Math.max(0, bbox.maxLat - bbox.minLat);
}

function bboxIou(a, b) {
  const interMinLon = Math.max(a.minLon, b.minLon);
  const interMaxLon = Math.min(a.maxLon, b.maxLon);
  const interMinLat = Math.max(a.minLat, b.minLat);
  const interMaxLat = Math.min(a.maxLat, b.maxLat);
  const interW = Math.max(0, interMaxLon - interMinLon);
  const interH = Math.max(0, interMaxLat - interMinLat);
  const inter = interW * interH;
  if (inter === 0) return 0;
  const union = bboxArea(a) + bboxArea(b) - inter;
  return union > 0 ? Math.round((inter / union) * 1000) / 1000 : 0;
}

function sharedCorridors(a, b) {
  const left = new Set(a.properties?.linkedCorridors || []);
  return (b.properties?.linkedCorridors || []).filter((c) => left.has(c));
}

function isUrbanPluvial(feature) {
  const text = `${feature.properties?.name || ""} ${feature.properties?.notes || ""}`;
  return /urban|pluvial|ponding|Bay Street/i.test(text);
}

function classifyCommercialFit({ iou, agency, commercial, corridors }) {
  const agencyId = agency.properties?.id;
  const commercialId = commercial.properties?.id;
  const urban = isUrbanPluvial(agency);

  if (iou >= URBAN_ACCEPT_IOU && corridors.length) {
    return {
      fit: urban ? "good_urban_overlap" : "good_corridor_overlap",
      notes: `Commercial ${commercialId} aligns with agency ${agencyId} on ${corridors.join(", ")} (IoU ${iou}).`,
    };
  }
  if (iou >= PARTIAL_IOU && corridors.length) {
    return {
      fit: urban ? "partial_urban_overlap" : "partial_corridor_overlap",
      notes: `Partial commercial overlap with agency ${agencyId} — review depth band before gap-fill trust.`,
    };
  }
  if (urban && corridors.length) {
    return {
      fit: "urban_layer_misfit",
      notes: `Commercial ${commercialId} under-resolves agency ${agencyId} urban pluvial (IoU ${iou}).`,
    };
  }
  if (iou >= 0.08) {
    return {
      fit: "offset_extent",
      notes: "Spatial proximity without sufficient corridor-linked overlap — review manually.",
    };
  }
  return {
    fit: "no_overlap",
    notes: `No meaningful overlap between commercial ${commercialId} and agency ${agencyId}.`,
  };
}

function activeFeatures(features, level) {
  return (features || []).filter((f) => level >= (f.properties?.activeAtLevel ?? 2));
}

function bestMatchForAgency(agency, candidates, level) {
  const pool = activeFeatures(candidates, level);
  let best = null;
  for (const candidate of pool) {
    const corridors = sharedCorridors(agency, candidate);
    const iou = bboxIou(featureBbox(agency), featureBbox(candidate));
    if (!best || iou > best.iou) {
      best = { agency, candidate, corridors, iou };
    }
  }
  return best;
}

function compareEventLayers(agencyFeatures, commercialFeatures, glofasFeatures, level, focusAgencyZoneId) {
  const agency = activeFeatures(agencyFeatures, level);
  const commercial = activeFeatures(commercialFeatures, level);
  const glofas = activeFeatures(glofasFeatures, level);
  const comparisons = [];
  const matchedAgency = new Set();
  const matchedCommercial = new Set();

  for (const a of agency) {
    const best = bestMatchForAgency(a, commercial, level);
    if (best && best.iou > 0) {
      matchedAgency.add(best.agency.properties?.id);
      matchedCommercial.add(best.candidate.properties?.id);
      const classified = classifyCommercialFit({
        iou: best.iou,
        agency: best.agency,
        commercial: best.candidate,
        corridors: best.corridors,
      });
      comparisons.push({
        agencyZoneId: best.agency.properties?.id,
        agencyName: best.agency.properties?.name,
        commercialZoneId: best.candidate.properties?.id,
        commercialName: best.candidate.properties?.name,
        sharedCorridors: best.corridors,
        iou: best.iou,
        fit: classified.fit,
        notes: classified.notes,
      });
    }
  }

  const agencyOnly = agency
    .filter((a) => !matchedAgency.has(a.properties?.id))
    .map((a) => ({
      agencyZoneId: a.properties?.id,
      agencyName: a.properties?.name,
      linkedCorridors: a.properties?.linkedCorridors || [],
      fit: isUrbanPluvial(a) ? "agency_urban_pluvial_miss" : "agency_only_miss",
      notes:
        a.properties?.notes ||
        "Agency zone without matching commercial urban extent — stay agency-only for this corridor.",
    }));

  const commercialOnly = commercial
    .filter((c) => !matchedCommercial.has(c.properties?.id))
    .map((c) => ({
      commercialZoneId: c.properties?.id,
      commercialName: c.properties?.name,
      linkedCorridors: c.properties?.linkedCorridors || [],
      fit: "commercial_gap_candidate",
      notes: c.properties?.notes || "Commercial extent without agency confirmation — gap-fill candidate only.",
    }));

  const focusAgency = focusAgencyZoneId
    ? agency.find((a) => a.properties?.id === focusAgencyZoneId)
    : agency.find((a) => isUrbanPluvial(a));

  let focusZoneComparison = null;
  if (focusAgency) {
    const commercialBest = bestMatchForAgency(focusAgency, commercial, level);
    const glofasBest = bestMatchForAgency(focusAgency, glofas, level);
    const commercialIou = commercialBest?.iou ?? 0;
    const glofasBaselineIou = glofasBest?.iou ?? 0;
    focusZoneComparison = {
      agencyZoneId: focusAgency.properties?.id,
      agencyName: focusAgency.properties?.name,
      commercialZoneId: commercialBest?.candidate?.properties?.id || null,
      commercialIou,
      glofasZoneId: glofasBest?.candidate?.properties?.id || null,
      glofasBaselineIou,
      iouImprovementVsGlofas: Math.round((commercialIou - glofasBaselineIou) * 1000) / 1000,
      glofasImprovement: commercialIou > glofasBaselineIou + 0.2,
    };
  }

  const goodFitCount = comparisons.filter((c) =>
    ["good_urban_overlap", "good_corridor_overlap"].includes(c.fit)
  ).length;
  const misfitCount =
    comparisons.filter((c) => ["urban_layer_misfit", "offset_extent"].includes(c.fit)).length +
    agencyOnly.filter((a) => a.fit === "agency_urban_pluvial_miss").length;

  let eventVerdict = "stay_agency_only";
  let rationale =
    "Commercial urban layer does not meet overlap gate on agency urban pluvial zones — prefer agency GIS only.";

  const focusAcceptable =
    focusZoneComparison &&
    focusZoneComparison.commercialIou >= URBAN_ACCEPT_IOU &&
    focusZoneComparison.glofasImprovement;

  if (focusAcceptable || (goodFitCount >= 1 && misfitCount === 0)) {
    eventVerdict = "urban_layer_acceptable";
    rationale = focusZoneComparison?.glofasImprovement
      ? `Commercial urban IoU ${focusZoneComparison.commercialIou} on ${focusZoneComparison.agencyZoneId} improves vs GloFAS baseline ${focusZoneComparison.glofasBaselineIou} — urban layer acceptable for pilot gap-fill.`
      : "Commercial urban extent aligns with agency corridors — urban layer acceptable for pilot gap-fill.";
  } else if (goodFitCount >= 1 && misfitCount <= goodFitCount) {
    eventVerdict = "urban_layer_acceptable";
    rationale =
      "Commercial urban overlap acceptable on shared corridors with documented misfit notes — operator review recommended.";
  }

  return {
    agencyZoneCount: agency.length,
    commercialZoneCount: commercial.length,
    glofasBaselineZoneCount: glofas.length,
    comparisons,
    agencyOnly,
    commercialOnly,
    focusZoneComparison,
    goodFitCount,
    misfitCount,
    gapCandidateCount: commercialOnly.length,
    decisionGate: {
      verdict: eventVerdict,
      stayAgencyOnlyRecommended: eventVerdict === "stay_agency_only",
      rationale,
    },
  };
}

export function buildUrbanFloodValidationReport(eventId) {
  const catalog = getUrbanFloodValidationCatalog();
  const event = catalog.events.find((e) => e.id === eventId);
  if (!event) {
    return { ok: false, error: `Unknown validation event: ${eventId}` };
  }

  const agencyLayer = readGeoJson(event.agencyPath);
  const commercialLayer = readGeoJson(event.commercialPath);
  const glofasLayer = event.glofasHistoricalPath ? readGeoJson(event.glofasHistoricalPath) : { features: [] };
  const level = event.level ?? 3;
  const analysis = compareEventLayers(
    agencyLayer.features || [],
    commercialLayer.features || [],
    glofasLayer.features || [],
    level,
    event.focusAgencyZoneId
  );

  return {
    ok: true,
    phase: "phase-3b-day-8",
    step: "urban_flood_validation_sync",
    eventId: event.id,
    eventLabel: event.label,
    pilotScenario: event.pilotScenario,
    window: event.window,
    level,
    fetchMode: "commercial_validation_demo_json",
    agencySource: agencyLayer.source || event.agencyPath,
    commercialSource: commercialLayer.source || event.commercialPath,
    glofasBaselineSource: glofasLayer.source || event.glofasHistoricalPath || null,
    focusAgencyZoneId: event.focusAgencyZoneId || null,
    scopeGuard: URBAN_FLOOD_VALIDATION_SCOPE_GUARD,
    ...analysis,
  };
}

export function buildUrbanFloodValidationSummary() {
  const catalog = getUrbanFloodValidationCatalog();
  const reports = catalog.events.map((e) => buildUrbanFloodValidationReport(e.id)).filter((r) => r.ok);
  const acceptableCount = reports.filter((r) => r.decisionGate.verdict === "urban_layer_acceptable").length;
  const stayAgencyCount = reports.filter((r) => r.decisionGate.verdict === "stay_agency_only").length;

  let rollupVerdict = "stay_agency_only";
  let rollupRationale =
    "Commercial urban validation did not pass overlap gate — default to agency-only urban pluvial posture.";

  if (acceptableCount > 0 && stayAgencyCount === 0) {
    rollupVerdict = "urban_layer_acceptable";
    rollupRationale =
      "Dorian FLOOD-04 re-validation: commercial urban clip improves Bay Street pluvial IoU vs GloFAS baseline — urban layer acceptable for three-way merge pilot.";
  } else if (acceptableCount > 0) {
    rollupVerdict = "urban_layer_acceptable";
    rollupRationale =
      "Mixed validation windows — acceptable overlap on focus urban zones with documented misfits elsewhere.";
  }

  return {
    ok: true,
    phase: "phase-3b-day-8",
    step: "urban_flood_validation_sync",
    enabled: isUrbanFloodEnabled(),
    eventCount: reports.length,
    reports: reports.map((r) => ({
      eventId: r.eventId,
      eventLabel: r.eventLabel,
      focusAgencyZoneId: r.focusAgencyZoneId,
      goodFitCount: r.goodFitCount,
      misfitCount: r.misfitCount,
      verdict: r.decisionGate.verdict,
      stayAgencyOnlyRecommended: r.decisionGate.stayAgencyOnlyRecommended,
      focusZoneComparison: r.focusZoneComparison,
      sampleComparison: r.comparisons?.[0] || null,
      agencyOnlySample: r.agencyOnly?.[0] || null,
    })),
    decisionGate: {
      verdict: rollupVerdict,
      stayAgencyOnlyRecommended: rollupVerdict === "stay_agency_only",
      rationale: rollupRationale,
      docs: "docs/logbook-phase3b-day8.txt",
    },
    scopeGuard: URBAN_FLOOD_VALIDATION_SCOPE_GUARD,
  };
}

/** Pipeline step payload — runs when URBAN_FLOOD_ENABLED. */
export function buildUrbanFloodValidationPipelineStep() {
  if (!isUrbanFloodEnabled()) return null;
  const summary = buildUrbanFloodValidationSummary();
  const dorian = summary.reports.find((r) => r.eventId === "dorian-2019");

  return {
    ...summary,
    syncAt: new Date().toISOString(),
    validationBadgeLabel: summary.reports
      .map((r) => {
        const short = r.eventId.split("-")[0];
        const tag =
          r.verdict === "urban_layer_acceptable"
            ? "acceptable"
            : r.verdict.replace(/^urban_layer_?/, "").replace(/_/g, "-") || r.verdict;
        return `${short}:${tag}`;
      })
      .join(" · "),
    headline: `Urban flood validation — Dorian ${dorian?.verdict || "?"} · FLOOD-04 IoU ${dorian?.focusZoneComparison?.commercialIou ?? "?"}`,
    badge: summary.decisionGate.verdict.replace(/_/g, "-"),
  };
}
