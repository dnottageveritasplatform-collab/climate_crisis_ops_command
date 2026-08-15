/** Phase 3b Day 2 — vendor cache + credential probe tests. */

import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  fetchUrbanFloodFromVendor,
  getUrbanFloodVendorConfig,
  getUrbanFloodVendorStatus,
  getUrbanFloodStaleThresholdHours,
  readUrbanFloodCache,
  writeUrbanFloodCache,
} from "../src/geo/urban-flood-vendor.js";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/geo");
const cachePath = path.join(geoRoot, "urban-flood-cache-test.json");

const prevVendor = process.env.URBAN_FLOOD_VENDOR;
const prevKey = process.env.URBAN_FLOOD_API_KEY;
const prevMock = process.env.URBAN_FLOOD_API_MOCK;
const prevCache = process.env.URBAN_FLOOD_CACHE_PATH;

process.env.URBAN_FLOOD_CACHE_PATH = cachePath;
if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);

assert.equal(getUrbanFloodStaleThresholdHours(), 24);

process.env.URBAN_FLOOD_VENDOR = "demo";
delete process.env.URBAN_FLOOD_API_KEY;
delete process.env.URBAN_FLOOD_API_MOCK;

const demoFetch = await fetchUrbanFloodFromVendor({ refresh: true });
assert.equal(demoFetch.ok, false);
assert.equal(demoFetch.reason, "demo_vendor");
assert.equal(demoFetch.fallback, "demo_json");
assert.equal(demoFetch.conversionPending, false);
assert.ok(demoFetch.conversion?.featureCount >= 4);

process.env.URBAN_FLOOD_VENDOR = "fathom";
const missingKey = await fetchUrbanFloodFromVendor({ refresh: true });
assert.equal(missingKey.reason, "missing_api_key");

process.env.URBAN_FLOOD_API_MOCK = "true";
process.env.URBAN_FLOOD_API_KEY = "test-key-not-real";
const mockFetch = await fetchUrbanFloodFromVendor({ refresh: true });
assert.equal(mockFetch.ok, true);
assert.equal(mockFetch.reason, "vendor_mock");
assert.equal(mockFetch.fetchMode, "vendor_grid_converted");
assert.equal(mockFetch.conversionPending, false);

const cache = readUrbanFloodCache();
assert.ok(cache?.lastSuccessfulFetchAt);
assert.equal(cache.catalogueOk, true);
assert.equal(cache.conversionPending, false);
assert.ok(cache.featureCount >= 4);

writeUrbanFloodCache({ featureCount: 2, clipPath: "data/geo/urban-flood-nassau-demo.json" });
const merged = readUrbanFloodCache();
assert.equal(merged.featureCount, 2);

const cfg = getUrbanFloodVendorConfig();
assert.equal(cfg.vendor, "fathom");
assert.equal(cfg.keyConfigured, true);
assert.equal(cfg.mock, true);

const status = getUrbanFloodVendorStatus();
assert.equal(status.phase, "phase-3b-day-7");
assert.equal(status.catalogueOk, true);
assert.equal(status.conversionPending, false);
assert.equal(status.docs, "docs/urban-flood-vendor-setup.md");

if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
process.env.URBAN_FLOOD_VENDOR = prevVendor;
process.env.URBAN_FLOOD_API_KEY = prevKey;
process.env.URBAN_FLOOD_API_MOCK = prevMock;
process.env.URBAN_FLOOD_CACHE_PATH = prevCache;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 16,
      mockFetchMode: mockFetch.fetchMode,
      staleThresholdHours: getUrbanFloodStaleThresholdHours(),
    },
    null,
    2
  )
);
