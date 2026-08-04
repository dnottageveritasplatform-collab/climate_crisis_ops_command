import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import agentsRouter from "./routes/agents.js";
import signalsRouter from "./routes/signals.js";
import geoRouter from "./routes/geo.js";
import dispatchRouter from "./routes/dispatch.js";
import sopsRouter from "./routes/sops.js";
import auditRouter from "./routes/audit.js";
import demoRouter from "./routes/demo.js";

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

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "climate-crisis-ops-command",
    demoMode: config.demoMode,
    sprint: "Future Caribbean 2026",
    track: "Climate Risk & Disaster Coordination",
    phase: "week-1-day-7",
    week1ExitCriteria: "signal → brief → audit",
  });
});

app.get("/api/status", (_req, res) => {
  res.json({
    phase: "week-1-day-7",
    week1Complete: true,
    week1ExitCriteria: {
      signalIn: true,
      monitorBriefOnMap: true,
      auditLogEntry: true,
    },
    openclaw: {
      pattern: "tool-loop + logging",
      skillStub: "openclaw/workspace/skills/climate-monitor",
      gateway: "optional — install when mentors provide compute keys",
    },
    modules: {
      signals: "ingest_ready",
      agents: "monitor_brief_ready",
      orchestrator: "pending",
      hitl: "pending",
      audit: "trail_ready",
      geo: "layers_ready",
      dispatch: "sample_manifest",
      sops: "rag_corpus",
      ui: "command_shell_map",
    },
  });
});

const publicDir = path.join(__dirname, "ui", "public");
app.use(express.static(publicDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(config.port, () => {
  console.log(
    `Climate & Crisis Ops Command listening on http://127.0.0.1:${config.port} (demoMode=${config.demoMode})`
  );
});
