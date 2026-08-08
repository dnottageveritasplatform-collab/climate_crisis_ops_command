import { Router } from "express";
import {
  buildHandoffCrossReference,
  buildTransportDeskSummary,
  getTransportDeskOverlay,
  getTransportDeskStatus,
  ingestTransportDeskWebhook,
} from "../transport-desk/index.js";

const router = Router();

router.get("/summary", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildTransportDeskSummary(level));
});

router.get("/status", (_req, res) => {
  res.json(getTransportDeskStatus());
});

router.get("/hospitals", (req, res) => {
  const refresh = req.query.refresh === "true";
  const desk = getTransportDeskOverlay({ refresh });
  res.json({
    ok: true,
    count: desk.hospitalCount,
    hospitals: desk.hospitals,
    scopeGuard: desk.scopeGuard,
    ingestedAt: desk.ingestedAt,
  });
});

router.get("/handoff-queue", (req, res) => {
  const refresh = req.query.refresh === "true";
  const desk = getTransportDeskOverlay({ refresh });
  res.json({
    ok: true,
    count: desk.handoffCount,
    pendingHandoffs: desk.pendingHandoffs,
    queue: desk.handoffQueue,
    scopeGuard: desk.scopeGuard,
    ingestedAt: desk.ingestedAt,
  });
});

router.get("/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildHandoffCrossReference(level));
});

router.post("/ingest", (req, res) => {
  try {
    res.json(ingestTransportDeskWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
