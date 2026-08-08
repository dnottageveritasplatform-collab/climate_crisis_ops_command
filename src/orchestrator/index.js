import { runMonitorBrief } from "../agents/monitor/brief.js";
import { runTriageRank } from "../agents/triage/rank.js";
import { runActionPack } from "../agents/action/pack.js";
import { recordPipelineRun } from "../audit/index.js";
import { recordPipelineRun as recordPipelineEfficiency } from "../efficiency/index.js";
import { getHitlStatus } from "../hitl/index.js";
import { fetchSignals } from "../signals/index.js";

/**
 * Monitor → Triage → Action with triple HITL gate staged at end.
 */
export async function runPipeline({ level, refreshSignals = true } = {}) {
  const pipeStart = Date.now();
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

  const totalLatencyMs = Date.now() - pipeStart;
  const agents = {
    monitor: monitor.efficiency,
    triage: triage.efficiency,
    action: action.efficiency,
  };
  const modes = {
    monitor: monitor.mode,
    triage: triage.mode,
    action: action.mode,
  };
  const totalTokens =
    (monitor.efficiency?.tokens || 0) +
    (triage.efficiency?.tokens || 0) +
    (action.efficiency?.tokens || 0);

  const efficiency = recordPipelineEfficiency({
    pipelineId: audit.id,
    threshold,
    totalLatencyMs,
    totalTokens,
    agents,
    modes,
  });

  return {
    ok: true,
    phase: "week-3-day-21",
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
    efficiency,
    hitlGate: hitl.active ? hitl.state : "idle",
    message:
      "Pipeline complete — multi-agency brief, triage map sync, and COMMS-03 action pack staged. NEMT supervisor + PMH + Doctor's liaisons must review and approve.",
  };
}
