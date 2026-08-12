import { Router } from "express";
import {
  acceptNemtHandoffWriteBack,
  buildHandoffCrossReference,
  buildPendingHandoffAccepts,
  buildTransportDeskSummary,
  getHandoffWriteBackStatus,
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

router.get("/pending-accepts", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json({
    ok: true,
    count: buildPendingHandoffAccepts(level).length,
    pendingAccepts: buildPendingHandoffAccepts(level),
  });
});

router.get("/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildHandoffCrossReference(level));
});

router.get("/writeback-status", (_req, res) => {
  res.json(getHandoffWriteBackStatus());
});

router.post("/handoff-accept", (req, res) => {
  try {
    const handoffs = req.body.handoffs || req.body.queue || (req.body.handoffId ? [req.body] : []);
    const result = acceptNemtHandoffWriteBack(handoffs, {
      source: req.body.source || "api",
      acceptedBy: req.body.acceptedBy || "nemt_dispatch",
    });
    res.status(result.ok ? 200 : result.partial ? 207 : 400).json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/ingest", (req, res) => {
  try {
    res.json(ingestTransportDeskWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
