import { Router } from "express";
import {
  buildShelterFleetCrossRef,
  buildShelterFleetSummary,
  getShelterFleetStatus,
  ingestShelterFleetWebhook,
} from "../shelter-fleet/index.js";

const router = Router();

router.get("/summary", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildShelterFleetSummary(level));
});

router.get("/status", (_req, res) => {
  res.json(getShelterFleetStatus());
});

router.get("/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildShelterFleetCrossRef(level));
});

router.post("/ingest", (req, res) => {
  try {
    res.json(ingestShelterFleetWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
