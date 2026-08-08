import { Router } from "express";
import {
  buildDefensibilitySummary,
  buildDefensibilityNarrative,
  buildPhase2Roadmap,
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

export default router;
