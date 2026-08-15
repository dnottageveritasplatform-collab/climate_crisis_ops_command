/** Phase 3b Day 10 — three-layer flood stack runbook + scope guard review tests. */

import assert from "node:assert/strict";
import {
  buildFloodStackRunbookPipelineStep,
  buildFloodStackRunbookSummary,
  getFloodStackRunbookStatus,
  FLOOD_STACK_SCOPE_GUARDS,
  FLOOD_STACK_TRUST_RULES,
} from "../src/geo/flood-stack-runbook.js";

const prevGlofas = process.env.GLOFAS_ENABLED;
const prevUrban = process.env.URBAN_FLOOD_ENABLED;
process.env.GLOFAS_ENABLED = "true";
process.env.URBAN_FLOOD_ENABLED = "true";

const summary = buildFloodStackRunbookSummary(2);
assert.equal(summary.phase, "phase-3b-day-10");
assert.equal(summary.step, "flood_stack_runbook_sync");
assert.equal(summary.ruleCount, 8);
assert.equal(summary.ruleCount, FLOOD_STACK_TRUST_RULES.length);
assert.equal(summary.scopeGuardCount, FLOOD_STACK_SCOPE_GUARDS.length);
assert.ok(summary.scopeGuardReview.bullets.length >= 8);
assert.match(summary.scopeGuardReview.defensibilityLine, /three|honest|label/i);
assert.ok(summary.currentPosture.primaryRuleId);
assert.equal(summary.currentPosture.hitlRequired, true);
assert.equal(summary.urbanValidationVerdict, "urban_layer_acceptable");

const status = getFloodStackRunbookStatus(2);
assert.match(status.runbookBadgeLabel, /^three-layer-8rules-/);

const step = buildFloodStackRunbookPipelineStep(2);
assert.equal(step.step, "flood_stack_runbook_sync");
assert.ok(step.runbookBadgeLabel.includes("three-layer"));
assert.ok(step.scopeGuardBadgeLabel.includes("three-layer"));

process.env.GLOFAS_ENABLED = "false";
process.env.URBAN_FLOOD_ENABLED = "false";
assert.equal(buildFloodStackRunbookPipelineStep(2), null);

process.env.GLOFAS_ENABLED = prevGlofas;
process.env.URBAN_FLOOD_ENABLED = prevUrban;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 16,
      primaryTrust: summary.currentPosture.primaryTrust,
      runbookBadgeLabel: step.runbookBadgeLabel,
      scopeGuardHeadline: summary.scopeGuardReview.headline,
      urbanValidationVerdict: summary.urbanValidationVerdict,
    },
    null,
    2
  )
);
