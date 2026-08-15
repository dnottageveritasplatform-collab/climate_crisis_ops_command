/** Phase 3b Day 9 — commercial urban flood sovereign air-gap bundle tests. */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildUrbanFloodAirGapPipelineStep,
  buildUrbanFloodAirGapProfile,
} from "../src/geo/urban-flood-sovereign.js";
import { DEFAULT_CLIP_PATH } from "../src/geo/urban-flood-convert.js";
import { buildSovereignDeployProfile } from "../src/deploy/sovereign.js";

const prevEnabled = process.env.URBAN_FLOOD_ENABLED;
process.env.URBAN_FLOOD_ENABLED = "true";
process.env.URBAN_FLOOD_LIVE = "false";
process.env.URBAN_FLOOD_AIRGAP = "true";

const profile = buildUrbanFloodAirGapProfile();
assert.equal(profile.phase, "phase-3b-day-9");
assert.equal(profile.fetchPolicy, "offline_clip_only");
assert.ok(fs.existsSync(DEFAULT_CLIP_PATH), "pre-downloaded urban clip should exist");
assert.equal(profile.clipReady, true);
assert.ok(profile.clipFeatureCount >= 1);
assert.ok(profile.bundleFiles.find((b) => b.id === "clip")?.ok);

const step = buildUrbanFloodAirGapPipelineStep();
assert.equal(step.step, "urban_flood_airgap_sync");
assert.match(step.airGapBadgeLabel, /^urban air-gap clip · \d+ feature\(s\)$/);

const sovereign = buildSovereignDeployProfile();
const urbanCheck = sovereign.checks.find((c) => c.name === "urban_flood_airgap_clip");
assert.ok(urbanCheck);
assert.equal(urbanCheck.ok, true);
assert.ok(urbanCheck.detail.includes("urban-flood-nassau-latest.json"));

process.env.URBAN_FLOOD_ENABLED = prevEnabled;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 12,
      clipFeatureCount: profile.clipFeatureCount,
      bundleFileCount: profile.bundleFileCount,
      airGapBadgeLabel: step.airGapBadgeLabel,
      sovereignChecks: sovereign.summary,
    },
    null,
    2
  )
);
