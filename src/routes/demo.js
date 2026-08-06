import { Router } from "express";
import { runWeek1Demo } from "../demo/week1.js";
import { buildRehearsalScript, formatRehearsalScriptText } from "../demo/rehearsal.js";

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

export default router;
