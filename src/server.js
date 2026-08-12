import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { getLlmConfig } from "./agents/runtime/llm.js";
import { SCENARIO, scenarioStripText } from "./scenario/index.js";
import agentsRouter from "./routes/agents.js";
import signalsRouter from "./routes/signals.js";
import geoRouter from "./routes/geo.js";
import dispatchRouter from "./routes/dispatch.js";
import sopsRouter from "./routes/sops.js";
import auditRouter from "./routes/audit.js";
import demoRouter from "./routes/demo.js";
import hitlRouter from "./routes/hitl.js";
import orchestratorRouter from "./routes/orchestrator.js";
import evalRouter from "./routes/eval.js";
import efficiencyRouter from "./routes/efficiency.js";
import defensibilityRouter from "./routes/defensibility.js";
import deployRouter from "./routes/deploy.js";
import logbookRouter from "./routes/logbook.js";
import cadRouter from "./routes/cad.js";
import transportDeskRouter from "./routes/transport-desk.js";
import publicSafetyRouter from "./routes/public-safety.js";
import shelterFleetRouter from "./routes/shelter-fleet.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use("/api/agents", agentsRouter);
app.use("/api/signals", signalsRouter);
app.use("/api/geo", geoRouter);
app.use("/api/dispatch", dispatchRouter);
app.use("/api/sops", sopsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/demo", demoRouter);
app.use("/api/hitl", hitlRouter);
app.use("/api/orchestrator", orchestratorRouter);
app.use("/api/eval", evalRouter);
app.use("/api/efficiency", efficiencyRouter);
app.use("/api/defensibility", defensibilityRouter);
app.use("/api/deploy", deployRouter);
app.use("/api/logbook", logbookRouter);
app.use("/api/cad", cadRouter);
app.use("/api/transport-desk", transportDeskRouter);
app.use("/api/public-safety", publicSafetyRouter);
app.use("/api/shelter-fleet", shelterFleetRouter);

app.get("/api/health", (_req, res) => {
  const llm = getLlmConfig();
  res.json({
    ok: true,
    service: "climate-crisis-ops-command",
    demoMode: config.demoMode,
    sprint: "Future Caribbean 2026",
    track: "Climate Risk & Disaster Coordination",
    phase: "phase-2-day-9",
    sprintComplete: true,
    phase2Started: true,
    phase2Day9Complete: true,
    phase2Day8Complete: true,
    phase2Day7Complete: true,
    phase2Day6Complete: true,
    phase2Day5Complete: true,
    phase2Day4Complete: true,
    phase2Day3Complete: true,
    phase2Day2Complete: true,
    llmProvider: config.demoMode ? null : llm.provider,
    llmModel: config.demoMode ? null : llm.model,
    llmKeyConfigured: config.demoMode ? null : llm.keyConfigured,
    llmKeyKind: config.demoMode ? null : llm.keyKind,
    llm: config.demoMode
      ? "demo_mode — set DEMO_MODE=false + LLM_* for live briefs"
      : `${llm.provider} — Monitor + Triage + Action agents`,
    eval: "8 scripted scenarios — POST /api/eval/run",
    efficiency: "token + latency logging — GET /api/efficiency/summary",
    defensibility: "Broward credibility + Phase 2 CAD/EMS roadmap — GET /api/defensibility/narrative",
    cad: "CAD overlay + live dispatch enrichment — GET /api/cad/enriched-dispatch",
    geo: "ESRI corridor layer + thin map — GET /api/geo/corridors/esri",
    transportDesk: "handoff queue + NEMT write-back pilot — GET /api/transport-desk/summary",
    publicSafety: "fire/police EOC overlay + COP export — GET /api/public-safety/summary",
    shelterFleet: "shelter + fleet extended HITL — GET /api/shelter-fleet/summary",
    audit: "persistent JSONL audit + EOC briefing export — GET /api/audit/eoc-briefing",
    signalsMultiFeed: "NHC live + institutional overlays — GET /api/signals/multi-feed",
    deploy: "staging checklist — GET /api/deploy/checklist",
    logbook: "Week 3 summary + mentor questions — GET /api/logbook/week3",
    demoDay: "live run + Q&A prep — GET /api/demo/runbook · POST /api/demo/preflight",
  });
});

app.get("/api/scenario", (_req, res) => {
  res.json({
    ok: true,
    ...SCENARIO,
    strip: scenarioStripText(),
  });
});

app.get("/api/status", (_req, res) => {
  res.json({
    phase: "phase-2-day-9",
    sprintComplete: true,
    phase2Started: true,
    phase2Day9Complete: true,
    phase2Day8Complete: true,
    phase2Day7Complete: true,
    phase2Day6Complete: true,
    phase2Day5Complete: true,
    phase2Day4Complete: true,
    phase2Day3Complete: true,
    phase2Day2Complete: true,
    phase2Day1Complete: true,
    week3Day21Complete: true,
    week3Day20Complete: true,
    week3Day19Complete: true,
    scenario: {
      id: SCENARIO.id,
      title: SCENARIO.title,
      strip: scenarioStripText(),
      demoDisclaimer: SCENARIO.demoDisclaimer,
    },
    week1Complete: true,
    llm: { provider: "demo", nebius: "deferred — no business email yet" },
    openclaw: {
      pattern: "tool-loop + logging",
      skillStub: "openclaw/workspace/skills/climate-monitor",
      gateway: "optional — install when mentors provide compute keys",
    },
    modules: {
      signals: "multi_feed_ingest_ready",
      agents: "monitor + triage + action_ready",
      orchestrator: "pipeline_ready",
      hitl: "extended_quintuple_ready",
      audit: "full_trail_ready",
      geo: "esri_corridor_layer",
      dispatch: "sample_manifest",
      cad: "live_enrichment",
      transportDesk: "writeback_pilot",
      publicSafety: "readonly_eoc_overlay",
      shelterFleet: "coordination_feed_ready",
      sops: "rag_corpus",
      eval: "harness_ready",
      efficiency: "token_latency_logging",
      demo: "demo_day_ready",
      defensibility: "narrative_ready",
      deploy: "staging_ready",
      logbook: "week3_ready",
      ui: "command_shell_map_polished",
    },
  });
});

const publicDir = path.join(__dirname, "ui", "public");
app.use(express.static(publicDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(
    `Climate & Crisis Ops Command listening on http://127.0.0.1:${config.port} (demoMode=${config.demoMode})`
  );
});
