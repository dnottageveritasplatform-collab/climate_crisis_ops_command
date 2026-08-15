/** Phase 3 Day 4 — unit tests for agency + GloFAS merge rules. */

import assert from "node:assert/strict";
import {
  mergeGlofasGapFill,
  normalizeAgencyFeature,
} from "../src/geo/glofas.js";

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

const merged = mergeGlofasGapFill(agencyFeatures, glofasFeatures);

assert.equal(merged.mergeRule, "agency_wins_corridor");
assert.equal(merged.agencyZoneCount, 2);
assert.equal(merged.glofasGapZoneCount, 1, "CORR-01 gap-fill preserved");
assert.equal(merged.suppressedGlofasZoneCount, 1, "CORR-02 GloFAS suppressed");
assert.equal(merged.features.length, 3);
assert.equal(merged.suppressedGlofasZones[0].zoneId, "GLOFAS-01");
assert.equal(merged.suppressedGlofasZones[0].reason, "agency_corridor_override");

const agencyNorm = normalizeAgencyFeature(agencyFeatures[0]);
assert.equal(agencyNorm.properties.source, "agency");
assert.equal(agencyNorm.properties.confidence, "agency_confirmed");

const gapFeature = merged.features.find((f) => f.properties.id === "GLOFAS-02");
assert.equal(gapFeature.properties.confidence, "model_estimated");
assert.equal(gapFeature.properties.source, "glofas");

const suppressedIds = merged.features.map((f) => f.properties.id);
assert.ok(!suppressedIds.includes("GLOFAS-01"), "suppressed zone not in merged features");

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 11,
      agencyZoneCount: merged.agencyZoneCount,
      glofasGapZoneCount: merged.glofasGapZoneCount,
      suppressedGlofasZoneCount: merged.suppressedGlofasZoneCount,
    },
    null,
    2
  )
);
