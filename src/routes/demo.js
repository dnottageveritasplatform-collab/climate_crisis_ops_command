import { Router } from "express";
import { runWeek1Demo } from "../demo/week1.js";
import { buildRehearsalScript, formatRehearsalScriptText } from "../demo/rehearsal.js";
import {
  buildDemoDayRunbook,
  buildQaPrep,
  runDemoDayPreflight,
  formatDemoDayRunbookText,
  formatQaPrepText,
} from "../demo/day21.js";
import { respondExport } from "../export/respond.js";

const router = Router();

router.post("/week1", async (_req, res) => {
  try {
    const result = await runWeek1Demo();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/rehearsal", (req, res) => {
  try {
    const script = buildRehearsalScript();
    respondExport(req, res, script, {
      formatText: formatRehearsalScriptText,
      pageTitle: "Climate & Crisis Ops Command — Demo Rehearsal",
      subtitle: `${script.totalDurationSec / 60} min beat sheet`,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/runbook", (req, res) => {
  try {
    const runbook = buildDemoDayRunbook();
    respondExport(req, res, runbook, {
      formatText: formatDemoDayRunbookText,
      pageTitle: "Climate & Crisis Ops Command — Demo Day Runbook",
      subtitle: runbook.headline || "Demo day runbook",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/qa", (req, res) => {
  try {
    const qa = buildQaPrep({ category: req.query.category });
    respondExport(req, res, qa, {
      formatText: formatQaPrepText,
      pageTitle: "Climate & Crisis Ops Command — Demo Q&A Prep",
      subtitle: qa.headline || "Q&A prep",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/preflight", async (_req, res) => {
  try {
    const pipelineSmoke = _req.query.pipeline !== "false";
    const result = await runDemoDayPreflight({ pipelineSmoke });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
