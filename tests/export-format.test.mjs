import assert from "node:assert/strict";
import { buildCopExport } from "../src/public-safety/index.js";
import { buildSopCorpusSummary } from "../src/sops/corpus.js";
import { buildRoutingPreviewSummary } from "../src/geo/routing.js";
import { buildMultiHazardSummary } from "../src/geo/multi-hazard.js";
import { buildSovereignDeployProfile } from "../src/deploy/sovereign.js";
import {
  formatCopExportText,
  formatMultiHazardText,
  formatRoutingPreviewText,
  formatSopCorpusText,
  formatSovereignDeployText,
} from "../src/export/formatters.js";
import { wrapBriefingHtml } from "../src/export/briefing-shell.js";

const cop = await buildCopExport(2);
const copText = formatCopExportText(cop);
assert.ok(copText.includes("COMMON OPERATING PICTURE"));
assert.ok(copText.includes("Situation"));
assert.ok(!copText.startsWith("{"));

const sop = buildSopCorpusSummary();
const sopText = formatSopCorpusText(sop);
assert.ok(sopText.includes("OPERATOR SOP CORPUS"));

const routing = buildRoutingPreviewSummary(2);
const routingText = formatRoutingPreviewText(routing);
assert.ok(routingText.includes("ROUTING PREVIEW"));

const fusion = buildMultiHazardSummary(2);
const fusionText = formatMultiHazardText(fusion);
assert.ok(fusionText.includes("MULTI-HAZARD FUSION"));

const sovereign = buildSovereignDeployProfile();
const sovereignText = formatSovereignDeployText(sovereign);
assert.ok(sovereignText.includes("SOVEREIGN ON-PREM"));

const html = wrapBriefingHtml({
  pageTitle: "Test",
  subtitle: "Subtitle",
  text: "Hello briefing",
  jsonHref: "?format=json",
});
assert.ok(html.includes("<!DOCTYPE html>"));
assert.ok(html.includes("Hello briefing"));

console.log("export-format.test.mjs OK");
