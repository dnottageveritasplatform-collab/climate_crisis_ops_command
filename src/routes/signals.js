import { Router } from "express";
import { clearSignalCache, fetchSignals } from "../signals/index.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const data = await fetchSignals();
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/refresh", async (_req, res) => {
  try {
    clearSignalCache();
    const data = await fetchSignals({ refresh: true });
    res.json({ ok: true, refreshed: true, ...data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
