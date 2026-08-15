/** Phase 3 Day 8 — GloFAS historical validation spike (Alma / Dorian vs agency GIS). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isGlofasEnabled } from "./glofas.js";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultCatalogPath = path.join(geoRoot, "glofas-validation-catalog.json");

export const GLOFAS_VALIDATION_SCOPE_GUARD =
  "GloFAS validation spike — historical coarse extent vs agency GIS demo; decision gate only; not hydrology authority.";

function readGeoJson(fileName) {
  const filePath = path.isAbsolute(fileName) ? fileName : path.join(geoRoot, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function getGlofasValidationCatalog() {
  const catalogPath = process.env.GLOFAS_VALIDATION_CATALOG_PATH || defaultCatalogPath;
  const raw = readGeoJson(catalogPath);
  return {
    ok: true,
    phase: "phase-3-day-10",
    scopeGuard: raw.scopeGuard || GLOFAS_VALIDATION_SCOPE_GUARD,
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

function classifyPairFit({ iou, agency, glofas, corridors }) {
  const agencyId = agency.properties?.id;
  const glofasId = glofas.properties?.id;
  const urbanHint = /urban|pluvial|ponding|Bay Street/i.test(agency.properties?.name || agency.properties?.notes || "");

  if (corridors.length && iou >= 0.25) {
    return {
      fit: "good_corridor_overlap",
      notes: `GloFAS coarse envelope aligns with agency ${agencyId} on ${corridors.join(", ")} (IoU ${iou}).`,
    };
  }
  if (corridors.length && iou >= 0.12) {
    return {
      fit: "partial_corridor_overlap",
      notes: `Partial overlap between ${glofasId} and agency ${agencyId} on ${corridors.join(", ")} — acceptable gap-fill guidance.`,
    };
  }
  if (corridors.length && iou < 0.12) {
    return {
      fit: urbanHint ? "urban_pluvial_misfit" : "misfit_extent",
      notes: urbanHint
        ? `Agency ${agencyId} urban pluvial detail not resolved by coarse GloFAS grid.`
        : `Extent mismatch on shared corridor ${corridors.join(", ")} (IoU ${iou}).`,
    };
  }
  if (iou >= 0.08) {
    return {
      fit: "offset_extent",
      notes: `Spatial proximity without shared corridor link — review manually.`,
    };
  }
  return {
    fit: "no_overlap",
    notes: `No meaningful bbox overlap between ${glofasId} and agency ${agencyId}.`,
  };
}

function activeFeatures(features, level) {
  return (features || []).filter((f) => level >= (f.properties?.activeAtLevel ?? 2));
}

function compareEventLayers(agencyFeatures, glofasFeatures, level) {
  const agency = activeFeatures(agencyFeatures, level);
  const glofas = activeFeatures(glofasFeatures, level);
  const comparisons = [];
  const matchedAgency = new Set();
  const matchedGlofas = new Set();

  for (const a of agency) {
    let best = null;
    for (const g of glofas) {
      const corridors = sharedCorridors(a, g);
      const iou = bboxIou(featureBbox(a), featureBbox(g));
      if (!best || iou > best.iou) {
        best = { agency: a, glofas: g, corridors, iou };
      }
    }
    if (best && best.iou > 0) {
      matchedAgency.add(best.agency.properties?.id);
      matchedGlofas.add(best.glofas.properties?.id);
      const classified = classifyPairFit(best);
      comparisons.push({
        agencyZoneId: best.agency.properties?.id,
        agencyName: best.agency.properties?.name,
        glofasZoneId: best.glofas.properties?.id,
        glofasName: best.glofas.properties?.name,
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
      fit: /urban|pluvial|ponding/i.test(a.properties?.name || a.properties?.notes || "")
        ? "agency_urban_pluvial_miss"
        : "agency_only_miss",
      notes:
        a.properties?.notes ||
        "Agency zone without matching GloFAS historical extent — expected for fine urban ponding.",
    }));

  const glofasOnly = glofas
    .filter((g) => !matchedGlofas.has(g.properties?.id))
    .map((g) => ({
      glofasZoneId: g.properties?.id,
      glofasName: g.properties?.name,
      linkedCorridors: g.properties?.linkedCorridors || [],
      fit: "glofas_gap_candidate",
      notes: g.properties?.notes || "Coarse GloFAS extent without agency confirmation — gap-fill candidate only.",
    }));

  const goodFitCount = comparisons.filter((c) =>
    ["good_corridor_overlap", "partial_corridor_overlap"].includes(c.fit)
  ).length;
  const misfitCount =
    comparisons.filter((c) => ["misfit_extent", "urban_pluvial_misfit", "offset_extent"].includes(c.fit)).length +
    agencyOnly.filter((a) => a.fit === "agency_urban_pluvial_miss").length;

  const urbanPluvialSignal =
    agencyOnly.some((a) => a.fit === "agency_urban_pluvial_miss") ||
    comparisons.some((c) => c.fit === "urban_pluvial_misfit");

  let eventVerdict = "continue_glofas";
  let commercialReview = false;
  let rationale = "Historical GloFAS coarse extent supports river/network gap-fill on shared corridors.";

  if (urbanPluvialSignal) {
    commercialReview = true;
    eventVerdict = "continue_glofas_urban_caveat";
    rationale =
      "GloFAS useful for river/network corridors but under-resolves urban pluvial ponding — consider commercial urban layer for Phase 3b if pilot requires street-level depth.";
  } else if (goodFitCount >= 1 && misfitCount === 0) {
    eventVerdict = "continue_glofas";
    rationale = "Coarse GloFAS historical extent aligns with agency corridors — gap-fill remains appropriate.";
  } else if (misfitCount > goodFitCount) {
    eventVerdict = "review_commercial";
    commercialReview = true;
    rationale = "Historical misfits exceed acceptable overlap — escalate commercial urban flood review.";
  }

  return {
    agencyZoneCount: agency.length,
    glofasZoneCount: glofas.length,
    comparisons,
    agencyOnly,
    glofasOnly,
    goodFitCount,
    misfitCount,
    gapCandidateCount: glofasOnly.length,
    decisionGate: {
      verdict: eventVerdict,
      commercialReviewRecommended: commercialReview,
      rationale,
    },
  };
}

export function buildGlofasValidationReport(eventId) {
  const catalog = getGlofasValidationCatalog();
  const event = catalog.events.find((e) => e.id === eventId);
  if (!event) {
    return { ok: false, error: `Unknown validation event: ${eventId}` };
  }

  const agencyLayer = readGeoJson(event.agencyPath);
  const glofasLayer = readGeoJson(event.glofasHistoricalPath);
  const level = event.level ?? 2;
  const analysis = compareEventLayers(agencyLayer.features || [], glofasLayer.features || [], level);

  return {
    ok: true,
    phase: "phase-3-day-10",
    step: "glofas_validation_sync",
    eventId: event.id,
    eventLabel: event.label,
    pilotScenario: event.pilotScenario,
    window: event.window,
    level,
    fetchMode: "historical_demo_json",
    agencySource: agencyLayer.source || event.agencyPath,
    glofasSource: glofasLayer.source || event.glofasHistoricalPath,
    scopeGuard: GLOFAS_VALIDATION_SCOPE_GUARD,
    ...analysis,
  };
}

export function buildGlofasValidationSummary() {
  const catalog = getGlofasValidationCatalog();
  const reports = catalog.events.map((e) => buildGlofasValidationReport(e.id)).filter((r) => r.ok);
  const commercialReviewRecommended = reports.some((r) => r.decisionGate.commercialReviewRecommended);
  const reviewCount = reports.filter((r) => r.decisionGate.verdict === "review_commercial").length;
  const urbanCaveatCount = reports.filter((r) => r.decisionGate.verdict === "continue_glofas_urban_caveat").length;

  let rollupVerdict = "continue_glofas";
  let rollupRationale =
    "Alma + Dorian historical spike: coarse GloFAS remains acceptable gap-fill for river/network corridors with documented urban pluvial limits.";

  if (reviewCount > 0) {
    rollupVerdict = "review_commercial";
    rollupRationale = "One or more historical windows fail overlap gate — commercial urban flood layer review recommended.";
  } else if (urbanCaveatCount > 0) {
    rollupVerdict = "continue_glofas_urban_caveat";
    rollupRationale =
      "Continue GloFAS gap-fill for network flooding; flag urban pluvial misfit for optional Phase 3b commercial layer.";
  }

  return {
    ok: true,
    phase: "phase-3-day-10",
    step: "glofas_validation_sync",
    enabled: isGlofasEnabled(),
    eventCount: reports.length,
    reports: reports.map((r) => ({
      eventId: r.eventId,
      eventLabel: r.eventLabel,
      goodFitCount: r.goodFitCount,
      misfitCount: r.misfitCount,
      gapCandidateCount: r.gapCandidateCount,
      verdict: r.decisionGate.verdict,
      commercialReviewRecommended: r.decisionGate.commercialReviewRecommended,
      sampleComparison: r.comparisons?.[0] || null,
      agencyOnlySample: r.agencyOnly?.[0] || null,
    })),
    decisionGate: {
      verdict: rollupVerdict,
      commercialReviewRecommended: commercialReviewRecommended,
      rationale: rollupRationale,
      docs: "docs/logbook-phase3-day8.txt",
    },
    scopeGuard: GLOFAS_VALIDATION_SCOPE_GUARD,
  };
}

/** Pipeline step payload — runs when GLOFAS validation enabled (default on with GLOFAS_ENABLED). */
export function buildGlofasValidationPipelineStep() {
  if (!isGlofasEnabled()) return null;
  const summary = buildGlofasValidationSummary();
  const alma = summary.reports.find((r) => r.eventId === "alma-2016");
  const dorian = summary.reports.find((r) => r.eventId === "dorian-2019");

  return {
    ...summary,
    syncAt: new Date().toISOString(),
    validationBadgeLabel: summary.reports
      .map((r) => {
        const short = r.eventId.split("-")[0];
        const tag =
          r.verdict === "continue_glofas"
            ? "ok"
            : r.verdict.replace(/^continue_glofas_?/, "").replace(/_/g, "-") || r.verdict;
        return `${short}:${tag}`;
      })
      .join(" · "),
    headline: `GloFAS validation — Alma ${alma?.verdict || "?"} · Dorian ${dorian?.verdict || "?"}`,
  };
}
