/** Phase 3b Day 6 — pipeline sync step + Monitor tool + EOC export urbanFlood block. */

import assert from "node:assert/strict";
import { runTool } from "../src/agents/runtime/tools.js";
import { buildUrbanFloodPipelineSyncStep, getUrbanFloodStatus } from "../src/geo/urban-flood.js";
import { buildFloodHazardCrossRef } from "../src/geo/hazards.js";
import { convertUrbanFloodExport } from "../src/geo/urban-flood-convert.js";
import { runMonitorBrief } from "../src/agents/monitor/brief.js";
import { buildEocAuditBriefing } from "../src/audit/eoc-export.js";
import { getMultiHazardStatus } from "../src/geo/multi-hazard.js";

const prevEnabled = process.env.URBAN_FLOOD_ENABLED;
const prevLive = process.env.URBAN_FLOOD_LIVE;
const prevGlofas = process.env.GLOFAS_ENABLED;
process.env.URBAN_FLOOD_ENABLED = "true";
process.env.URBAN_FLOOD_LIVE = "false";
process.env.GLOFAS_ENABLED = "true";

convertUrbanFloodExport({ vendor: "jba" });

const floodHazardSync = buildFloodHazardCrossRef(2);
const step = await buildUrbanFloodPipelineSyncStep(2, { floodHazardSync });

assert.equal(step.step, "urban_flood_sync");
assert.equal(step.monitorTool, "get_urban_flood_status");
assert.equal(step.phase, "phase-3b-day-7");
assert.equal(step.mergeRule, "agency_wins_then_commercial_then_glofas");
assert.equal(step.commercialGapZoneCount, floodHazardSync.commercialGapZoneCount);
assert.equal(step.refreshPolicy, "escalation_refresh");
assert.equal(step.refreshed, true);
assert.match(step.floodBadgeLabel, /^\d+ agency \+ \d+ glofas \+ \d+ urban zone\(s\)$/);
assert.equal(step.conversionPending, false);
assert.ok(step.syncAt);

const status = getUrbanFloodStatus(2);
assert.equal(status.pipelineStep, "urban_flood_sync");
assert.equal(status.monitorTool, "get_urban_flood_status");
assert.equal(status.phase, "phase-3b-day-7");
assert.equal(status.mergeRule, "agency_wins_then_commercial_then_glofas");
assert.ok(status.floodBadgeLabel);
assert.ok(status.commercialGapZoneCount != null);
assert.ok(Array.isArray(status.sampleZones));

const toolStatus = await runTool("get_urban_flood_status", { level: 2 });
assert.equal(toolStatus.pipelineStep, "urban_flood_sync");
assert.equal(toolStatus.enabled, true);
assert.ok(toolStatus.floodBadgeLabel);

const monitor = await runMonitorBrief();
const tools = monitor.toolResults.map((t) => t.tool);
assert.ok(tools.includes("get_urban_flood_status"));
assert.ok(monitor.brief.urbanFlood?.pipelineStep === "urban_flood_sync");
assert.ok(monitor.brief.urbanFlood?.floodBadgeLabel);

const eoc = await buildEocAuditBriefing({ level: 2, limit: 5 });
assert.equal(eoc.operatingPicture.urbanFlood.pipelineStep, "urban_flood_sync");
assert.equal(eoc.operatingPicture.urbanFlood.monitorTool, "get_urban_flood_status");
assert.ok(eoc.operatingPicture.urbanFlood.floodBadgeLabel);
assert.equal(eoc.phase, "phase-3b-day-7");

const multi = getMultiHazardStatus();
assert.equal(multi.phase, "phase-3b-day-7");
assert.ok(multi.sampleBriefings?.some((b) => b.floodSourceTag?.startsWith("flood:")));

process.env.URBAN_FLOOD_ENABLED = prevEnabled;
process.env.URBAN_FLOOD_LIVE = prevLive;
process.env.GLOFAS_ENABLED = prevGlofas;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 22,
      step: step.step,
      badge: step.floodBadgeLabel,
      eocUrban: eoc.operatingPicture.urbanFlood.floodBadgeLabel,
      monitorTools: tools.filter((t) => t.includes("urban") || t.includes("flood")),
    },
    null,
    2
  )
);
