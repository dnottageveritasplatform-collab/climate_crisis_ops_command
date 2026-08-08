import { Router } from "express";
import {
  buildCadCrossReference,
  buildCadMapUnits,
  buildCadSummary,
  getCadIngestStatus,
  getCadOverlay,
  ingestCadWebhook,
} from "../cad/index.js";

const router = Router();

router.get("/overlay", (req, res) => {
  const refresh = req.query.refresh === "true";
  res.json(getCadOverlay({ refresh }));
});

router.get("/summary", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildCadSummary(level));
});

router.get("/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildCadCrossReference(level));
});

router.get("/map-units", (req, res) => {
  const level = Number(req.query.level) || 2;
  const atRiskTripIds = req.query.tripIds
    ? String(req.query.tripIds).split(",").filter(Boolean)
    : undefined;
  res.json(buildCadMapUnits({ level, atRiskTripIds }));
});

router.get("/status", (_req, res) => {
  res.json(getCadIngestStatus());
});

router.post("/ingest", (req, res) => {
  try {
    const result = ingestCadWebhook(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
