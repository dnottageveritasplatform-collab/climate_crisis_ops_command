/** Phase 3 Day 10 — GloFAS pilot runbook + scope guard review tests. */

import assert from "node:assert/strict";
import {
  buildGlofasRunbookPipelineStep,
  buildGlofasRunbookSummary,
  getGlofasRunbookStatus,
  GLOFAS_SCOPE_GUARDS,
  GLOFAS_TRUST_RULES,
} from "../src/geo/glofas-runbook.js";

const prevEnabled = process.env.GLOFAS_ENABLED;
process.env.GLOFAS_ENABLED = "true";

const summary = buildGlofasRunbookSummary(2);
assert.equal(summary.phase, "phase-3-day-10");
assert.equal(summary.step, "glofas_runbook_sync");
assert.equal(summary.ruleCount, GLOFAS_TRUST_RULES.length);
assert.equal(summary.scopeGuardCount, GLOFAS_SCOPE_GUARDS.length);
assert.ok(summary.scopeGuardReview.bullets.length >= 6);
assert.match(summary.scopeGuardReview.defensibilityLine, /labeling|gap-fill/i);
assert.ok(summary.currentPosture.primaryRuleId);
assert.equal(summary.currentPosture.hitlRequired, true);

const status = getGlofasRunbookStatus(2);
assert.match(status.runbookBadgeLabel, /^agency-first-6rules-/);

const step = buildGlofasRunbookPipelineStep(2);
assert.equal(step.step, "glofas_runbook_sync");
assert.ok(step.runbookBadgeLabel.includes("agency-first"));
assert.ok(step.scopeGuardBadgeLabel.includes("gap-fill"));

process.env.GLOFAS_ENABLED = "false";
assert.equal(buildGlofasRunbookPipelineStep(2), null);
process.env.GLOFAS_ENABLED = prevEnabled;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 12,
      primaryTrust: summary.currentPosture.primaryTrust,
      runbookBadgeLabel: step.runbookBadgeLabel,
      scopeGuardHeadline: summary.scopeGuardReview.headline,
    },
    null,
    2
  )
);
