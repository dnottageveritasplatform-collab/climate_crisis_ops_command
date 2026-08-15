/** Phase 3b Day 1 — commercial urban flood adapter tests. */

import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  activeUrbanFloodZones,
  buildUrbanFloodCrossRef,
  buildUrbanFloodSummary,
  ingestUrbanFloodWebhook,
  isUrbanFloodEnabled,
  loadUrbanFloodLayer,
  parseUrbanFloodClipBbox,
  URBAN_FLOOD_CLIP_BBOX,
} from "../src/geo/urban-flood.js";
import { convertUrbanFloodExport, DEFAULT_CLIP_PATH } from "../src/geo/urban-flood-convert.js";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/geo");
const demoPath = path.join(geoRoot, "urban-flood-nassau-demo.json");

const prevEnabled = process.env.URBAN_FLOOD_ENABLED;
const prevDemo = process.env.URBAN_FLOOD_DEMO;
process.env.URBAN_FLOOD_ENABLED = "true";
process.env.URBAN_FLOOD_DEMO = "true";

convertUrbanFloodExport({ vendor: "jba" });
assert.ok(fs.existsSync(DEFAULT_CLIP_PATH), "converted clip should exist");

const layer = loadUrbanFloodLayer({ refresh: true });
assert.equal(layer.meta.ok, true);
assert.ok(layer.meta.featureCount >= 4);
assert.equal(layer.meta.fetchMode, "vendor_grid_converted");
assert.equal(layer.meta.vendor, "jba");

const zones = activeUrbanFloodZones(2, layer);
assert.ok(zones.length >= 4);
assert.equal(zones[0].properties.confidence, "commercial_model");
assert.equal(zones[0].properties.source, "commercial");

const summary = buildUrbanFloodSummary(2);
assert.equal(summary.phase, "phase-3b-day-7");
assert.equal(summary.enabled, true);
assert.ok(summary.activeZoneCount >= 4);
assert.equal(summary.mergeRule, "agency_wins_then_commercial_then_glofas");
assert.equal(summary.conversionPending, false);

const crossRef = buildUrbanFloodCrossRef(2);
assert.equal(crossRef.mode, "commercial_urban_flood");
assert.ok(crossRef.zoneMatches.length >= 1);

const ingested = ingestUrbanFloodWebhook({
  features: zones.slice(0, 2),
  vendor: "jba",
  source: "urban_flood_webhook_test",
});
assert.equal(ingested.ingested, 2);
assert.equal(ingested.vendor, "jba");

assert.deepEqual(parseUrbanFloodClipBbox(), URBAN_FLOOD_CLIP_BBOX);
assert.equal(parseUrbanFloodClipBbox("-77.34,-77.30,25.04,25.08").minLon, -77.34);

process.env.URBAN_FLOOD_ENABLED = "false";
assert.equal(activeUrbanFloodZones(2, layer).length, 0);

process.env.URBAN_FLOOD_ENABLED = prevEnabled;
process.env.URBAN_FLOOD_DEMO = prevDemo;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 14,
      featureCount: layer.meta.featureCount,
      fetchMode: layer.meta.fetchMode,
      clipBbox: layer.meta.clipBbox,
    },
    null,
    2
  )
);
