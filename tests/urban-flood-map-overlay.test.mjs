/** Phase 3b Day 5 — commercial urban flood map overlay styling + three-part badge. */

import assert from "node:assert/strict";
import { buildFloodMapBadge, buildFloodMapOverlay } from "../src/geo/hazards.js";
import { convertUrbanFloodExport } from "../src/geo/urban-flood-convert.js";

const commercialFeature = {
  type: "Feature",
  properties: {
    id: "URBAN-02",
    name: "Shirley Street cul-de-sac pluvial",
    source: "commercial",
    confidence: "commercial_model",
    depthInches: 8,
    depthBand: "moderate",
    linkedCorridors: ["CORR-04"],
    activeAtLevel: 2,
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-77.3255, 25.0535],
        [-77.3245, 25.0535],
        [-77.3245, 25.0545],
        [-77.3255, 25.0545],
        [-77.3255, 25.0535],
      ],
    ],
  },
};

const agencyFeature = {
  type: "Feature",
  properties: {
    id: "FLOOD-01",
    confidence: "agency_confirmed",
    depthInches: 14,
    depthBand: "moderate",
    linkedCorridors: ["CORR-02"],
    activeAtLevel: 2,
  },
  geometry: { type: "Polygon", coordinates: [[[]]] },
};

const glofasFeature = {
  type: "Feature",
  properties: {
    id: "GLOFAS-02",
    source: "glofas",
    confidence: "model_estimated",
    returnPeriodYears: 10,
    linkedCorridors: ["CORR-01"],
    activeAtLevel: 2,
  },
  geometry: { type: "Polygon", coordinates: [[[]]] },
};

const overlay = buildFloodMapOverlay(2, {
  features: [agencyFeature, commercialFeature, glofasFeature],
});

const agency = overlay.find((z) => z.confidence === "agency_confirmed");
const commercial = overlay.find((z) => z.confidence === "commercial_model");
const glofas = overlay.find((z) => z.confidence === "model_estimated");

assert.ok(agency, "agency zone styled");
assert.ok(commercial, "commercial zone styled");
assert.ok(glofas, "glofas zone styled");
assert.equal(agency.strokeDasharray, undefined, "agency flood is solid stroke");
assert.equal(glofas.strokeDasharray, "4 2", "glofas flood is dashed stroke");
assert.equal(commercial.strokeDasharray, "1 3", "commercial urban flood is dotted stroke");
assert.match(commercial.stroke, /^#/, "commercial stroke is violet");
assert.match(commercial.fill, /rgba\(.*(124, 58, 237|139, 92, 246|167, 139, 250)/, "commercial fill is violet tint");
assert.equal(commercial.label.text, '8"', "commercial label shows depth when known");
assert.equal(commercial.label.kind, "depth");
assert.ok(commercial.callout?.headline);
assert.match(commercial.callout.detail, /urban model/);

const shallowCommercial = buildFloodMapOverlay(2, {
  features: [
    {
      ...commercialFeature,
      properties: { ...commercialFeature.properties, depthInches: null, depthBand: "minor" },
    },
  ],
})[0];
assert.equal(shallowCommercial.label.text, "urban model");
assert.equal(shallowCommercial.label.kind, "commercial_model");

const badge = buildFloodMapBadge(overlay, 2);
assert.match(badge.badgeLabel, /^\d+ agency \+ \d+ glofas \+ \d+ urban zone\(s\)$/);

const prevUrban = process.env.URBAN_FLOOD_ENABLED;
const prevGlofas = process.env.GLOFAS_ENABLED;
process.env.URBAN_FLOOD_ENABLED = "true";
process.env.GLOFAS_ENABLED = "true";

convertUrbanFloodExport({ vendor: "jba" });
const live = buildFloodMapOverlay(2);
const liveCommercial = live.find((z) => z.confidence === "commercial_model");
assert.ok(liveCommercial, "merged live overlay includes commercial gap-fill zone");
assert.equal(liveCommercial.strokeDasharray, "1 3");

const liveBadge = buildFloodMapBadge(live, 2);
assert.ok(liveBadge.commercialGapZoneCount >= 1);
assert.match(liveBadge.badgeLabel, /urban zone\(s\)/);

process.env.URBAN_FLOOD_ENABLED = prevUrban;
process.env.GLOFAS_ENABLED = prevGlofas;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 16,
      commercialStroke: commercial.stroke,
      commercialLabel: commercial.label.text,
      badgeLabel: badge.badgeLabel,
      liveBadgeLabel: liveBadge.badgeLabel,
    },
    null,
    2
  )
);
