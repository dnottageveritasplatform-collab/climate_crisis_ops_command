import { Router } from "express";
import {
  buildDefensibilitySummary,
  buildDefensibilityNarrative,
  buildPhase2Roadmap,
  buildDefensibilityPitch,
  formatDefensibilityPitchText,
} from "../defensibility/index.js";

const router = Router();

router.get("/summary", (_req, res) => {
  res.json(buildDefensibilitySummary());
});

router.get("/narrative", (_req, res) => {
  res.json(buildDefensibilityNarrative());
});

router.get("/phase2", (_req, res) => {
  res.json(buildPhase2Roadmap());
});

router.get("/pitch", (_req, res) => {
  try {
    const pitch = buildDefensibilityPitch();
    if (_req.query.format === "text") {
      res.type("text/plain").send(formatDefensibilityPitchText(pitch));
      return;
    }
    res.json(pitch);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
