import { Router } from "express";
import { buildDeployChecklist } from "../deploy/index.js";

const router = Router();

router.get("/checklist", (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.get("host");
  const baseUrl = host ? `${proto}://${host}` : undefined;
  res.json(buildDeployChecklist(baseUrl));
});

export default router;
