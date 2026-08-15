/** Phase 3 Day 5 — unit tests for flood map overlay labels + badge. */

import assert from "node:assert/strict";
import { buildFloodMapBadge, buildFloodMapOverlay } from "../src/geo/hazards.js";

const prevEnabled = process.env.GLOFAS_ENABLED;
const prevUrban = process.env.URBAN_FLOOD_ENABLED;
process.env.GLOFAS_ENABLED = "true";
process.env.URBAN_FLOOD_ENABLED = "false";

const zones = buildFloodMapOverlay(2);
assert.ok(zones.length >= 2, "merged overlay has agency + gap-fill zones");

const agency = zones.find((z) => z.confidence === "agency_confirmed");
const glofas = zones.find((z) => z.confidence === "model_estimated");
assert.ok(agency, "agency zone present");
assert.ok(glofas, "glofas gap zone present");
assert.equal(agency.strokeDasharray, undefined, "agency flood is solid stroke");
assert.equal(glofas.strokeDasharray, "4 2", "glofas flood is dashed stroke");
assert.match(agency.label.text, /"/, "agency label shows depth inches");
assert.equal(agency.depthInches != null, true);
assert.equal(glofas.depthInches, null, "glofas overlay omits fake inch depth");
assert.ok(glofas.label.text === "model" || glofas.label.text.startsWith("~"), "glofas label is model or return period");

const badge = buildFloodMapBadge(zones, 2);
assert.equal(badge.glofasEnabled, true);
assert.match(badge.badgeLabel, /^\d+ agency \+ \d+ glofas zone\(s\)$/);
assert.equal(badge.agencyZoneCount + badge.glofasGapZoneCount, badge.totalCount);

process.env.GLOFAS_ENABLED = "false";
const agencyOnly = buildFloodMapOverlay(2);
const agencyBadge = buildFloodMapBadge(agencyOnly, 2);
assert.match(agencyBadge.badgeLabel, /flood zone\(s\)$/);
assert.equal(agencyBadge.glofasEnabled, false);

process.env.GLOFAS_ENABLED = prevEnabled;
process.env.URBAN_FLOOD_ENABLED = prevUrban;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 12,
      badgeLabel: badge.badgeLabel,
      agencyLabel: agency.label.text,
      glofasLabel: glofas.label.text,
    },
    null,
    2
  )
);
