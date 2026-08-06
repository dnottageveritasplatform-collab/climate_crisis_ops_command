import { Router } from "express";
import {
  buildEvalReport,
  getLastEvalRun,
  loadScenarios,
  runEvalScenario,
  runEvalSuite,
} from "../eval/index.js";

const router = Router();

router.get("/scenarios", (_req, res) => {
  const scenarios = loadScenarios();
  res.json({
    ok: true,
    count: scenarios.length,
    scenarios: scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      level: s.level,
      expect: s.expect,
    })),
  });
});

router.get("/results", (_req, res) => {
  const run = getLastEvalRun();
  if (!run) {
    return res.json({ ok: true, run: null, message: "No eval run yet — POST /api/eval/run" });
  }
  res.json({ ok: run.ok, run: buildEvalReport(run) });
});

router.get("/results/:scenarioId", (req, res) => {
  const run = getLastEvalRun();
  if (!run) {
    return res.status(404).json({ ok: false, error: "No eval run yet" });
  }
  const result = run.results.find((r) => r.scenarioId === req.params.scenarioId);
  if (!result) {
    return res.status(404).json({ ok: false, error: "Scenario not in last run" });
  }
  res.json({ ok: result.passed, result });
});

router.post("/run", async (req, res) => {
  try {
    const ids = req.body?.ids;
    const skipLlm = req.body?.skipLlm !== false;
    const run = await runEvalSuite({ ids, skipLlm });
    res.json({ ok: run.ok, run });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/run/:scenarioId", async (req, res) => {
  try {
    const result = await runEvalScenario(req.params.scenarioId);
    if (result.error) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
