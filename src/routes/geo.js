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
  buildGlofasCrossRef,
  buildGlofasSummary,
  getGlofasFloodStatus,
  ingestGlofasWebhook,
  syncGlofasFloodLayer,
} from "../geo/glofas.js";
import {
  buildGlofasValidationReport,
  buildGlofasValidationSummary,
} from "../geo/glofas-validation.js";
import {
  buildUrbanFloodValidationReport,
  buildUrbanFloodValidationSummary,
} from "../geo/urban-flood-validation.js";
import { buildGlofasAirGapProfile } from "../geo/glofas-sovereign.js";
import { buildUrbanFloodAirGapProfile } from "../geo/urban-flood-sovereign.js";
import { buildGlofasRunbookSummary } from "../geo/glofas-runbook.js";
import { buildFloodStackRunbookSummary } from "../geo/flood-stack-runbook.js";
import {
  buildUrbanFloodCrossRef,
  buildUrbanFloodSummary,
  getUrbanFloodStatus,
  ingestUrbanFloodWebhook,
  syncUrbanFloodLayer,
} from "../geo/urban-flood.js";
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
import { formatMultiHazardText, formatRoutingPreviewText } from "../export/formatters.js";
import { respondExport } from "../export/respond.js";

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
  const data = buildRoutingPreviewSummary(level);
  respondExport(req, res, data, {
    formatText: formatRoutingPreviewText,
    pageTitle: "Climate & Crisis Ops Command — Routing Preview",
    subtitle: `L${level} · ${data.tripAdvisoryCount ?? 0} trip advisory(ies)`,
  });
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

/** GloFAS gap-fill summary (Phase 3 Day 1). */
router.get("/hazards/glofas", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildGlofasSummary(level));
});

/** CDS cache + credential status (Phase 3 Day 2). */
router.get("/hazards/glofas/status", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(getGlofasFloodStatus(level));
});

/** Cross-ref GloFAS zones with restricted corridors + at-risk trips. */
router.get("/hazards/glofas/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildGlofasCrossRef(level));
});

/** Attempt live EWDS/CDS fetch (Phase 3 Day 2); returns status + demo fallback note. */
router.post("/hazards/glofas/fetch", async (req, res) => {
  try {
    const level = Number(req.body?.level || req.query?.level) || 2;
    const result = await syncGlofasFloodLayer(level, { refresh: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** Webhook ingest for pre-clipped GloFAS GeoJSON (sovereign / batch worker). */
router.post("/hazards/glofas/ingest", (req, res) => {
  try {
    res.json(ingestGlofasWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

/** Historical validation spike — Alma / Dorian vs agency GIS (Phase 3 Day 8). */
router.get("/hazards/glofas/validation", (req, res) => {
  const eventId = req.query.event;
  if (eventId) {
    const report = buildGlofasValidationReport(String(eventId));
    return report.ok ? res.json(report) : res.status(404).json(report);
  }
  res.json(buildGlofasValidationSummary());
});

/** Sovereign air-gap GloFAS clip bundle status (Phase 3 Day 9). */
router.get("/hazards/glofas/air-gap", (_req, res) => {
  res.json(buildGlofasAirGapProfile());
});

/** Pilot runbook — agency-first trust matrix + scope guard review (Phase 3 Day 10). */
router.get("/hazards/glofas/runbook", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildGlofasRunbookSummary(level));
});

/** Three-layer flood stack runbook — agency · GloFAS · commercial (Phase 3b Day 10). */
router.get("/hazards/flood-stack/runbook", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildFloodStackRunbookSummary(level));
});

/** Commercial urban flood summary (Phase 3b Day 1). */
router.get("/hazards/urban-flood", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildUrbanFloodSummary(level));
});

/** Vendor cache + credential status (Phase 3b Day 2). */
router.get("/hazards/urban-flood/status", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(getUrbanFloodStatus(level));
});

/** Cross-ref commercial urban zones with restricted corridors + at-risk trips. */
router.get("/hazards/urban-flood/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildUrbanFloodCrossRef(level));
});

/** Attempt live vendor API fetch (Phase 3b Day 2); returns status + demo fallback note. */
router.post("/hazards/urban-flood/fetch", async (req, res) => {
  try {
    const level = Number(req.body?.level || req.query?.level) || 2;
    const result = await syncUrbanFloodLayer(level, { refresh: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/** Webhook ingest for licensed commercial urban flood GeoJSON (Fathom/JBA worker). */
router.post("/hazards/urban-flood/ingest", (req, res) => {
  try {
    res.json(ingestUrbanFloodWebhook(req.body));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

/** Dorian FLOOD-04 re-validation — commercial urban vs agency GIS (Phase 3b Day 8). */
router.get("/hazards/urban-flood/validation", (req, res) => {
  const eventId = req.query.event;
  if (eventId) {
    const report = buildUrbanFloodValidationReport(String(eventId));
    return report.ok ? res.json(report) : res.status(404).json(report);
  }
  res.json(buildUrbanFloodValidationSummary());
});

/** Sovereign air-gap urban flood clip bundle status (Phase 3b Day 9). */
router.get("/hazards/urban-flood/air-gap", (_req, res) => {
  res.json(buildUrbanFloodAirGapProfile());
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
  const data = buildMultiHazardSummary(level);
  respondExport(req, res, data, {
    formatText: formatMultiHazardText,
    pageTitle: "Climate & Crisis Ops Command — Multi-Hazard Fusion",
    subtitle: `L${level} · ${data.fusedTripCount ?? 0} fused trip(s)`,
  });
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
