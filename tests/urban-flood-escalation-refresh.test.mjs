/** Phase 3b Day 7 — escalation-gated urban flood refresh + stale vendor warning. */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildUrbanFloodPipelineSyncStep,
  getUrbanFloodStatus,
  getUrbanFloodStaleThresholdHours,
  shouldRefreshUrbanFloodOnPipeline,
} from "../src/geo/urban-flood.js";
import { getUrbanFloodVendorStatus, writeUrbanFloodCache } from "../src/geo/urban-flood-vendor.js";
import { convertUrbanFloodExport } from "../src/geo/urban-flood-convert.js";

const prevEnabled = process.env.URBAN_FLOOD_ENABLED;
const prevMinLevel = process.env.URBAN_FLOOD_ESCALATION_MIN_LEVEL;
const prevStaleHours = process.env.URBAN_FLOOD_STALE_HOURS;
const prevLive = process.env.URBAN_FLOOD_LIVE;
const prevCachePath = process.env.URBAN_FLOOD_CACHE_PATH;

process.env.URBAN_FLOOD_ENABLED = "true";
process.env.URBAN_FLOOD_ESCALATION_MIN_LEVEL = "2";
process.env.URBAN_FLOOD_STALE_HOURS = "24";
process.env.URBAN_FLOOD_LIVE = "false";

const testCachePath = path.join(process.cwd(), "data/geo/urban-flood-test-cache.json");
process.env.URBAN_FLOOD_CACHE_PATH = testCachePath;

try {
  convertUrbanFloodExport({ vendor: "jba" });

  assert.equal(shouldRefreshUrbanFloodOnPipeline(1), false);
  assert.equal(shouldRefreshUrbanFloodOnPipeline(2), true);
  assert.equal(getUrbanFloodStaleThresholdHours(), 24);

  const l1Step = await buildUrbanFloodPipelineSyncStep(1);
  assert.equal(l1Step.refreshed, false);
  assert.equal(l1Step.skippedRefresh, true);
  assert.equal(l1Step.refreshPolicy, "skipped_below_L2");
  assert.equal(l1Step.mode, "urban_flood_status_only");
  assert.equal(l1Step.phase, "phase-3b-day-7");

  const l2Step = await buildUrbanFloodPipelineSyncStep(2);
  assert.equal(l2Step.refreshed, true);
  assert.equal(l2Step.skippedRefresh, false);
  assert.equal(l2Step.refreshPolicy, "escalation_refresh");
  assert.equal(l2Step.phase, "phase-3b-day-7");

  const staleAt = new Date(Date.now() - 30 * 3600000).toISOString();
  writeUrbanFloodCache({
    lastSuccessfulFetchAt: staleAt,
    ok: true,
    fetchMode: "vendor_grid_converted",
    conversionPending: false,
  });

  const vendorStatus = getUrbanFloodVendorStatus();
  assert.ok(vendorStatus.staleWarning);
  assert.ok(vendorStatus.staleHours > 24);
  assert.equal(vendorStatus.staleThresholdHours, 24);
  assert.equal(vendorStatus.phase, "phase-3b-day-7");

  const status = getUrbanFloodStatus(2);
  assert.equal(status.staleWarning, true);
  assert.ok(status.staleHours > 24);
  assert.equal(status.refreshPolicy, "escalation_refresh");

  console.log(
    JSON.stringify(
      {
        ok: true,
        tests: 16,
        l1Policy: l1Step.refreshPolicy,
        l2Policy: l2Step.refreshPolicy,
        staleHours: vendorStatus.staleHours,
      },
      null,
      2
    )
  );
} finally {
  process.env.URBAN_FLOOD_ENABLED = prevEnabled;
  process.env.URBAN_FLOOD_ESCALATION_MIN_LEVEL = prevMinLevel;
  process.env.URBAN_FLOOD_STALE_HOURS = prevStaleHours;
  process.env.URBAN_FLOOD_LIVE = prevLive;
  process.env.URBAN_FLOOD_CACHE_PATH = prevCachePath;
  if (fs.existsSync(testCachePath)) fs.unlinkSync(testCachePath);
}
