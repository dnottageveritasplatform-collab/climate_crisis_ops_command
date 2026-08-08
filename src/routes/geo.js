import { Router } from "express";
import {
  attachCadOverlay,
  buildMapLayers,
  buildMapLayersFromTriage,
  getLastTriageRanking,
  loadGeoLayers,
} from "../geo/index.js";

const router = Router();

function enrichWithCad(layers, { includeCad = true } = {}) {
  if (!includeCad || !layers?.ok || layers.cadOverlay) return layers;
  return attachCadOverlay(layers);
}

router.get("/layers", (req, res) => {
  const level = Number(req.query.level) || 2;
  const includeCad = req.query.cad !== "false";
  if (req.query.source === "triage") {
    const ranking = getLastTriageRanking();
    if (!ranking) {
      return res.status(404).json({
        ok: false,
        error: "No triage ranking — run POST /api/agents/triage/rank first",
      });
    }
    return res.json(enrichWithCad(buildMapLayersFromTriage(ranking), { includeCad }));
  }
  res.json(enrichWithCad(buildMapLayers(level), { includeCad }));
});

router.get("/layers/triage", (req, res) => {
  const includeCad = req.query.cad !== "false";
  const ranking = getLastTriageRanking();
  if (!ranking) {
    return res.status(404).json({
      ok: false,
      error: "No triage ranking — run POST /api/agents/triage/rank first",
    });
  }
  res.json(enrichWithCad(buildMapLayersFromTriage(ranking), { includeCad }));
});

router.get("/raw", (_req, res) => {
  res.json({ ok: true, ...loadGeoLayers() });
});

export default router;
