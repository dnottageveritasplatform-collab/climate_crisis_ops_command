/** Day 16 — token + latency logging for efficiency rubric / pitch narrative. */

const MAX_AGENT_RUNS = 100;
const MAX_PIPELINE_RUNS = 30;
const MAX_LLM_CALLS = 200;

/** @type {Array<object>} */
const agentRuns = [];
/** @type {Array<object>} */
const pipelineRuns = [];
/** @type {Array<object>} */
const llmCalls = [];

let activeAgent = null;
/** @type {Array<object>} */
let activeAgentLlmCalls = [];

export function beginAgentRun(agent) {
  activeAgent = agent;
  activeAgentLlmCalls = [];
  return Date.now();
}

export function endAgentRun(agent, mode, startedAt) {
  const latencyMs = Date.now() - startedAt;
  const tokens = sumTokens(activeAgentLlmCalls);
  const run = {
    agent,
    mode,
    latencyMs,
    tokens,
    llmCalls: activeAgentLlmCalls.length,
    llmLatencyMs: activeAgentLlmCalls.reduce((n, c) => n + (c.latencyMs || 0), 0),
    ts: new Date().toISOString(),
  };
  agentRuns.unshift(run);
  if (agentRuns.length > MAX_AGENT_RUNS) agentRuns.length = MAX_AGENT_RUNS;
  activeAgent = null;
  activeAgentLlmCalls = [];
  return run;
}

export function recordLlmCall({ agent, provider, model, latencyMs, usage = {}, ok = true, error }) {
  const call = {
    agent: agent || activeAgent || "unknown",
    provider,
    model,
    latencyMs,
    ok,
    error,
    promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? 0,
    completionTokens: usage.completion_tokens ?? usage.completionTokens ?? 0,
    totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
    ts: new Date().toISOString(),
  };
  llmCalls.unshift(call);
  if (llmCalls.length > MAX_LLM_CALLS) llmCalls.length = MAX_LLM_CALLS;
  if (activeAgent && call.agent === activeAgent) {
    activeAgentLlmCalls.push(call);
  }
  return call;
}

export function recordPipelineRun(metrics) {
  const run = {
    ...metrics,
    ts: new Date().toISOString(),
  };
  pipelineRuns.unshift(run);
  if (pipelineRuns.length > MAX_PIPELINE_RUNS) pipelineRuns.length = MAX_PIPELINE_RUNS;
  return run;
}

function sumTokens(calls) {
  return calls.reduce((n, c) => n + (c.totalTokens || 0), 0);
}

export function getAgentRuns(limit = 20) {
  return agentRuns.slice(0, limit);
}

export function getPipelineRuns(limit = 10) {
  return pipelineRuns.slice(0, limit);
}

export function getLlmCalls(limit = 30) {
  return llmCalls.slice(0, limit);
}

export function buildEfficiencySummary() {
  const lastPipeline = pipelineRuns[0];
  const recentAgents = agentRuns.slice(0, 12);
  const recentLlm = llmCalls.slice(0, 50);

  const tokensLastPipeline = lastPipeline?.totalTokens ?? 0;
  const latencyLastPipeline = lastPipeline?.totalLatencyMs ?? 0;

  const byAgent = {};
  for (const r of recentAgents) {
    if (!byAgent[r.agent]) {
      byAgent[r.agent] = { runs: 0, totalLatencyMs: 0, totalTokens: 0, llmRuns: 0, demoRuns: 0 };
    }
    const bucket = byAgent[r.agent];
    bucket.runs++;
    bucket.totalLatencyMs += r.latencyMs;
    bucket.totalTokens += r.tokens;
    if (r.mode === "demo") bucket.demoRuns++;
    else bucket.llmRuns++;
  }

  for (const name of Object.keys(byAgent)) {
    const b = byAgent[name];
    b.avgLatencyMs = Math.round(b.totalLatencyMs / b.runs);
  }

  const llmCallCount = recentLlm.length;
  const llmTokens = recentLlm.reduce((n, c) => n + (c.totalTokens || 0), 0);
  const demoAgentRuns = recentAgents.filter((r) => r.mode === "demo").length;
  const llmAgentRuns = recentAgents.filter((r) => r.mode !== "demo").length;

  return {
    ok: true,
    phase: "week-3-day-17",
    lastPipeline: lastPipeline || null,
    totals: {
      agentRunsLogged: agentRuns.length,
      pipelineRunsLogged: pipelineRuns.length,
      llmCallsLogged: llmCalls.length,
    },
    lastPipelineMetrics: lastPipeline
      ? {
          pipelineId: lastPipeline.pipelineId,
          threshold: lastPipeline.threshold,
          totalLatencyMs: latencyLastPipeline,
          totalTokens: tokensLastPipeline,
          agents: lastPipeline.agents,
          modes: lastPipeline.modes,
        }
      : null,
    byAgent,
    recentWindow: {
      agentRuns: recentAgents.length,
      demoRuns: demoAgentRuns,
      llmRuns: llmAgentRuns,
      llmCalls: llmCallCount,
      llmTokens,
    },
    narrative: buildEfficiencyNarrative({
      lastPipeline,
      byAgent,
      demoAgentRuns,
      llmAgentRuns,
      llmTokens,
    }),
  };
}

export function buildEfficiencyNarrative(ctx = {}) {
  const { lastPipeline, byAgent, demoAgentRuns, llmAgentRuns, llmTokens } = ctx;

  const bullets = [
    "Demo mode: Monitor + Triage + Action run on rule-based tools + 3-file SOP keyword RAG — zero LLM tokens for judge-repeatable eval (`npm run eval:run` · 8/8 scenarios).",
    "LLM mode (optional MiniMax / Groq / OpenAI-compatible): only Monitor, Triage, and Action narrative layers call the API; ranks, map pins, and HITL metadata stay deterministic.",
    "Small corpus: operator SOPs in `data/sops/` (3 files) — no vector DB or embedding pipeline in sprint scope.",
  ];

  if (lastPipeline) {
    bullets.push(
      `Last pipeline: ${lastPipeline.totalLatencyMs} ms total · ${lastPipeline.totalTokens ?? 0} tokens · modes ${JSON.stringify(lastPipeline.modes || {})}.`
    );
  }

  if (byAgent?.monitor?.avgLatencyMs != null) {
    bullets.push(
      `Avg agent latency (recent): Monitor ${byAgent.monitor?.avgLatencyMs ?? "—"} ms · Triage ${byAgent.triage?.avgLatencyMs ?? "—"} ms · Action ${byAgent.action?.avgLatencyMs ?? "—"} ms.`
    );
  }

  if (llmAgentRuns > 0) {
    bullets.push(`Recent LLM agent runs: ${llmAgentRuns} (≈${llmTokens} tokens in last ${Math.min(llmCalls.length, 50)} API calls).`);
  } else if (demoAgentRuns > 0) {
    bullets.push(`Recent runs: ${demoAgentRuns} demo-mode agent executions — suitable for offline demo day with no API dependency.`);
  }

  return {
    headline: "Efficient agentic ops: tool-first pipeline, optional LLM enrichment, small RAG corpus",
    bullets,
    pitchLine:
      "We log latency and tokens per agent. Demo mode proves the workflow for judges with zero API cost; MiniMax (or any OpenAI-compatible LLM) enriches narrative when enabled — without rebuilding county CAD or a vector stack in 21 days.",
  };
}
