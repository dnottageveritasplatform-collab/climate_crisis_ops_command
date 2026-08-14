import { Router } from "express";
import { buildDeployChecklist } from "../deploy/index.js";
import { buildSovereignDeployProfile, getSovereignDeployStatus } from "../deploy/sovereign.js";

const router = Router();

function resolveBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.get("host");
  return host ? `${proto}://${host}` : undefined;
}

router.get("/checklist", (req, res) => {
  res.json(buildDeployChecklist(resolveBaseUrl(req)));
});

/** Sovereign on-prem deploy profile (Phase 2 Day 15). */
router.get("/sovereign", (req, res) => {
  res.json(buildSovereignDeployProfile({ baseUrl: resolveBaseUrl(req) }));
});

router.get("/sovereign/checklist", (req, res) => {
  res.json(getSovereignDeployStatus({ baseUrl: resolveBaseUrl(req) }));
});

export default router;
