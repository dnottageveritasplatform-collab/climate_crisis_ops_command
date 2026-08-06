import { Router } from "express";
import {
  buildEfficiencySummary,
  getAgentRuns,
  getLlmCalls,
  getPipelineRuns,
} from "../efficiency/index.js";

const router = Router();

router.get("/summary", (_req, res) => {
  res.json(buildEfficiencySummary());
});

router.get("/runs/agents", (req, res) => {
  const limit = Number(req.query.limit) || 20;
  res.json({ ok: true, runs: getAgentRuns(limit) });
});

router.get("/runs/pipelines", (req, res) => {
  const limit = Number(req.query.limit) || 10;
  res.json({ ok: true, runs: getPipelineRuns(limit) });
});

router.get("/runs/llm", (req, res) => {
  const limit = Number(req.query.limit) || 30;
  res.json({ ok: true, calls: getLlmCalls(limit) });
});

router.get("/narrative", (_req, res) => {
  const summary = buildEfficiencySummary();
  res.json({
    ok: true,
    narrative: summary.narrative,
    lastPipelineMetrics: summary.lastPipelineMetrics,
  });
});

export default router;
