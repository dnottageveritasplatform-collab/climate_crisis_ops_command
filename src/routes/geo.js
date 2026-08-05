import { Router } from "express";
import {
  buildMapLayers,
  buildMapLayersFromTriage,
  getLastTriageRanking,
  loadGeoLayers,
} from "../geo/index.js";

const router = Router();

router.get("/layers", (req, res) => {
  const level = Number(req.query.level) || 2;
  if (req.query.source === "triage") {
    const ranking = getLastTriageRanking();
    if (!ranking) {
      return res.status(404).json({
        ok: false,
        error: "No triage ranking — run POST /api/agents/triage/rank first",
      });
    }
    return res.json(buildMapLayersFromTriage(ranking));
  }
  res.json(buildMapLayers(level));
});

router.get("/layers/triage", (_req, res) => {
  const ranking = getLastTriageRanking();
  if (!ranking) {
    return res.status(404).json({
      ok: false,
      error: "No triage ranking — run POST /api/agents/triage/rank first",
    });
  }
  res.json(buildMapLayersFromTriage(ranking));
});

router.get("/raw", (_req, res) => {
  res.json({ ok: true, ...loadGeoLayers() });
});

export default router;
