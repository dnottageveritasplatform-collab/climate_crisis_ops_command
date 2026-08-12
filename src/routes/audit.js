import { Router } from "express";
import {
  buildAuditTrail,
  getAuditLog,
  getAuditPersistStatus,
  getLatestAuditEntry,
  getLastAuditPersistResult,
} from "../audit/index.js";
import { buildEocAuditBriefing } from "../audit/eoc-export.js";

const router = Router();

router.get("/", (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json({ ok: true, entries: getAuditLog(limit), persist: getAuditPersistStatus(getAuditLog(limit).length) });
});

router.get("/trail", (req, res) => {
  const limit = Number(req.query.limit) || 15;
  res.json({ ...buildAuditTrail(limit), persist: getAuditPersistStatus(limit) });
});

router.get("/latest", (_req, res) => {
  const entry = getLatestAuditEntry();
  res.json({ ok: true, entry, persist: getAuditPersistStatus(1) });
});

router.get("/persist", (_req, res) => {
  res.json({ ok: true, ...getAuditPersistStatus(getAuditLog().length), lastWrite: getLastAuditPersistResult() });
});

router.get("/eoc-briefing", async (req, res) => {
  const level = Number(req.query.level) || 2;
  const limit = Number(req.query.limit) || 20;
  res.json(await buildEocAuditBriefing({ level, limit }));
});

export default router;
