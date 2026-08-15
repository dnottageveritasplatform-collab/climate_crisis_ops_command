/** Phase 3b Day 3 — unit tests for urban flood grid → polygon conversion. */

import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  convertUrbanFloodGridToFeatures,
  convertUrbanFloodExport,
  depthInchesToDepthBand,
  depthInchesToReturnPeriodYears,
  gridCellPolygon,
  inferUrbanLinkedCorridors,
  DEFAULT_CLIP_PATH,
} from "../src/geo/urban-flood-convert.js";

const demoGrid = {
  clipBbox: { minLon: -77.34, maxLon: -77.3, minLat: 25.04, maxLat: 25.08 },
  gridResolutionDeg: 0.001,
  depthThresholdInches: 4,
  vendor: "jba",
  cells: [
    { lon: -77.326, lat: 25.063, depthInches: 12, linkedCorridors: ["CORR-02"] },
    { lon: -77.326, lat: 25.054, depthInches: 8, linkedCorridors: ["CORR-02"] },
    { lon: -77.32, lat: 25.05, depthInches: 2, linkedCorridors: ["CORR-02"] },
  ],
};

assert.equal(depthInchesToDepthBand(12), "major");
assert.equal(depthInchesToDepthBand(8), "moderate");
assert.equal(depthInchesToDepthBand(5), "minor");
assert.equal(depthInchesToDepthBand(2), null);
assert.equal(depthInchesToReturnPeriodYears(12), 10);

const ring = gridCellPolygon(-77.326, 25.063, 0.001)[0];
assert.ok(ring[0][0] < -77.326 && ring[1][0] > -77.326);

assert.deepEqual(inferUrbanLinkedCorridors(-77.326, 25.063), ["CORR-02"]);

const fc = convertUrbanFloodGridToFeatures(demoGrid);
assert.equal(fc.features.length, 2, "filters sub-threshold cell");
assert.equal(fc.features[0].properties.depthBand, "major");
assert.equal(fc.features[0].properties.source, "commercial");
assert.equal(fc.features[0].properties.confidence, "commercial_model");
assert.equal(fc.features[0].properties.vendor, "jba");
assert.equal(fc.features[0].geometry.type, "Polygon");

const testClip = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/geo/urban-flood-nassau-latest-test.json"
);
const converted = convertUrbanFloodExport({ clipPath: testClip, vendor: "jba" });
assert.equal(converted.ok, true);
assert.equal(converted.fetchMode, "vendor_grid_converted");
assert.equal(converted.conversionPending, false);
assert.ok(converted.featureCount >= 4);
assert.ok(fs.existsSync(testClip));
fs.unlinkSync(testClip);

if (fs.existsSync(DEFAULT_CLIP_PATH)) {
  const latest = JSON.parse(fs.readFileSync(DEFAULT_CLIP_PATH, "utf8"));
  assert.ok(latest.features.length >= 4);
}

console.log(
  JSON.stringify(
    { ok: true, tests: 14, featureCount: fc.features.length, clipExists: fs.existsSync(DEFAULT_CLIP_PATH) },
    null,
    2
  )
);
