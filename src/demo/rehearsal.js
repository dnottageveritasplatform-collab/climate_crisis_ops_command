/** Phase 2 Day 17 — 5-minute demo rehearsal script with live eval + efficiency stats. */

import { buildEfficiencySummary } from "../efficiency/index.js";
import { getLastEvalRun, loadScenarios } from "../eval/index.js";
import { SCENARIO, scenarioStripText } from "../scenario/index.js";
import { getLlmConfig } from "../agents/runtime/llm.js";
import { config } from "../config.js";

export const DEMO_REHEARSAL_SCOPE_GUARD =
  "Demo rehearsal beat sheet — pitch script with live eval + efficiency stats injection; not dispatch authority.";

const BEATS = [
  {
    id: "hook",
    startSec: 0,
    endSec: 45,
    title: "Hook — post-storm coordination gap",
    action: "Slide or camera on you; optional title card.",
    talkTrack:
      "After a tropical system, Nassau Metro NEMT, Princess Margaret Hospital, and Doctor's Hospital still coordinate on separate channels — trips, corridors, flood and wind exposure, and COMMS-03 bulletins drift out of sync. Climate & Crisis Ops Command is one operator surface: signals in, agents orchestrate, humans approve before anything sends.",
  },
  {
    id: "scope",
    startSec: 45,
    endSec: 60,
    title: "Scope — Phase 2 sprint complete (what this is and isn't)",
    action: "Cut to command UI top bar + scenario strip.",
    talkTrack:
      "Seventeen days, four integration tracks — CAD read-only, EMS-adjacent transport desk, EOC situational feeds, deeper GIS routing, plus sovereign on-prem. Not 911 CAD replacement. Demo data, real workflow: Monitor, Triage, Action, extended HITL, audit-first.",
  },
  {
    id: "pipeline",
    startSec: 60,
    endSec: 120,
    title: "Live — Run Pipeline",
    action: "Click Run Pipeline (gold). Point at alert + agent timeline while it runs.",
    talkTrack:
      "Level 2 Prepare — storm signal triggers Monitor, Triage, and Action. Tools run first: CAD cross-ref, ESRI corridors, flood + wind GIS, hazard fusion, road-network avoidance, sovereign deploy checks. LLM enriches brief and COMMS-03 drafts; ranks and map pins stay deterministic.",
  },
  {
    id: "map",
    startSec: 120,
    endSec: 150,
    title: "Live — map + hazard fusion",
    action: "Pan map: flood/wind zones, CORR-02 restricted, hospital pins, at-risk trips with #rank labels. Toggle Hazard fusion strip.",
    talkTrack:
      "Thin GIS — flood depth and wind gust overlays, ESRI corridor status, at-risk P1 dialysis trips. Hazard fusion merges flood, wind, routing, and turn-by-turn avoidance per trip — triage drives map sync.",
  },
  {
    id: "action",
    startSec: 150,
    endSec: 180,
    title: "Live — Action + COMMS-03",
    action: "Ops Output → Triage tab, then Action tab. Scroll checklist + hospital bulletins + driver SMS with fusion headline.",
    talkTrack:
      "Action pack: dispatch checklist, per-partner COMMS-03 bulletins, driver SMS drafts with fused hazard headline and turn-by-turn segments. Everything is DRAFT — nothing auto-sends.",
  },
  {
    id: "hitl",
    startSec: 180,
    endSec: 210,
    title: "Live — extended HITL (5 roles at L2+)",
    action: "Review + Approve NEMT Supervisor, PMH Liaison, Doctor's Liaison, Shelter Coordinator, Fleet Logistics.",
    talkTrack:
      "Extended human-in-the-loop at Level 2+: Maria Clarke (NEMT), James Rolle (PMH), Dr. Elaine Moss (Doctor's), Keisha Bain (Shelter), Marcus Edgecombe (Fleet). Each role reviews COMMS-03 before release — multi-agency SOP in the UI.",
  },
  {
    id: "audit",
    startSec: 210,
    endSec: 240,
    title: "Live — persisted audit trail",
    action: "Scroll Audit Trail: pipeline_run with Phase 2 sync steps, SOP citations, approver timestamps.",
    talkTrack:
      "Append-only audit log — pipeline steps from CAD through hazard fusion and road network, SOP refs, approver timestamps. Survives restart via JSONL — built for EOC defensibility, not demo theater.",
  },
  {
    id: "proof",
    startSec: 240,
    endSec: 270,
    title: "Proof — eval + efficiency",
    action: "Terminal or Demo rehearsal strip: npm run eval:run + efficiency summary (or point at pipeline token line in UI).",
    talkTrack: null,
  },
  {
    id: "close",
    startSec: 270,
    endSec: 300,
    title: "Close — Phase 2 sprint + rubric",
    action: "Hold on released HITL banner, Hazard fusion strip, or efficiency metrics.",
    talkTrack:
      "Phase 2 complete: same command surface, new adapters — read-only CAD, transport desk, EOC feeds, hazard fusion, sovereign deploy. Agentic AI: tool-first agents with optional LLM enrichment. Efficiency: measured tokens and latency, zero-token demo path, HighRise H200 verified during sprint. Defensibility: operator SOP corpus, extended HITL, persisted audit — LLM is replaceable via env.",
  },
];

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function providerLabel() {
  const llm = getLlmConfig();
  if (config.demoMode) return "demo";
  return llm.provider || "llm";
}

function buildProofTalkTrack(stats) {
  const evalLine = stats.evalPassed
    ? `${stats.evalPassed}/${stats.evalTotal} scripted storm scenarios pass in under ${stats.evalSuiteMs} ms — Levels 1 through 4, demo mode, zero tokens.`
    : "Run npm run eval:run — eight scripted scenarios, pass/fail assertions, under one second.";

  const eff = stats.lastPipeline;
  const llmLine = eff
    ? `Last live pipeline: ${eff.totalLatencyMs} ms, ${eff.totalTokens ?? 0} tokens, modes ${JSON.stringify(eff.modes || {})}.`
    : "Run Pipeline once with LLM mode — UI shows latency and token rollup on the timeline.";

  const modeLine = config.demoMode
    ? "Today I'm in demo mode for reliability — zero tokens. During the sprint we verified live inference on Future Caribbean partner HighRise H200 compute; same OpenAI-compatible env, commented until credits renew."
    : `LLM provider: ${providerLabel()} — narrative only; ranks, map, hazard fusion, and HITL gates stay rule-based.`;

  return `${evalLine} ${llmLine} ${modeLine}`;
}

export function buildRehearsalScript(ctx = {}) {
  const efficiency = buildEfficiencySummary();
  const evalRun = getLastEvalRun();
  const scenarios = loadScenarios();

  const lastPipeline = efficiency.lastPipelineMetrics || efficiency.lastPipeline;
  const stats = {
    evalTotal: evalRun?.summary?.total ?? scenarios.length,
    evalPassed: evalRun?.summary?.passed ?? null,
    evalSuiteMs: evalRun?.totalLatencyMs ?? null,
    evalOk: evalRun?.ok ?? null,
    lastPipeline,
    demoMode: config.demoMode,
    llmProvider: config.demoMode ? null : providerLabel(),
    scenarioStrip: scenarioStripText(),
  };

  const beats = BEATS.map((beat) => {
    const row = {
      ...beat,
      timeRange: `${formatTime(beat.startSec)}–${formatTime(beat.endSec)}`,
      durationSec: beat.endSec - beat.startSec,
    };
    if (beat.id === "proof") {
      row.talkTrack = ctx.proofTalkTrack || buildProofTalkTrack(stats);
    }
    return row;
  });

  return {
    ok: true,
    phase: "phase-2-day-17",
    title: "Climate & Crisis Ops Command — 5-minute demo rehearsal",
    totalDurationSec: 300,
    scenario: {
      id: SCENARIO.id,
      title: SCENARIO.title,
      strip: stats.scenarioStrip,
    },
    stats,
    beats,
    cli: {
      eval: "npm run eval:run",
      efficiency: "npm run efficiency:summary",
      pipeline: "curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run",
      preflight: "npm run demo:preflight",
    },
    captureNote: "Full beat sheet: docs/demo-5min-rehearsal.md · 2-min cut: docs/demo-2min-capture.md",
    scopeGuard: DEMO_REHEARSAL_SCOPE_GUARD,
  };
}

/** Compact status for Monitor agent tool + pipeline audit (Phase 2 Day 17). */
export function getDemoRehearsalStatus(ctx = {}) {
  const script = buildRehearsalScript(ctx);
  const { stats } = script;
  return {
    ok: script.ok,
    phase: "phase-2-day-17",
    beatCount: script.beats.length,
    durationMin: script.totalDurationSec / 60,
    evalPassed: stats.evalPassed,
    evalTotal: stats.evalTotal,
    evalSuiteMs: stats.evalSuiteMs,
    evalOk: stats.evalOk,
    lastPipelineMs: stats.lastPipeline?.totalLatencyMs ?? null,
    lastPipelineTokens: stats.lastPipeline?.totalTokens ?? null,
    demoMode: stats.demoMode,
    llmProvider: stats.llmProvider,
    scenarioStrip: stats.scenarioStrip,
    api: "/api/demo/rehearsal",
    docs: ["docs/demo-5min-rehearsal.md", "docs/demo-2min-capture.md", "docs/demo-day-runbook.md", "docs/highrise-compute.md"],
    scopeGuard: DEMO_REHEARSAL_SCOPE_GUARD,
    summary: `${stats.evalPassed ?? "?"}/${stats.evalTotal} eval · ${script.beats.length} beats · ${script.totalDurationSec / 60} min pitch`,
  };
}

export function formatRehearsalScriptText(script = buildRehearsalScript()) {
  const lines = [
    script.title,
    `Phase: ${script.phase} · ${script.totalDurationSec / 60} min`,
    `Scenario: ${script.scenario.strip}`,
    "",
  ];

  for (const beat of script.beats) {
    lines.push(`[${beat.timeRange}] ${beat.title}`);
    lines.push(`  Do: ${beat.action}`);
    lines.push(`  Say: ${beat.talkTrack}`);
    lines.push("");
  }

  return lines.join("\n");
}
