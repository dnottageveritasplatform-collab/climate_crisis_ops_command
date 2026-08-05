import { Router } from "express";
import {
  ROLES,
  approveHitl,
  getHitlReviewContent,
  getHitlStatus,
  resetHitl,
  stageHitlPack,
  startHitlReview,
} from "../hitl/index.js";

const router = Router();

router.get("/status", (_req, res) => {
  res.json(getHitlStatus());
});

router.get("/review", (req, res) => {
  const role = req.query.role;
  if (!role) {
    return res.status(400).json({ ok: false, error: "role query param required" });
  }
  const content = getHitlReviewContent(role);
  if (!content.ok) return res.status(404).json(content);
  res.json(content);
});

router.post("/stage", (req, res) => {
  const { pack, auditId, level } = req.body || {};
  if (!pack?.hospitalBulletin && !pack?.hospitalBulletins?.length) {
    return res.status(400).json({ ok: false, error: "pack with hospitalBulletin or hospitalBulletins required" });
  }
  res.json({ ok: true, status: stageHitlPack(pack, { auditId, level }) });
});

router.post("/review", (req, res) => {
  const { role } = req.body || {};
  const result = startHitlReview(role);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.post("/approve", (req, res) => {
  const { role, approver, notes, bulletinSubject, bulletinBody } = req.body || {};
  const result = approveHitl(role, { approver, notes, bulletinSubject, bulletinBody });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.post("/reset", (_req, res) => {
  res.json({ ok: true, status: resetHitl() });
});

router.get("/roles", (_req, res) => {
  res.json({ ok: true, roles: ROLES });
});

export default router;
