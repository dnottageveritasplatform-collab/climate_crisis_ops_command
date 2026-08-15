/** Phase 3 Day 6 — pipeline sync step + Monitor tool status. */

import assert from "node:assert/strict";
import { runTool } from "../src/agents/runtime/tools.js";
import { buildGlofasPipelineSyncStep, getGlofasFloodStatus } from "../src/geo/glofas.js";
import { buildFloodHazardCrossRef } from "../src/geo/hazards.js";
import { runMonitorBrief } from "../src/agents/monitor/brief.js";

const prevEnabled = process.env.GLOFAS_ENABLED;
process.env.GLOFAS_ENABLED = "true";

const floodHazardSync = buildFloodHazardCrossRef(2);
const step = await buildGlofasPipelineSyncStep(2, { floodHazardSync });

assert.equal(step.step, "glofas_flood_sync");
assert.equal(step.monitorTool, "get_glofas_flood_status");
assert.equal(step.phase, "phase-3-day-10");
assert.equal(step.mergeRule, "agency_wins_corridor");
assert.match(step.floodBadgeLabel, /^\d+ agency \+ \d+ glofas zone\(s\)$/);
assert.ok(step.syncAt);

const status = getGlofasFloodStatus(2);
assert.equal(status.pipelineStep, "glofas_flood_sync");
assert.equal(status.monitorTool, "get_glofas_flood_status");
assert.equal(status.mergeRule, "agency_wins_corridor");
assert.ok(status.floodBadgeLabel);

const toolStatus = await runTool("get_glofas_flood_status", { level: 2 });
assert.equal(toolStatus.pipelineStep, "glofas_flood_sync");
assert.equal(toolStatus.enabled, true);

const monitor = await runMonitorBrief();
const tools = monitor.toolResults.map((t) => t.tool);
assert.ok(tools.includes("get_flood_hazard_status"));
assert.ok(tools.includes("get_glofas_flood_status"));
assert.ok(monitor.brief.glofasFlood?.pipelineStep === "glofas_flood_sync");

process.env.GLOFAS_ENABLED = prevEnabled;

console.log(
  JSON.stringify(
    {
      ok: true,
      tests: 12,
      step: step.step,
      badge: step.floodBadgeLabel,
      monitorTools: tools.filter((t) => t.includes("flood") || t.includes("glofas")),
    },
    null,
    2
  )
);
