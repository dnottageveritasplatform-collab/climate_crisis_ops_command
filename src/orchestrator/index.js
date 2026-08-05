import { runMonitorBrief } from "../agents/monitor/brief.js";
import { runTriageRank } from "../agents/triage/rank.js";
import { runActionPack } from "../agents/action/pack.js";
import { recordPipelineRun } from "../audit/index.js";
import { getHitlStatus } from "../hitl/index.js";
import { fetchSignals } from "../signals/index.js";

/**
 * Day 12 orchestrator: Monitor → Triage → Action with triple HITL gate staged at end.
 * Demo mode — deterministic agent chain, no LLM required.
 */
export async function runPipeline({ level, refreshSignals = true } = {}) {
  const signals = await fetchSignals({ refresh: refreshSignals });

  const monitor = await runMonitorBrief();
  const threshold = level ?? signals.level ?? monitor.threshold ?? monitor.brief?.level ?? 2;

  const triage = await runTriageRank({ level: threshold });
  const action = await runActionPack({ level: threshold });

  const hitl = action.hitl ?? getHitlStatus();
  const audit = recordPipelineRun({
    signals,
    monitor,
    triage,
    action,
    hitl,
    threshold,
    mode: monitor.mode || "demo",
  });

  return {
    ok: true,
    phase: "week-2-day-12",
    pipelineId: audit.id,
    threshold,
    steps: ["monitor", "triage", "action"],
    signals,
    monitor,
    triage,
    action,
    map: triage.map,
    hitl,
    audit,
    hitlGate: hitl.active ? hitl.state : "idle",
    message:
      "Pipeline complete — Monitor brief, Triage ranking, Action pack staged. Triple HITL approval required before send.",
  };
}
