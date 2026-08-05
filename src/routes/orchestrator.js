import { Router } from "express";
import { runPipeline } from "../orchestrator/index.js";

const router = Router();

router.post("/run", async (req, res) => {
  try {
    const level = req.body?.level ? Number(req.body.level) : undefined;
    const refreshSignals = req.body?.refreshSignals !== false;
    const result = await runPipeline({ level, refreshSignals });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
