import { Router } from "express";
import { buildDeployChecklist } from "../deploy/index.js";
import { buildSovereignDeployProfile, getSovereignDeployStatus } from "../deploy/sovereign.js";
import { formatSovereignDeployText } from "../export/formatters.js";
import { respondExport } from "../export/respond.js";

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
  const data = buildSovereignDeployProfile({ baseUrl: resolveBaseUrl(req) });
  respondExport(req, res, data, {
    formatText: formatSovereignDeployText,
    pageTitle: "Climate & Crisis Ops Command — Sovereign Deploy Profile",
    subtitle: data.headline || "On-prem readiness",
  });
});

router.get("/sovereign/checklist", (req, res) => {
  res.json(getSovereignDeployStatus({ baseUrl: resolveBaseUrl(req) }));
});

export default router;
