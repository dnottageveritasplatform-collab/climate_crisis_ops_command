import { Router } from "express";
import { runWeek1Demo } from "../demo/week1.js";

const router = Router();

router.post("/week1", async (_req, res) => {
  try {
    const result = await runWeek1Demo();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
