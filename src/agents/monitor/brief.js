import { config } from "../../config.js";
import { beginAgentRun, endAgentRun } from "../../efficiency/index.js";
import { recordMonitorBrief } from "../../audit/index.js";
import { logAgentEvent } from "../runtime/logger.js";
import { callLlmJson, getLlmConfig } from "../runtime/llm.js";
import { listTools, runTool } from "../runtime/tools.js";

/**
 * Day 5 Monitor agent: threshold-driven tool plan → structured brief with SOP citations.
 */
export async function runMonitorBrief() {
  const agent = "monitor";
  const startedAt = beginAgentRun(agent);
  logAgentEvent("agent_start", { agent, message: "Monitor brief started" });

  logAgentEvent("tool_call", { agent, tool: "get_signal_status", args: {} });
  const signalResult = await runTool("get_signal_status", {});
  logAgentEvent("tool_result", { agent, tool: "get_signal_status", args: {}, result: signalResult });

  const toolResults = [{ tool: "get_signal_status", result: signalResult }];
  const followUp = planAfterThreshold(signalResult);

  for (const step of followUp) {
    logAgentEvent("tool_call", { agent, tool: step.tool, args: step.args });
    const result = await runTool(step.tool, step.args);
    toolResults.push({ tool: step.tool, args: step.args, result });
    logAgentEvent("tool_result", { agent, tool: step.tool, args: step.args, result });
  }

  let brief;
  let mode = "demo";
  const llm = getLlmConfig();

  if (llm.enabled && !config.demoMode) {
    mode = llm.provider;
    const { json } = await callLlmJson({
      llm,
      agent,
      system:
        "You are the Monitor agent for Climate & Crisis Ops Command. Produce a concise situation brief JSON with keys: severity, level, event, geography, summary, sopCitations (array of {sopId, section, ref, text}), recommendedActions (array), institutionalSignals (array), affectedCorridors (object), confidence ({score, basis}).",
      user: `Tool results:\n${JSON.stringify(toolResults, null, 2)}`,
    });
    brief = normalizeLlmBrief(json, signalResult);
  } else {
    brief = buildThresholdBrief(toolResults);
  }

  logAgentEvent("agent_complete", { agent, mode, message: "Monitor brief ready" });

  const audit = recordMonitorBrief({
    signal: signalResult,
    brief,
    threshold: signalResult.level,
    mode,
  });

  const efficiency = endAgentRun(agent, mode, startedAt);

  return {
    agent,
    mode,
    framework: "openclaw-compatible-loop",
    threshold: signalResult.level,
    toolsAvailable: listTools().map((t) => t.name),
    toolResults,
    brief,
    audit,
    efficiency,
  };
}

/** @deprecated use runMonitorBrief */
export const runMonitorSpike = runMonitorBrief;

function planAfterThreshold(signal) {
  const level = signal.level ?? 2;
  const steps = [
    { tool: "query_sop", args: { query: `Level ${level}` } },
    { tool: "summarize_dispatch", args: { level } },
  ];
  if (level >= 2) steps.splice(1, 0, { tool: "query_sop", args: { query: "CORR" } });
  if (level >= 2) steps.push({ tool: "get_transport_desk_status", args: {} });
  if (level >= 3) steps.splice(2, 0, { tool: "query_sop", args: { query: "COMMS-03" } });
  return steps;
}

function buildThresholdBrief(toolResults) {
  const signal = findResult(toolResults, "get_signal_status");
  const dispatch = findResult(toolResults, "summarize_dispatch");
  const transportDesk = findResult(toolResults, "get_transport_desk_status");
  const sopResults = toolResults.filter((t) => t.tool === "query_sop").map((t) => t.result);

  const citations = dedupeCitations(sopResults.flatMap((s) => s.citations || []));
  const level = signal.level ?? 2;

  return {
    severity: signal.label,
    level,
    event: signal.event,
    geography: signal.serviceArea,
    summary: buildSummary(signal, dispatch, transportDesk),
    sopCitations: citations,
    recommendedActions: deriveActions(citations, dispatch, level, transportDesk),
    institutionalSignals: signal.institutionalHeadlines || [],
    transportDesk: transportDesk || null,
    affectedCorridors: dispatch.corridorStatus || {},
    confidence: computeConfidence(signal),
  };
}

function dedupeCitations(citations) {
  const seen = new Set();
  return citations.filter((c) => {
    const key = `${c.ref}:${c.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSummary(signal, dispatch, transportDesk) {
  const inst = signal.institutionalCount || 0;
  const atRisk = dispatch.atRiskTrips ?? dispatch.p1Trips ?? 0;
  const corridors = (dispatch.corridors || []).join(", ");
  const geo = signal.serviceArea || "service area";
  let deskHint = "";
  if (transportDesk?.highPressureHospitals?.length) {
    const names = transportDesk.highPressureHospitals.map((h) => `${h.name} ${h.bedPressurePct}%`).join(", ");
    deskHint = ` Transport desk: ${names} bed pressure.`;
  }
  if (transportDesk?.pendingHandoffs) {
    deskHint += ` ${transportDesk.pendingHandoffs} EMS→NEMT handoff(s) pending.`;
  }
  return (
    `Level ${signal.level} ${signal.label} — multi-agency coordination for ${geo}. ` +
    `${inst} institutional signal(s) (OCHA + GFDRR demo feeds). ` +
    `${atRisk} of ${dispatch.totalTrips} NEMT trips at risk; hospital partners PMH and Doctor's Hospital on shared manifest. ` +
    `Corridor sync required: ${corridors}.${deskHint}`
  );
}

function deriveActions(citations, dispatch, level, transportDesk) {
  const levelSection = `Level ${level}`;
  const fromSop = citations
    .filter((c) => c.section?.startsWith(levelSection) || c.section?.includes("Restrict"))
    .map((c) => {
      const text = c.text;
      return text.charAt(0).toUpperCase() + text.slice(1);
    });

  const corridorActions = citations
    .filter((c) => c.section === "Corridors")
    .map((c) => `Check ${c.text.split(" - ")[0]} per SOP`);

  const actions = [...fromSop, ...corridorActions];

  if (dispatch.atRiskTrips > 0) {
    actions.push(
      `Review ${dispatch.atRiskTrips} at-risk trip(s) against corridor status before dispatch`
    );
  }

  if (transportDesk?.electiveHolds?.length) {
    actions.push(
      `Confirm elective hold at ${transportDesk.electiveHolds.map((h) => h.name).join(", ")} before scheduling`
    );
  }
  if (transportDesk?.pendingHandoffs) {
    actions.push(`Review ${transportDesk.pendingHandoffs} pending EMS→NEMT handoff(s) in transport desk queue`);
  }

  return [...new Set(actions)].slice(0, 8);
}

function computeConfidence(signal) {
  const basis = [];
  let score = 0.65;

  if (signal.mode?.includes("demo")) {
    basis.push("demo signal feed");
    score = 0.72;
  }
  if (signal.liveWeather) {
    basis.push("live weather overlay");
    score += 0.08;
  }
  if ((signal.institutionalCount || 0) >= 2) {
    basis.push("multiple institutional sources");
    score += 0.06;
  }
  basis.push("SOP corpus match");

  return {
    score: Math.min(Math.round(score * 100) / 100, 0.92),
    basis,
  };
}

function findResult(toolResults, tool) {
  return toolResults.find((t) => t.tool === tool)?.result || {};
}

/** Coerce LLM JSON into the shape the UI and audit expect. */
function normalizeLlmBrief(brief, signal) {
  const b = { ...brief };
  if (b.level == null) b.level = signal?.level ?? 2;
  if (!Array.isArray(b.recommendedActions)) {
    b.recommendedActions = b.recommendedActions ? [String(b.recommendedActions)] : [];
  }
  if (!Array.isArray(b.sopCitations)) b.sopCitations = [];
  if (!Array.isArray(b.institutionalSignals)) {
    b.institutionalSignals = b.institutionalSignals ? [String(b.institutionalSignals)] : [];
  }
  if (b.confidence) {
    const basis = b.confidence.basis;
    if (basis != null && !Array.isArray(basis)) {
      b.confidence = { ...b.confidence, basis: [String(basis)] };
    } else if (!basis) {
      b.confidence = { ...b.confidence, basis: ["llm"] };
    }
    if (b.confidence.score > 1) b.confidence.score = b.confidence.score / 100;
  } else {
    b.confidence = { score: 0.75, basis: ["llm"] };
  }
  return b;
}
