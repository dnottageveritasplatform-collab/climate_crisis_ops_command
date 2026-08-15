/** Phase 3 Day 3 — unit tests for GloFAS grid → polygon conversion. */

import assert from "node:assert/strict";
import {
  convertGlofasGridToFeatures,
  dischargeToDepthBand,
  dischargeToReturnPeriodYears,
  gridCellPolygon,
  inferLinkedCorridors,
} from "../src/geo/glofas-convert.js";

const demoGrid = {
  clipBbox: { minLon: -77.36, maxLon: -77.24, minLat: 25.03, maxLat: 25.10 },
  gridResolutionDeg: 0.05,
  dischargeThresholdM3s: 70,
  cells: [
    { lon: -77.31, lat: 25.048, dischargeM3s: 142, linkedCorridors: ["CORR-02"] },
    { lon: -77.336, lat: 25.053, dischargeM3s: 88, linkedCorridors: ["CORR-01"] },
    { lon: -77.28, lat: 25.04, dischargeM3s: 45, linkedCorridors: ["CORR-02"] },
  ],
};

assert.equal(dischargeToDepthBand(142), "moderate");
assert.equal(dischargeToDepthBand(88), "minor");
assert.equal(dischargeToDepthBand(200), "major");
assert.equal(dischargeToDepthBand(40), null);
assert.equal(dischargeToReturnPeriodYears(142), 5);

const ring = gridCellPolygon(-77.31, 25.048, 0.05)[0];
assert.ok(ring[0][0] < -77.31 && ring[1][0] > -77.31);

assert.deepEqual(inferLinkedCorridors(-77.31, 25.048), ["CORR-02"]);
assert.deepEqual(inferLinkedCorridors(-77.34, 25.07), ["CORR-01"]);

const fc = convertGlofasGridToFeatures(demoGrid);
assert.equal(fc.features.length, 2, "filters sub-threshold cell");
assert.equal(fc.features[0].properties.depthBand, "moderate");
assert.equal(fc.features[0].properties.source, "glofas");
assert.equal(fc.features[0].geometry.type, "Polygon");
assert.equal(fc.features[1].properties.linkedCorridors[0], "CORR-01");

console.log(JSON.stringify({ ok: true, tests: 10, featureCount: fc.features.length }, null, 2));
