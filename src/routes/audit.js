import { Router } from "express";
import { buildAuditTrail, getAuditLog, getLatestAuditEntry } from "../audit/index.js";

const router = Router();

router.get("/", (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json({ ok: true, entries: getAuditLog(limit) });
});

router.get("/trail", (req, res) => {
  const limit = Number(req.query.limit) || 15;
  res.json(buildAuditTrail(limit));
});

router.get("/latest", (_req, res) => {
  const entry = getLatestAuditEntry();
  res.json({ ok: true, entry });
});

export default router;
