import { Router } from "express";
import {
  buildCopExport,
  buildPublicSafetyCorridorCrossRef,
  buildPublicSafetyMapUnits,
  buildPublicSafetySummary,
  getPublicSafetyOverlay,
  getPublicSafetyStatus,
  ingestPublicSafetyWebhook,
} from "../public-safety/index.js";

const router = Router();

router.get("/summary", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildPublicSafetySummary(level));
});

router.get("/status", (_req, res) => {
  res.json(getPublicSafetyStatus());
});

router.get("/overlay", (req, res) => {
  const refresh = req.query.refresh === "true";
  res.json(getPublicSafetyOverlay({ refresh }));
});

router.get("/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildPublicSafetyCorridorCrossRef(level));
});

router.get("/map-units", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildPublicSafetyMapUnits({ level }));
});

router.get("/cop-export", async (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(await buildCopExport(level));
});

router.post("/ingest", (req, res) => {
  try {
    res.json(ingestPublicSafetyWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
