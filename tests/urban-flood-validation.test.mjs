/** Phase 3b Day 8 — commercial urban flood Dorian re-validation tests. */

import assert from "node:assert/strict";
import {
  buildUrbanFloodValidationPipelineStep,
  buildUrbanFloodValidationReport,
  buildUrbanFloodValidationSummary,
  getUrbanFloodValidationCatalog,
} from "../src/geo/urban-flood-validation.js";

const prevEnabled = process.env.URBAN_FLOOD_ENABLED;
process.env.URBAN_FLOOD_ENABLED = "true";

const catalog = getUrbanFloodValidationCatalog();
assert.equal(catalog.events.length, 1);

const dorian = buildUrbanFloodValidationReport("dorian-2019");
assert.ok(dorian.ok);
assert.equal(dorian.eventId, "dorian-2019");
assert.equal(dorian.focusAgencyZoneId, "FLOOD-04");
assert.ok(dorian.focusZoneComparison);
assert.equal(dorian.focusZoneComparison.commercialZoneId, "URBAN-01");
assert.equal(dorian.focusZoneComparison.commercialIou, 1);
assert.ok(dorian.focusZoneComparison.glofasBaselineIou < 0.2);
assert.equal(dorian.focusZoneComparison.glofasImprovement, true);
assert.ok(dorian.comparisons.some((c) => c.fit === "good_urban_overlap"));
assert.equal(dorian.decisionGate.verdict, "urban_layer_acceptable");
assert.equal(dorian.decisionGate.stayAgencyOnlyRecommended, false);

const summary = buildUrbanFloodValidationSummary();
assert.equal(summary.eventCount, 1);
assert.equal(summary.decisionGate.verdict, "urban_layer_acceptable");
assert.equal(summary.decisionGate.stayAgencyOnlyRecommended, false);

const step = buildUrbanFloodValidationPipelineStep();
assert.equal(step.step, "urban_flood_validation_sync");
assert.equal(step.phase, "phase-3b-day-8");
assert.ok(step.validationBadgeLabel.includes("dorian:acceptable"));
assert.equal(step.badge, "urban-layer-acceptable");

process.env.URBAN_FLOOD_ENABLED = prevEnabled;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 16,
      dorianVerdict: dorian.decisionGate.verdict,
      flood04CommercialIou: dorian.focusZoneComparison.commercialIou,
      glofasBaselineIou: dorian.focusZoneComparison.glofasBaselineIou,
      rollup: summary.decisionGate.verdict,
    },
    null,
    2
  )
);
