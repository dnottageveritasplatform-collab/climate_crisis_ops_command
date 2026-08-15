/** Phase 3 Day 9 — GloFAS sovereign air-gap bundle tests. */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildGlofasAirGapPipelineStep,
  buildGlofasAirGapProfile,
} from "../src/geo/glofas-sovereign.js";
import { DEFAULT_CLIP_PATH } from "../src/geo/glofas-convert.js";

const prevEnabled = process.env.GLOFAS_ENABLED;
process.env.GLOFAS_ENABLED = "true";
process.env.GLOFAS_LIVE = "false";
process.env.GLOFAS_AIRGAP = "true";

const profile = buildGlofasAirGapProfile();
assert.equal(profile.phase, "phase-3-day-10");
assert.equal(profile.fetchPolicy, "offline_clip_only");
assert.ok(fs.existsSync(DEFAULT_CLIP_PATH), "pre-downloaded clip should exist");
assert.equal(profile.clipReady, true);
assert.ok(profile.clipFeatureCount >= 1);
assert.ok(profile.bundleFiles.find((b) => b.id === "clip")?.ok);

const step = buildGlofasAirGapPipelineStep();
assert.equal(step.step, "glofas_airgap_sync");
assert.match(step.airGapBadgeLabel, /^air-gap clip · \d+ feature\(s\)$/);

process.env.GLOFAS_ENABLED = prevEnabled;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 8,
      clipFeatureCount: profile.clipFeatureCount,
      bundleFileCount: profile.bundleFileCount,
      airGapBadgeLabel: step.airGapBadgeLabel,
    },
    null,
    2
  )
);
