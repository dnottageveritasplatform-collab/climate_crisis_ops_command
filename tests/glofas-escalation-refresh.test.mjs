/** Phase 3 Day 7 — escalation-gated GloFAS refresh + stale EWDS warning. */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildGlofasPipelineSyncStep,
  getGlofasFloodStatus,
  getGlofasStaleThresholdHours,
  shouldRefreshGlofasOnPipeline,
} from "../src/geo/glofas.js";
import { getGlofasCdsStatus, writeGlofasCdsCache } from "../src/geo/glofas-cds.js";

const prevEnabled = process.env.GLOFAS_ENABLED;
const prevMinLevel = process.env.GLOFAS_ESCALATION_MIN_LEVEL;
const prevStaleHours = process.env.GLOFAS_STALE_HOURS;
const prevCachePath = process.env.GLOFAS_CDS_CACHE_PATH;

process.env.GLOFAS_ENABLED = "true";
process.env.GLOFAS_ESCALATION_MIN_LEVEL = "2";
process.env.GLOFAS_STALE_HOURS = "36";

const testCachePath = path.join(process.cwd(), "data/geo/glofas-cds-test-cache.json");
process.env.GLOFAS_CDS_CACHE_PATH = testCachePath;

try {
  assert.equal(shouldRefreshGlofasOnPipeline(1), false);
  assert.equal(shouldRefreshGlofasOnPipeline(2), true);
  assert.equal(getGlofasStaleThresholdHours(), 36);

  const l1Step = await buildGlofasPipelineSyncStep(1);
  assert.equal(l1Step.refreshed, false);
  assert.equal(l1Step.skippedRefresh, true);
  assert.equal(l1Step.refreshPolicy, "skipped_below_L2");
  assert.equal(l1Step.mode, "glofas_status_only");

  const l2Step = await buildGlofasPipelineSyncStep(2);
  assert.equal(l2Step.refreshed, true);
  assert.equal(l2Step.skippedRefresh, false);
  assert.equal(l2Step.refreshPolicy, "escalation_refresh");
  assert.equal(l2Step.phase, "phase-3-day-10");

  const staleAt = new Date(Date.now() - 40 * 3600000).toISOString();
  writeGlofasCdsCache({
    lastSuccessfulFetchAt: staleAt,
    ok: true,
    fetchMode: "cds_grid_converted",
  });

  const cdsStatus = getGlofasCdsStatus();
  assert.ok(cdsStatus.staleWarning);
  assert.ok(cdsStatus.staleHours > 36);
  assert.equal(cdsStatus.staleThresholdHours, 36);
  assert.equal(cdsStatus.phase, "phase-3-day-10");

  const status = getGlofasFloodStatus(2);
  assert.equal(status.staleWarning, true);
  assert.ok(status.staleHours > 36);

  console.log(
    JSON.stringify(
      {
        ok: true,
        tests: 14,
        l1Policy: l1Step.refreshPolicy,
        l2Policy: l2Step.refreshPolicy,
        staleHours: cdsStatus.staleHours,
      },
      null,
      2
    )
  );
} finally {
  process.env.GLOFAS_ENABLED = prevEnabled;
  process.env.GLOFAS_ESCALATION_MIN_LEVEL = prevMinLevel;
  process.env.GLOFAS_STALE_HOURS = prevStaleHours;
  process.env.GLOFAS_CDS_CACHE_PATH = prevCachePath;
  if (fs.existsSync(testCachePath)) fs.unlinkSync(testCachePath);
}
