/** Day 17 — 5-minute demo rehearsal script with live eval + efficiency stats. */

import { buildEfficiencySummary } from "../efficiency/index.js";
import { getLastEvalRun, loadScenarios } from "../eval/index.js";
import { SCENARIO, scenarioStripText } from "../scenario/index.js";
import { getLlmConfig } from "../agents/runtime/llm.js";
import { config } from "../config.js";

const BEATS = [
  {
    id: "hook",
    startSec: 0,
    endSec: 45,
    title: "Hook — post-storm coordination gap",
    action: "Slide or camera on you; optional title card.",
    talkTrack:
      "After a tropical system, Nassau Metro NEMT, Princess Margaret Hospital, and Doctor's Hospital still coordinate on separate channels — trips, corridors, and COMMS-03 bulletins drift out of sync. Climate & Crisis Ops Command is one operator surface: signals in, agents orchestrate, humans approve before anything sends.",
  },
  {
    id: "scope",
    startSec: 45,
    endSec: 60,
    title: "Scope — what this is (and isn't)",
    action: "Cut to command UI top bar + scenario strip.",
    talkTrack:
      "This is not 911 CAD replacement in a 21-day sprint. It's post-storm multi-agency coordination — demo data, real workflow: Monitor, Triage, Action, triple HITL, audit-first.",
  },
  {
    id: "pipeline",
    startSec: 60,
    endSec: 120,
    title: "Live — Run Pipeline",
    action: "Click Run Pipeline (gold). Point at alert + agent timeline while it runs.",
    talkTrack:
      "Level 2 Prepare — storm signal triggers Monitor, Triage, and Action. Tools run first: signal status, dispatch manifest, SOP keyword RAG. LLM enriches the brief and COMMS-03 drafts; ranks and map pins stay deterministic.",
  },
  {
    id: "map",
    startSec: 120,
    endSec: 150,
    title: "Live — map + triage sync",
    action: "Pan map: CORR-02 restricted, hospital pins, at-risk trips with #rank labels.",
    talkTrack:
      "Thin GIS layer — facilities, corridors, at-risk P1 dialysis trips. Triage output drives map sync; no manual pin placement.",
  },
  {
    id: "action",
    startSec: 150,
    endSec: 180,
    title: "Live — Action + COMMS-03",
    action: "Ops Output → Triage tab, then Action tab. Scroll checklist + hospital bulletins.",
    talkTrack:
      "Action pack: dispatch checklist, per-partner COMMS-03 bulletins, driver SMS drafts. Everything is DRAFT — nothing auto-sends.",
  },
  {
    id: "hitl",
    startSec: 180,
    endSec: 210,
    title: "Live — triple HITL",
    action: "Review + Approve NEMT Supervisor, PMH Liaison, Doctor's Liaison.",
    talkTrack:
      "Triple human-in-the-loop: Maria Clarke (NEMT), James Rolle (PMH), Dr. Elaine Moss (Doctor's). Each role reviews COMMS-03 before release — multi-agency SOP in the UI.",
  },
  {
    id: "audit",
    startSec: 210,
    endSec: 240,
    title: "Live — audit trail",
    action: "Scroll Audit Trail: pipeline_run, SOP citations, approver timestamps.",
    talkTrack:
      "Audit log captures pipeline steps, SOP refs, and approver timestamps. Built for defensibility, not demo theater.",
  },
  {
    id: "proof",
    startSec: 240,
    endSec: 270,
    title: "Proof — eval + efficiency",
    action: "Terminal or slide: npm run eval:run + efficiency summary (or point at pipeline token line in UI).",
    talkTrack: null, // filled dynamically
  },
  {
    id: "close",
    startSec: 270,
    endSec: 300,
    title: "Close — rubric + next",
    action: "Hold on released HITL banner or efficiency metrics.",
    talkTrack:
      "Agentic AI: tool-first agents with optional LLM enrichment. Efficiency: measured tokens and latency, zero-token demo path for judges. Defensibility: small operator SOP corpus and deterministic workflow — LLM is replaceable. Next: live signal feeds and staging deploy.",
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
    ? "Today I'm in demo mode for speed; flip DEMO_MODE=false + Groq for live narrative during Q&A."
    : `LLM provider: ${providerLabel()} — narrative only; ranks, map, and HITL gates stay rule-based.`;

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
    phase: "week-3-day-17",
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
    },
    captureNote: "Full beat sheet: docs/demo-5min-rehearsal.md · 2-min cut: docs/demo-2min-capture.md",
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
