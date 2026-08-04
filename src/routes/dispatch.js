import { Router } from "express";
import { getAtRiskTrips, loadDispatch, summarizeDispatch } from "../dispatch/index.js";

const router = Router();

router.get("/", (_req, res) => {
  const trips = loadDispatch();
  res.json({ ok: true, demo: true, count: trips.length, trips });
});

router.get("/at-risk", (req, res) => {
  const level = Number(req.query.level) || 2;
  const trips = getAtRiskTrips(level);
  res.json({ ok: true, level, count: trips.length, trips });
});

router.get("/summary", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json({ ok: true, ...summarizeDispatch(level) });
});

export default router;
