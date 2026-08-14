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
import {
  buildRoutingPreviewCrossRef,
  buildRoutingPreviewSummary,
  ingestRoutingAlternatesWebhook,
} from "../geo/routing.js";
import {
  buildFloodHazardCrossRef,
  buildFloodHazardSummary,
  ingestFloodDepthWebhook,
} from "../geo/hazards.js";
import {
  buildWindHazardCrossRef,
  buildWindHazardSummary,
  ingestWindExposureWebhook,
} from "../geo/wind.js";
import {
  buildMultiHazardCrossRef,
  buildMultiHazardSummary,
} from "../geo/multi-hazard.js";
import {
  buildRoadNetworkCrossRef,
  buildRoadNetworkSummary,
  ingestRoadNetworkWebhook,
} from "../geo/road-network.js";

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

/** Corridor-aware routing preview summary (Phase 2 Day 11). */
router.get("/routing/preview", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildRoutingPreviewSummary(level));
});

/** Cross-ref at-risk trips with alternate route advisories. */
router.get("/routing/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildRoutingPreviewCrossRef(level));
});

/** Webhook ingest for pilot agency routing alternate rules. */
router.post("/routing/ingest", (req, res) => {
  try {
    res.json(ingestRoutingAlternatesWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

/** Flood-depth hazard overlay summary (Phase 2 Day 12). */
router.get("/hazards/flood", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildFloodHazardSummary(level));
});

/** Cross-ref flood zones with restricted corridors + at-risk trips. */
router.get("/hazards/flood/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildFloodHazardCrossRef(level));
});

/** Webhook ingest for pilot agency flood-depth GIS layer. */
router.post("/hazards/flood/ingest", (req, res) => {
  try {
    res.json(ingestFloodDepthWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

/** Wind-exposure hazard overlay summary (Phase 2 Day 13). */
router.get("/hazards/wind", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildWindHazardSummary(level));
});

/** Cross-ref wind zones with restricted corridors + at-risk trips. */
router.get("/hazards/wind/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildWindHazardCrossRef(level));
});

/** Webhook ingest for pilot agency wind-exposure GIS layer. */
router.post("/hazards/wind/ingest", (req, res) => {
  try {
    res.json(ingestWindExposureWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

/** Combined flood + wind + routing fusion summary (Phase 2 Day 14). */
router.get("/hazards/combined", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildMultiHazardSummary(level));
});

/** Per-trip fused hazard + routing briefing cross-ref. */
router.get("/hazards/combined/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildMultiHazardCrossRef(level));
});

/** Pilot road network summary (Phase 2 Day 16). */
router.get("/routing/network", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildRoadNetworkSummary(level));
});

/** Turn-by-turn corridor avoidance cross-ref for at-risk trips. */
router.get("/routing/network/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildRoadNetworkCrossRef(level));
});

/** Webhook ingest for pilot agency road network graph. */
router.post("/routing/network/ingest", (req, res) => {
  try {
    res.json(ingestRoadNetworkWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

export default router;
