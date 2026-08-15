/** Phase 3 Day 8 — GloFAS historical validation spike tests. */

import assert from "node:assert/strict";
import {
  buildGlofasValidationPipelineStep,
  buildGlofasValidationReport,
  buildGlofasValidationSummary,
  getGlofasValidationCatalog,
} from "../src/geo/glofas-validation.js";

const prevEnabled = process.env.GLOFAS_ENABLED;
process.env.GLOFAS_ENABLED = "true";

const catalog = getGlofasValidationCatalog();
assert.equal(catalog.events.length, 2);

const alma = buildGlofasValidationReport("alma-2016");
assert.ok(alma.ok);
assert.equal(alma.eventId, "alma-2016");
assert.ok(alma.goodFitCount >= 1);
assert.equal(alma.decisionGate.verdict, "continue_glofas");

const dorian = buildGlofasValidationReport("dorian-2019");
assert.ok(dorian.ok);
assert.equal(dorian.eventId, "dorian-2019");
assert.ok(
  dorian.comparisons.some((c) => c.fit === "urban_pluvial_misfit") ||
    dorian.agencyOnly.some((a) => a.fit === "agency_urban_pluvial_miss")
);
assert.equal(dorian.decisionGate.verdict, "continue_glofas_urban_caveat");
assert.equal(dorian.decisionGate.commercialReviewRecommended, true);

const summary = buildGlofasValidationSummary();
assert.equal(summary.eventCount, 2);
assert.equal(summary.decisionGate.verdict, "continue_glofas_urban_caveat");
assert.equal(summary.decisionGate.commercialReviewRecommended, true);

const step = buildGlofasValidationPipelineStep();
assert.equal(step.step, "glofas_validation_sync");
assert.equal(step.phase, "phase-3-day-10");
assert.ok(step.validationBadgeLabel.includes("alma"));

process.env.GLOFAS_ENABLED = prevEnabled;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 14,
      almaVerdict: alma.decisionGate.verdict,
      dorianVerdict: dorian.decisionGate.verdict,
      rollup: summary.decisionGate.verdict,
    },
    null,
    2
  )
);
