/** Day 20 — Logbook #3 (Week 3 summary) + mentor questions list. */

import { buildDeployChecklist } from "../deploy/index.js";
import { buildEfficiencySummary } from "../efficiency/index.js";
import { getLastEvalRun, loadScenarios } from "../eval/index.js";
import { SCENARIO, scenarioStripText } from "../scenario/index.js";
import { config } from "../config.js";

export const WEEK3_DELIVERED = [
  {
    day: 15,
    title: "Eval harness",
    detail:
      "8 scripted storm scenarios (L1–L4) with pass/fail assertions on triage ranks, corridor status, COMMS-03, triple HITL, map sync, and pipeline audit — POST /api/eval/run",
  },
  {
    day: 16,
    title: "Efficiency narrative",
    detail:
      "Per-agent latency + LLM token logging; pitch-ready narrative — GET /api/efficiency/summary · docs/efficiency-narrative.md",
  },
  {
    day: 17,
    title: "5-min demo rehearsal",
    detail:
      "Beat sheet with live eval + efficiency stats injection — GET /api/demo/rehearsal · docs/demo-5min-rehearsal.md",
  },
  {
    day: 18,
    title: "Defensibility + Phase 2 roadmap",
    detail:
      "Broward County IT founder credibility, five defensibility pillars, CAD/EMS integration tracks — GET /api/defensibility/narrative",
  },
  {
    day: 19,
    title: "Staging deploy + backup video",
    detail:
      "Dockerfile, deploy checklist API, staging guide, offline MP4 capture checklist — GET /api/deploy/checklist",
  },
  {
    day: 20,
    title: "Logbook #3 + mentor questions",
    detail: "Week 3 wrap-up paste-ready logbook and prioritized mentor ask list — GET /api/logbook/week3",
  },
];

export const MENTOR_QUESTIONS = [
  {
    id: "demo-day-logistics",
    category: "Demo day",
    priority: "high",
    question:
      "For demo day, should I lead with live staging URL (DEMO_MODE=true) or pre-recorded MP4 if Wi‑Fi is uncertain — and is there a preferred submission format?",
    context: "Docker staging ready; backup capture script in docs/backup-demo-video.md",
    rubric: "Agentic AI · PMF",
  },
  {
    id: "judge-qa-agentic",
    category: "Judge Q&A",
    priority: "high",
    question:
      "How do judges typically weigh deterministic tool-first agents vs. LLM-heavy demos in the Agentic AI rubric — should I emphasize eval harness + HITL over model choice?",
    context: "8/8 eval scenarios; demo mode 0 tokens; Groq optional for live prose",
    rubric: "Agentic AI (50%)",
  },
  {
    id: "pitch-deck-review",
    category: "Pitch",
    priority: "high",
    question:
      "Can a mentor review my 8-slide deck outline (problem → Broward proof → demo → architecture → defensibility → Phase 2 → ask) before Day 21?",
    context: "SPRINT.docx pitch outline + docs/defensibility-slide.md",
    rubric: "PMF · Defensibility",
  },
  {
    id: "design-partner-intro",
    category: "Go-to-market",
    priority: "medium",
    question:
      "Are there Caribbean NEMT operators, hospital transport desks, or EOC contacts in the mentor network open to a post-sprint pilot conversation?",
    context: "Demo vertical: Nassau Metro NEMT + PMH + Doctor's Hospital (synthetic data)",
    rubric: "PMF",
  },
  {
    id: "sovereign-deploy",
    category: "Technical",
    priority: "medium",
    question:
      "For Caribbean operators needing data residency, what's the lightest credible sovereign/on-prem path after Docker staging — Nebius VM vs. edge appliance narrative for OWC angle?",
    context: "Phase 2 routing-gis track mentions on-prem sovereign deploy",
    rubric: "Defensibility",
  },
  {
    id: "cad-phase2-credibility",
    category: "Technical",
    priority: "medium",
    question:
      "How much Phase 2 CAD read-only integration detail is useful in a 5-min demo vs. over-scoping — judges skeptical of 911 replacement claims?",
    context: "Explicit scope guard: not 911/CAD in 21 days; docs/phase2-roadmap.md",
    rubric: "Defensibility · PMF",
  },
  {
    id: "solo-team-rubric",
    category: "Team",
    priority: "medium",
    question:
      "As a solo founder, what's the best way to address the Team rubric — advisory board naming, open AI/ML engineer role, or partner org letter?",
    context: "Sprint built solo on Veritas architecture",
    rubric: "Team",
  },
  {
    id: "compute-credits",
    category: "Technical",
    priority: "low",
    question:
      "Nebius business email still pending — should demo day stay on DEMO_MODE=true + Groq free tier, or is there a mentor path to H200 / container credits this week?",
    context: "Efficiency narrative separates demo (0 tokens) from logged LLM runs",
    rubric: "Efficiency",
  },
  {
    id: "hitl-triple-vs-dual",
    category: "Product",
    priority: "low",
    question:
      "Triple HITL (NEMT + two hospital liaisons) reads well for multi-agency story — does it risk demo friction vs. dual approver for a 5-min window?",
    context: "Week 2 expanded to PMH + Doctor's Hospital personas",
    rubric: "Agentic AI · PMF",
  },
  {
    id: "eval-llm-path",
    category: "Technical",
    priority: "low",
    question:
      "Should eval harness add an optional LLM assertion path for regression when keys are available, or keep CI-style demo-only checks for reproducibility?",
    context: "POST /api/eval/run defaults skipLlm: true",
    rubric: "Efficiency · Agentic AI",
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

  const deploy = buildDeployChecklist();

  return {
    evalScenarios: scenarioCount,
    evalPassed: evalRun?.summary?.passed ?? evalRun?.results?.filter((r) => r.passed).length ?? null,
    evalTotal: evalRun?.summary?.total ?? evalRun?.results?.length ?? null,
    evalSuiteMs: evalRun?.totalLatencyMs ?? null,
    lastPipelineMs: efficiency?.lastPipeline?.totalLatencyMs ?? null,
    lastPipelineTokens: efficiency?.lastPipeline?.totalTokens ?? null,
    deployChecksOk: deploy.ok,
    deploySummary: deploy.summary,
    demoMode: config.demoMode,
  };
}

export function buildLogbookWeek3() {
  const stats = liveStats();

  return {
    ok: true,
    phase: "week-3-day-21",
    logbookNumber: 3,
    title: "Logbook Entry #3 — Week 3",
    track: "Climate Risk & Disaster Coordination",
    project: "Climate & Crisis Ops Command",
    sprintGoal:
      "Judge-ready demo and rubric-aligned narrative — eval logged, efficiency measured, 5-min rehearsal, defensibility + staging deploy.",
    week3Delivered: WEEK3_DELIVERED,
    exitCriteria: {
      repeatable5MinDemo: true,
      evalLogged:
        stats.evalPassed != null &&
        stats.evalTotal != null &&
        stats.evalPassed === stats.evalTotal,
      pitchDeckOutline: "SPRINT.docx — 8 slides max",
      stagingReady: stats.deployChecksOk,
    },
    exitCriteriaMet:
      stats.evalScenarios >= 8 &&
      stats.deployChecksOk &&
      stats.evalPassed != null &&
      stats.evalTotal != null &&
      stats.evalPassed === stats.evalTotal,
    demoCheckpoint: {
      scenario: SCENARIO.title,
      strip: scenarioStripText(),
      eval: `${stats.evalPassed ?? "?"}/${stats.evalTotal ?? stats.evalScenarios} scenarios`,
      evalSuiteMs: stats.evalSuiteMs,
      lastPipeline: stats.lastPipelineMs
        ? `${stats.lastPipelineMs} ms · ${stats.lastPipelineTokens ?? 0} tokens`
        : "run pipeline for live metrics",
      staging: stats.deploySummary,
      demoMode: stats.demoMode,
    },
    week3ExitNote:
      "Repeatable 5-min demo with eval harness, token/latency logging, Broward defensibility narrative, Docker staging, and backup video checklist.",
    next: "Day 21 — demo day live run + Q&A prep",
    docs: {
      logbook: "docs/logbook-week3.md",
      mentorQuestions: "docs/mentor-questions.md",
      rehearsal: "docs/demo-5min-rehearsal.md",
      staging: "docs/staging-deploy.md",
      defensibility: "docs/defensibility-slide.md",
    },
    stats,
  };
}

export function buildMentorQuestions({ priority } = {}) {
  let questions = MENTOR_QUESTIONS;
  if (priority) {
    questions = questions.filter((q) => q.priority === priority);
  }

  const byCategory = {};
  for (const q of questions) {
    if (!byCategory[q.category]) byCategory[q.category] = [];
    byCategory[q.category].push(q);
  }

  return {
    ok: true,
    phase: "week-3-day-21",
    title: "Mentor questions — Climate & Crisis Ops Command",
    subtitle: "Prioritized for Day 20 check-in ahead of demo day (Day 21)",
    count: questions.length,
    highPriorityCount: questions.filter((q) => q.priority === "high").length,
    questions,
    byCategory,
    docs: "docs/mentor-questions.md",
  };
}

export function formatLogbookWeek3Text(logbook = buildLogbookWeek3()) {
  const delivered = logbook.week3Delivered
    .filter((d) => d.day <= 19)
    .map((d) => `- **${d.title}** (Day ${d.day}) — ${d.detail}`)
    .join("\n");

  const highQuestions = MENTOR_QUESTIONS.filter((q) => q.priority === "high")
    .map((q) => `- ${q.question}`)
    .join("\n");

  return [
    "Week 3 — Climate & Crisis Ops Command",
    "",
    "Track: Climate Risk & Disaster Coordination",
    "",
    `Sprint goal (Week 3): ${logbook.sprintGoal}`,
    "",
    "Week 3 delivered (Days 15–20):",
    "",
    delivered,
    `- **Logbook #3 + mentor questions** (Day 20) — paste-ready Week 3 summary and prioritized mentor ask list`,
    "",
    `Week 3 exit criteria: ${logbook.week3ExitNote}`,
    "",
    `Demo checkpoint: ${logbook.demoCheckpoint.scenario} · ${logbook.demoCheckpoint.strip}`,
    `Eval: ${logbook.demoCheckpoint.eval} · suite ${logbook.demoCheckpoint.evalSuiteMs ?? "?"} ms (demo mode)`,
    `Staging: ${logbook.demoCheckpoint.staging}`,
    "",
    "Ask mentors (high priority):",
    "",
    highQuestions,
    "",
    `Next: ${logbook.next}`,
    "",
    "---",
    "",
    "Command surface: http://127.0.0.1:8787",
    "5-min rehearsal: docs/demo-5min-rehearsal.md",
    "Staging guide: docs/staging-deploy.md",
    "Mentor questions: docs/mentor-questions.md",
  ].join("\n");
}

export function formatMentorQuestionsText(list = buildMentorQuestions()) {
  const lines = [
    list.title,
    list.subtitle,
    "",
    `Total: ${list.count} questions · ${list.highPriorityCount} high priority`,
    "",
  ];

  for (const [category, items] of Object.entries(list.byCategory)) {
    lines.push(`## ${category}`);
    lines.push("");
    for (const q of items) {
      lines.push(`[${q.priority.toUpperCase()}] ${q.question}`);
      lines.push(`  Context: ${q.context}`);
      lines.push(`  Rubric: ${q.rubric}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
