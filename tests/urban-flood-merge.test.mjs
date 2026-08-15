/** Phase 3b Day 4 — three-way flood merge (agency + commercial + GloFAS). */

import assert from "node:assert/strict";
import {
  mergeUrbanCommercialGapFill,
  resolveFloodZoneForCorridor,
  buildFloodHazardCrossRef,
  buildFloodMapBadge,
  buildFloodMapOverlay,
} from "../src/geo/hazards.js";
import { convertUrbanFloodExport } from "../src/geo/urban-flood-convert.js";

const agencyFeatures = [
  {
    type: "Feature",
    properties: {
      id: "FLOOD-01",
      name: "Eastern Road low segment",
      depthInches: 14,
      depthBand: "moderate",
      linkedCorridors: ["CORR-02"],
      activeAtLevel: 2,
    },
    geometry: { type: "Polygon", coordinates: [[]] },
  },
  {
    type: "Feature",
    properties: {
      id: "FLOOD-02",
      name: "Bay Street storm drain backup",
      depthInches: 8,
      depthBand: "minor",
      linkedCorridors: ["CORR-02"],
      activeAtLevel: 2,
    },
    geometry: { type: "Polygon", coordinates: [[]] },
  },
];

const commercialFeatures = [
  {
    type: "Feature",
    properties: {
      id: "URBAN-01",
      name: "Bay Street pluvial · JBA",
      source: "commercial",
      confidence: "commercial_model",
      depthInches: 12,
      linkedCorridors: ["CORR-02"],
      activeAtLevel: 2,
    },
    geometry: { type: "Polygon", coordinates: [[]] },
  },
  {
    type: "Feature",
    properties: {
      id: "URBAN-02",
      name: "Shirley Street cul-de-sac pluvial",
      source: "commercial",
      confidence: "commercial_model",
      depthInches: 8,
      linkedCorridors: ["CORR-04"],
      activeAtLevel: 2,
    },
    geometry: { type: "Polygon", coordinates: [[]] },
  },
];

const glofasFeatures = [
  {
    type: "Feature",
    properties: {
      id: "GLOFAS-01",
      name: "GloFAS · Eastern Road basin exceedance",
      source: "glofas",
      confidence: "model_estimated",
      linkedCorridors: ["CORR-02"],
      activeAtLevel: 2,
    },
    geometry: { type: "Polygon", coordinates: [[]] },
  },
  {
    type: "Feature",
    properties: {
      id: "GLOFAS-02",
      name: "GloFAS · Western New Providence elevated discharge",
      source: "glofas",
      confidence: "model_estimated",
      linkedCorridors: ["CORR-01"],
      activeAtLevel: 2,
    },
    geometry: { type: "Polygon", coordinates: [[]] },
  },
];

const merged = mergeUrbanCommercialGapFill(agencyFeatures, commercialFeatures, glofasFeatures);

assert.equal(merged.mergeRule, "agency_wins_then_commercial_then_glofas");
assert.equal(merged.agencyZoneCount, 2);
assert.equal(merged.commercialGapZoneCount, 1, "CORR-04 commercial gap-fill preserved");
assert.equal(merged.glofasGapZoneCount, 1, "CORR-01 GloFAS gap-fill preserved");
assert.equal(merged.suppressedCommercialZoneCount, 1, "CORR-02 commercial suppressed by agency");
assert.equal(merged.suppressedGlofasZoneCount, 1, "CORR-02 GloFAS suppressed by agency");
assert.equal(merged.features.length, 4);
assert.equal(merged.suppressedCommercialZones[0].zoneId, "URBAN-01");
assert.equal(merged.suppressedCommercialZones[0].reason, "agency_corridor_override");
assert.equal(merged.suppressedGlofasZones[0].zoneId, "GLOFAS-01");
assert.equal(merged.suppressedGlofasZones[0].reason, "commercial_or_agency_corridor_override");

const featureIds = merged.features.map((f) => f.properties.id);
assert.ok(!featureIds.includes("URBAN-01"));
assert.ok(!featureIds.includes("GLOFAS-01"));
assert.ok(featureIds.includes("URBAN-02"));
assert.ok(featureIds.includes("GLOFAS-02"));

const urbanGap = merged.features.find((f) => f.properties.id === "URBAN-02");
assert.equal(urbanGap.properties.confidence, "commercial_model");
assert.equal(urbanGap.properties.source, "commercial");

const glofasGap = merged.features.find((f) => f.properties.id === "GLOFAS-02");
assert.equal(glofasGap.properties.confidence, "model_estimated");

const zoneMatches = [
  { zoneId: "GLOFAS-02", confidence: "model_estimated", linkedCorridors: ["CORR-01"] },
  { zoneId: "URBAN-02", confidence: "commercial_model", linkedCorridors: ["CORR-04"] },
  { zoneId: "FLOOD-01", confidence: "agency_confirmed", linkedCorridors: ["CORR-02"] },
];

assert.equal(resolveFloodZoneForCorridor(zoneMatches, "CORR-02")?.zoneId, "FLOOD-01");
assert.equal(resolveFloodZoneForCorridor(zoneMatches, "CORR-04")?.zoneId, "URBAN-02");
assert.equal(resolveFloodZoneForCorridor(zoneMatches, "CORR-01")?.zoneId, "GLOFAS-02");

const prevUrban = process.env.URBAN_FLOOD_ENABLED;
const prevGlofas = process.env.GLOFAS_ENABLED;
process.env.URBAN_FLOOD_ENABLED = "true";
process.env.GLOFAS_ENABLED = "true";
convertUrbanFloodExport({ vendor: "jba" });

const crossRef = buildFloodHazardCrossRef(2);
assert.equal(crossRef.phase, "phase-3b-day-7");
assert.equal(crossRef.mergeRule, "agency_wins_then_commercial_then_glofas");
assert.ok(crossRef.commercialGapZoneCount >= 1, "Shirley Street CORR-04 commercial gap-fill preserved");
assert.ok(crossRef.suppressedCommercialZoneCount >= 1);
assert.ok(crossRef.glofasGapZoneCount >= 1);
assert.ok(crossRef.floodBadgeLabel?.includes("agency"));

const overlay = buildFloodMapOverlay(2);
const badge = buildFloodMapBadge(overlay, 2);
assert.ok(badge.agencyZoneCount >= 1);
assert.ok(badge.commercialGapZoneCount >= 1);
assert.ok(badge.badgeLabel.includes("urban"));

process.env.URBAN_FLOOD_ENABLED = prevUrban;
process.env.GLOFAS_ENABLED = prevGlofas;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 24,
      mergeRule: merged.mergeRule,
      agencyZoneCount: merged.agencyZoneCount,
      commercialGapZoneCount: merged.commercialGapZoneCount,
      glofasGapZoneCount: merged.glofasGapZoneCount,
      floodBadgeLabel: merged.floodBadgeLabel,
    },
    null,
    2
  )
);
