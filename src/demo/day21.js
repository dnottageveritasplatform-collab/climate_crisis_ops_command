/** Day 21 — demo day live run runbook + judge Q&A prep + preflight. */

import { buildDeployChecklist } from "../deploy/index.js";
import { buildEfficiencySummary } from "../efficiency/index.js";
import { runEvalSuite, getLastEvalRun, loadScenarios } from "../eval/index.js";
import { runPipeline } from "../orchestrator/index.js";
import { resetHitl } from "../hitl/index.js";
import { SCENARIO, scenarioStripText } from "../scenario/index.js";
import { getLlmConfig } from "../agents/runtime/llm.js";
import { config } from "../config.js";
import { buildRehearsalScript } from "./rehearsal.js";

export const LIVE_RUN_STEPS = [
  {
    id: "preflight",
    phase: "before",
    title: "Run preflight",
    action: "npm run demo:preflight — eval 8/8 + deploy checklist + optional pipeline smoke",
    required: true,
  },
  {
    id: "env",
    phase: "before",
    title: "Set demo mode",
    action: "DEMO_MODE=true for live pitch (fast, zero tokens); DEMO_MODE=false + Groq only if Q&A needs LLM prose",
    required: true,
  },
  {
    id: "ui-ready",
    phase: "before",
    title: "Clear HITL state",
    action: "Refresh page or restart server; confirm scenario strip + Level 2 alert visible",
    required: true,
  },
  {
    id: "hook",
    phase: "live",
    title: "Hook + scope (0:00–1:00)",
    action: "Camera or slide → command UI top bar; state not 911/CAD, demo data, real workflow",
    required: true,
  },
  {
    id: "pipeline",
    phase: "live",
    title: "Run Pipeline (1:00–2:00)",
    action: "Click gold Run Pipeline; narrate Monitor → Triage → Action on agent timeline",
    required: true,
  },
  {
    id: "map-action",
    phase: "live",
    title: "Map + Action pack (2:00–3:00)",
    action: "Pan map (CORR-02, #rank pins); show checklist + COMMS-03 drafts in Ops Output",
    required: true,
  },
  {
    id: "hitl",
    phase: "live",
    title: "Triple HITL (3:00–3:30)",
    action: "Review + Approve NEMT Supervisor, PMH Liaison, Doctor's Liaison",
    required: true,
  },
  {
    id: "audit-proof",
    phase: "live",
    title: "Audit + proof (3:30–4:30)",
    action: "Scroll audit trail; cite eval pass count + pipeline ms/tokens from UI or terminal",
    required: true,
  },
  {
    id: "close",
    phase: "live",
    title: "Close (4:30–5:00)",
    action: "Tool-first agents · measured efficiency · Broward lineage · Phase 2 CAD read-only path",
    required: true,
  },
  {
    id: "qa",
    phase: "after",
    title: "Q&A buffer",
    action: "Use docs/demo-day-qa.md or npm run demo:qa — scope guard, agentic proof, PMF ask",
    required: false,
  },
];

export const FALLBACK_ORDER = [
  { order: 1, method: "Live staging URL", detail: "DEMO_MODE=true on Docker/PaaS — docs/staging-deploy.md" },
  { order: 2, method: "Local npm start", detail: "http://127.0.0.1:8787 — same UI, no Wi‑Fi dependency on cloud" },
  { order: 3, method: "Backup MP4", detail: "docs/backup-demo-video.md · docs/demo-2min-capture.md" },
  { order: 4, method: "Static mockup", detail: "docs/mockups/command-center-llm-mode.jpg + architecture diagram" },
];

export const QA_PREP = [
  {
    id: "not-911",
    category: "Scope",
    question: "Is this a 911 or CAD replacement?",
    answer:
      "No. Sprint scope is post-storm coordination for NEMT and hospital transport liaisons — shared map, COMMS-03 bulletins, triple HITL. We explicitly do not claim PSAP call-taking or county CAD in 21 days. Phase 2 adds CAD read-only overlays when a pilot agency is available.",
    rubric: "Defensibility · PMF",
    proof: "docs/phase2-roadmap.md · scope guard in UI scenario strip",
  },
  {
    id: "agentic-vs-chat",
    category: "Agentic AI",
    question: "How is this agentic vs. a chatbot with RAG?",
    answer:
      "Three specialized agents orchestrated in sequence: Monitor (signals + SOP brief), Triage (deterministic rank + map sync), Action (checklist + COMMS-03). Tools run first; LLM enriches prose only. Triple HITL gates outbound comms. Eval harness proves 8 scripted scenarios L1–L4 pass with assertions — not one lucky demo.",
    rubric: "Agentic AI (50%)",
    proof: "POST /api/eval/run · GET /api/audit/trail",
  },
  {
    id: "efficiency",
    category: "Efficiency",
    question: "What does it cost to run? How do you prove efficiency?",
    answer:
      "Demo mode: zero tokens, full pipeline under ~1 s per eval scenario, 8-scenario suite under 2 s. LLM mode logs exact prompt/completion/total per agent — exportable via GET /api/efficiency/summary. Small 3-file SOP keyword RAG, no vector DB in sprint scope.",
    rubric: "Efficiency",
    proof: "docs/efficiency-narrative.md · UI pipeline token line",
  },
  {
    id: "defensibility",
    category: "Defensibility",
    question: "What stops someone from copying the templates?",
    answer:
      "Workflow moat: triple-approver HITL, deterministic triage/map rules, audit trail with SOP citations, and operator-specific corpus. Founder lineage from Broward County IT GIS multi-agency weather coordination — same problem class, productized for Caribbean operators.",
    rubric: "Defensibility",
    proof: "GET /api/defensibility/narrative · docs/defensibility-slide.md",
  },
  {
    id: "pmf",
    category: "PMF",
    question: "Who pays for this? What's the design partner story?",
    answer:
      "Beachhead: NEMT operators coordinating with hospital transport desks after tropical systems — Nassau demo vertical maps to Caribbean operator + liaison pain. Revenue path: per-operator command seat + hospital partner liaison seats; pilot conversation post-sprint with mentor intros.",
    rubric: "PMF",
    proof: "docs/logbook-week3.md · multi-agency scenario API",
  },
  {
    id: "team",
    category: "Team",
    question: "You're solo — how do you scale?",
    answer:
      "Sprint built on KnightRoad Veritas platform architecture (reusable agents, command UI, SOP RAG). Open AI/ML engineer role; advisory from county GIS experience. Phase 2 integrations are adapter work behind the same orchestrator — not rebuilding from scratch.",
    rubric: "Team",
    proof: "knightroadveritas.app · docs/architecture.docx",
  },
  {
    id: "hitl-friction",
    category: "Product",
    question: "Triple HITL seems slow for a crisis — why three approvers?",
    answer:
      "Models real multi-agency SOP: NEMT supervisor holds trips/driver comms; each hospital liaison owns their COMMS-03 bulletin. Nothing auto-sends — regulatory and partner-trust requirement. Demo compresses to ~30 s of clicks; production can parallelize review notifications.",
    rubric: "Agentic AI · PMF",
    proof: "docs/sops/ · HITL panel in UI",
  },
  {
    id: "data-sovereignty",
    category: "Technical",
    question: "Can this run on-prem for Caribbean data residency?",
    answer:
      "Yes — Docker staging today; Phase 2 sovereign path for operators needing PHI/PII on-prem. Demo uses synthetic dispatch only. HITL and audit design carry to on-prem without architecture change.",
    rubric: "Defensibility",
    proof: "Dockerfile · docs/staging-deploy.md · Phase 2 routing-gis track",
  },
  {
    id: "llm-replaceable",
    category: "Technical",
    question: "What if Groq/OpenAI is unavailable?",
    answer:
      "Demo mode runs full workflow with zero LLM dependency — judges see identical ranks, map pins, checklist, and HITL gates. LLM is optional narrative enrichment on brief and COMMS-03 drafts; provider is swappable via env config.",
    rubric: "Efficiency · Agentic AI",
    proof: "DEMO_MODE=true · npm run eval:run",
  },
  {
    id: "phase2",
    category: "Roadmap",
    question: "What's next after the sprint?",
    answer:
      "Phase 2: CAD read-only trip overlay, EMS-adjacent hospital desk feeds, fire/police situational read-only layers, deeper GIS when pilot agency available. Same command surface — new tool adapters behind Monitor/Triage/Action.",
    rubric: "PMF · Defensibility",
    proof: "GET /api/defensibility/phase2 · docs/phase2-roadmap.md",
  },
];

function liveStats() {
  const evalRun = getLastEvalRun();
  const efficiency = buildEfficiencySummary();
  let scenarioCount = 0;
  try {
    scenarioCount = loadScenarios().length;
  } catch {
    scenarioCount = 0;
  }

  return {
    evalPassed: evalRun?.summary?.passed ?? null,
    evalTotal: evalRun?.summary?.total ?? scenarioCount,
    evalSuiteMs: evalRun?.totalLatencyMs ?? null,
    evalOk: evalRun?.ok ?? null,
    lastPipeline: efficiency.lastPipelineMetrics || efficiency.lastPipeline || null,
    deploy: buildDeployChecklist(),
    demoMode: config.demoMode,
    llmProvider: config.demoMode ? "demo" : getLlmConfig().provider,
  };
}

export function buildDemoDayRunbook() {
  const stats = liveStats();
  const rehearsal = buildRehearsalScript();

  return {
    ok: true,
    phase: "week-3-day-21",
    sprintComplete: true,
    title: "Demo day live run — Climate & Crisis Ops Command",
    scenario: {
      id: SCENARIO.id,
      title: SCENARIO.title,
      strip: scenarioStripText(),
    },
    stats: {
      eval: stats.evalOk ? `${stats.evalPassed}/${stats.evalTotal}` : "run npm run demo:preflight",
      evalSuiteMs: stats.evalSuiteMs,
      deploy: stats.deploy.summary,
      demoMode: stats.demoMode,
      llmProvider: stats.llmProvider,
    },
    liveRunSteps: LIVE_RUN_STEPS,
    fallbackOrder: FALLBACK_ORDER,
    rehearsal: {
      beats: rehearsal.beats.length,
      durationMin: rehearsal.totalDurationSec / 60,
      api: "GET /api/demo/rehearsal",
      docs: ["docs/demo-5min-rehearsal.md", "docs/demo-2min-capture.md"],
    },
    cli: {
      preflight: "npm run demo:preflight",
      qa: "npm run demo:qa",
      rehearsal: "npm run demo:rehearsal",
      eval: "npm run eval:run",
    },
    docs: {
      runbook: "docs/demo-day-runbook.md",
      qa: "docs/demo-day-qa.md",
      backup: "docs/backup-demo-video.md",
    },
  };
}

export function buildQaPrep({ category } = {}) {
  let items = QA_PREP;
  if (category) {
    items = items.filter((q) => q.category.toLowerCase() === category.toLowerCase());
  }

  const byCategory = {};
  for (const q of items) {
    if (!byCategory[q.category]) byCategory[q.category] = [];
    byCategory[q.category].push(q);
  }

  return {
    ok: true,
    phase: "week-3-day-21",
    title: "Judge Q&A prep — Climate & Crisis Ops Command",
    count: items.length,
    questions: items,
    byCategory,
    scopeGuard: SCENARIO.demoDisclaimer,
    docs: "docs/demo-day-qa.md",
  };
}

export async function runDemoDayPreflight({ pipelineSmoke = true } = {}) {
  resetHitl();
  const t0 = Date.now();

  const evalResult = await runEvalSuite({ skipLlm: true });
  const deploy = buildDeployChecklist();

  let pipeline = null;
  if (pipelineSmoke) {
    resetHitl();
    pipeline = await runPipeline({ refreshSignals: false });
  }

  const checks = [
    {
      name: "eval_suite",
      ok: evalResult.ok,
      detail: `${evalResult.summary.passed}/${evalResult.summary.total} scenarios · ${evalResult.totalLatencyMs} ms`,
    },
    {
      name: "deploy_checklist",
      ok: deploy.ok,
      detail: deploy.summary,
    },
    {
      name: "pipeline_smoke",
      ok: pipeline ? pipeline.ok === true : true,
      detail: pipeline
        ? `L${pipeline.threshold} · ${pipeline.efficiency?.totalLatencyMs ?? "?"} ms · HITL ${pipeline.hitlGate}`
        : "skipped",
    },
    {
      name: "demo_mode_recommended",
      ok: true,
      detail: config.demoMode
        ? "DEMO_MODE=true — optimal for live demo"
        : "DEMO_MODE=false — consider true for demo day reliability",
    },
  ];

  const failed = checks.filter((c) => !c.ok);

  return {
    ok: failed.length === 0,
    phase: "week-3-day-21",
    sprintComplete: true,
    preflightMs: Date.now() - t0,
    checks,
    eval: evalResult.summary,
    deploy: { ok: deploy.ok, summary: deploy.summary },
    pipeline: pipeline
      ? {
          ok: pipeline.ok,
          threshold: pipeline.threshold,
          hitlGate: pipeline.hitlGate,
          efficiency: pipeline.efficiency,
        }
      : null,
    readyForDemo: failed.length === 0,
    next: "Open http://127.0.0.1:8787 · follow docs/demo-day-runbook.md",
  };
}

export function formatDemoDayRunbookText(runbook = buildDemoDayRunbook()) {
  const lines = [
    runbook.title,
    `Phase: ${runbook.phase} · Sprint complete`,
    `Scenario: ${runbook.scenario.strip}`,
    `Preflight: eval ${runbook.stats.eval} · deploy ${runbook.stats.deploy}`,
    "",
    "## Live run steps",
    "",
  ];

  for (const step of runbook.liveRunSteps) {
    lines.push(`[${step.phase.toUpperCase()}] ${step.title}`);
    lines.push(`  ${step.action}`);
    lines.push("");
  }

  lines.push("## Fallback order");
  lines.push("");
  for (const fb of runbook.fallbackOrder) {
    lines.push(`${fb.order}. ${fb.method} — ${fb.detail}`);
  }

  return lines.join("\n");
}

export function formatQaPrepText(qa = buildQaPrep()) {
  const lines = [qa.title, qa.scopeGuard, "", `Total: ${qa.count} anticipated questions`, ""];

  for (const [category, items] of Object.entries(qa.byCategory)) {
    lines.push(`## ${category}`);
    lines.push("");
    for (const q of items) {
      lines.push(`Q: ${q.question}`);
      lines.push(`A: ${q.answer}`);
      lines.push(`Proof: ${q.proof} · Rubric: ${q.rubric}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
