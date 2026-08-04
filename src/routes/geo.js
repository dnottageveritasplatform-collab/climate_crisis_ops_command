import { Router } from "express";
import { buildMapLayers, loadGeoLayers } from "../geo/index.js";

const router = Router();

router.get("/layers", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildMapLayers(level));
});

router.get("/raw", (_req, res) => {
  res.json({ ok: true, ...loadGeoLayers() });
});

export default router;
