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

const router = Router();

router.post("/week1", async (_req, res) => {
  try {
    const result = await runWeek1Demo();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/rehearsal", (_req, res) => {
  try {
    const script = buildRehearsalScript();
    if (_req.query.format === "text") {
      res.type("text/plain").send(formatRehearsalScriptText(script));
      return;
    }
    res.json(script);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/runbook", (_req, res) => {
  try {
    const runbook = buildDemoDayRunbook();
    if (_req.query.format === "text") {
      res.type("text/plain").send(formatDemoDayRunbookText(runbook));
      return;
    }
    res.json(runbook);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/qa", (_req, res) => {
  try {
    const qa = buildQaPrep({ category: _req.query.category });
    if (_req.query.format === "text") {
      res.type("text/plain").send(formatQaPrepText(qa));
      return;
    }
    res.json(qa);
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
