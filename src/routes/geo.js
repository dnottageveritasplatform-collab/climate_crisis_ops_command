import { Router } from "express";
import {
  attachCadOverlay,
  buildMapLayers,
  buildMapLayersFromTriage,
  getLastTriageRanking,
  loadGeoLayers,
} from "../geo/index.js";
import {
  buildEsriCorridorSummary,
  getCorridorLayerMeta,
  ingestEsriCorridorWebhook,
} from "../geo/esri.js";

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

/** ESRI / agency GIS corridor layer summary (Phase 2 Day 6). */
router.get("/corridors/esri", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildEsriCorridorSummary(level));
});

/** Active corridor layer source metadata. */
router.get("/corridors/source", (_req, res) => {
  res.json({ ok: true, ...getCorridorLayerMeta() });
});

/** Webhook ingest for pilot ESRI FeatureServer push updates. */
router.post("/corridors/ingest", (req, res) => {
  try {
    res.json(ingestEsriCorridorWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
