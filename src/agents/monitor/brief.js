import { config } from "../../config.js";
import { recordMonitorBrief } from "../../audit/index.js";
import { logAgentEvent } from "../runtime/logger.js";
import { listTools, runTool } from "../runtime/tools.js";

/**
 * Day 5 Monitor agent: threshold-driven tool plan → structured brief with SOP citations.
 */
export async function runMonitorBrief() {
  const agent = "monitor";
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
    brief = await llmBrief(toolResults, llm);
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

  return {
    agent,
    mode,
    framework: "openclaw-compatible-loop",
    threshold: signalResult.level,
    toolsAvailable: listTools().map((t) => t.name),
    toolResults,
    brief,
    audit,
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
  if (level >= 3) steps.splice(2, 0, { tool: "query_sop", args: { query: "COMMS-03" } });
  return steps;
}

function buildThresholdBrief(toolResults) {
  const signal = findResult(toolResults, "get_signal_status");
  const dispatch = findResult(toolResults, "summarize_dispatch");
  const sopResults = toolResults.filter((t) => t.tool === "query_sop").map((t) => t.result);

  const citations = dedupeCitations(sopResults.flatMap((s) => s.citations || []));
  const level = signal.level ?? 2;

  return {
    severity: signal.label,
    level,
    event: signal.event,
    geography: signal.serviceArea,
    summary: buildSummary(signal, dispatch),
    sopCitations: citations,
    recommendedActions: deriveActions(citations, dispatch, level),
    institutionalSignals: signal.institutionalHeadlines || [],
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

function buildSummary(signal, dispatch) {
  const inst = signal.institutionalCount || 0;
  const atRisk = dispatch.atRiskTrips ?? dispatch.p1Trips ?? 0;
  const corridors = (dispatch.corridors || []).join(", ");
  const geo = signal.serviceArea || "service area";
  return (
    `Level ${signal.level} ${signal.label} for ${geo}. ` +
    `${inst} institutional signal(s). ` +
    `${atRisk} trip(s) at risk of ${dispatch.totalTrips} scheduled. ` +
    `Corridors: ${corridors}.`
  );
}

function deriveActions(citations, dispatch, level) {
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

  return [...new Set(actions)].slice(0, 6);
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

function getLlmConfig() {
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
  const model = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const provider =
    process.env.LLM_PROVIDER ||
    (baseUrl.includes("11434") || baseUrl.includes("ollama") ? "ollama" : null) ||
    (baseUrl.includes("groq.com") ? "groq" : null) ||
    (apiKey ? "openai" : null) ||
    "llm";
  const enabled = Boolean(process.env.LLM_BASE_URL || apiKey);
  return { baseUrl, apiKey, model, provider, enabled };
}

async function llmBrief(toolResults, llm) {
  const payload = JSON.stringify(toolResults, null, 2);
  const headers = { "Content-Type": "application/json" };
  if (llm.apiKey) headers.Authorization = `Bearer ${llm.apiKey}`;

  const res = await fetch(`${llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: llm.model,
      messages: [
        {
          role: "system",
          content:
            "You are the Monitor agent for Climate & Crisis Ops Command. Produce a concise situation brief JSON with keys: severity, level, event, geography, summary, sopCitations (array of {sopId, section, ref, text}), recommendedActions (array), institutionalSignals (array), affectedCorridors (object), confidence ({score, basis}).",
        },
        { role: "user", content: `Tool results:\n${payload}` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    throw new Error(`${llm.provider} error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
