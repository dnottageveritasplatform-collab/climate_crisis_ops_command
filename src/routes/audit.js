import { Router } from "express";
import { getAuditLog, getLatestAuditEntry } from "../audit/index.js";

const router = Router();

router.get("/", (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json({ ok: true, entries: getAuditLog(limit) });
});

router.get("/latest", (_req, res) => {
  const entry = getLatestAuditEntry();
  res.json({ ok: true, entry });
});

export default router;
