import { Router } from "express";
import { listCorpusFiles, querySopCorpus } from "../sops/index.js";
import { buildSopCorpusCrossRef, buildSopCorpusSummary } from "../sops/corpus.js";
import { formatSopCorpusText } from "../export/formatters.js";
import { respondExport } from "../export/respond.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, corpus: listCorpusFiles() });
});

router.get("/corpus", (req, res) => {
  const data = buildSopCorpusSummary();
  respondExport(req, res, data, {
    formatText: formatSopCorpusText,
    pageTitle: "Climate & Crisis Ops Command — Operator SOP Corpus",
    subtitle: data.headline || "SOP corpus index",
  });
});

router.get("/cross-ref", (req, res) => {
  const level = Number(req.query.level) || 2;
  res.json(buildSopCorpusCrossRef(level));
});

router.get("/query", (req, res) => {
  const query = req.query.q || req.query.query;
  if (!query) return res.status(400).json({ ok: false, error: "Missing q query param" });
  const mode = req.query.mode;
  res.json({ ok: true, ...querySopCorpus(query, mode ? { mode } : {}) });
});

router.get("/search", (req, res) => {
  const query = req.query.q || req.query.query;
  if (!query) return res.status(400).json({ ok: false, error: "Missing q query param" });
  const mode = req.query.mode;
  res.json({ ok: true, ...querySopCorpus(query, mode ? { mode } : {}) });
});

export default router;
