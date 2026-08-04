import { Router } from "express";
import { listCorpusFiles, querySopCorpus } from "../sops/index.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, corpus: listCorpusFiles() });
});

router.get("/query", (req, res) => {
  const query = req.query.q || req.query.query;
  if (!query) return res.status(400).json({ ok: false, error: "Missing q query param" });
  res.json({ ok: true, ...querySopCorpus(query) });
});

export default router;
