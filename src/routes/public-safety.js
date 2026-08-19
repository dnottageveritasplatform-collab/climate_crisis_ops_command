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
import { formatCopExportText } from "../export/formatters.js";
import { respondExport } from "../export/respond.js";

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
  try {
    const level = Number(req.query.level) || 2;
    const cop = await buildCopExport(level);
    respondExport(req, res, cop, {
      formatText: formatCopExportText,
      pageTitle: "Climate & Crisis Ops Command — Common Operating Picture",
      subtitle: `COP · L${level}`,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/ingest", (req, res) => {
  try {
    res.json(ingestPublicSafetyWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
