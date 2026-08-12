import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isSemanticSearchEnabled, semanticSearchSopCorpus } from "./semantic.js";

const corpusDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/sops");

/** Load all .txt SOP files from the crisis corpus. */
export function loadSopCorpus() {
  const files = fs.readdirSync(corpusDir).filter((f) => f.endsWith(".txt"));
  return files.map((file) => {
    const text = fs.readFileSync(path.join(corpusDir, file), "utf8");
    const lines = text.split("\n");
    const sopId = lines[0]?.split(" - ")[0]?.trim() || file.replace(".txt", "");
    return { file, sopId, text, lines };
  });
}

function keywordSearch(query, corpus, { limit = 8 } = {}) {
  const q = query.toLowerCase();
  const citations = [];

  for (const doc of corpus) {
    let section = "";

    for (let i = 0; i < doc.lines.length; i++) {
      const line = doc.lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.endsWith(":") && !trimmed.startsWith("-")) {
        section = trimmed.slice(0, -1);
        continue;
      }

      const haystack = `${section} ${trimmed}`.toLowerCase();
      if (!haystack.includes(q)) continue;

      const score = scoreMatch(haystack, q, section);

      if (trimmed.startsWith("-")) {
        citations.push({
          sopId: doc.sopId,
          file: doc.file,
          section,
          line: i + 1,
          text: trimmed.slice(1).trim(),
          ref: `${doc.sopId} §${section}`,
          score,
          matchType: "keyword",
        });
      } else if (section.toLowerCase().includes(q) || trimmed.toLowerCase().includes(q)) {
        citations.push({
          sopId: doc.sopId,
          file: doc.file,
          section: trimmed.endsWith(":") ? trimmed.slice(0, -1) : section,
          line: i + 1,
          text: trimmed,
          ref: `${doc.sopId} §${section || trimmed}`,
          score,
          matchType: "keyword",
        });
      }
    }
  }

  citations.sort((a, b) => b.score - a.score);
  return citations.slice(0, limit);
}

function mergeHybridCitations(keywordHits, semanticHits, { limit = 8 } = {}) {
  const byRef = new Map();

  for (const hit of keywordHits) {
    byRef.set(hit.ref, { ...hit, score: hit.score * 0.6, matchType: "hybrid" });
  }

  for (const hit of semanticHits) {
    const existing = byRef.get(hit.ref);
    const semanticScore = hit.score * 100 * 0.4;
    if (existing) {
      existing.score = Math.round((existing.score + semanticScore) * 100) / 100;
    } else {
      byRef.set(hit.ref, { ...hit, score: semanticScore, matchType: "hybrid" });
    }
  }

  return [...byRef.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * RAG-style search across the operator SOP corpus.
 * Phase 2 Day 10: optional hybrid semantic (TF-IDF) + keyword merge.
 */
export function querySopCorpus(query, options = {}) {
  const corpus = loadSopCorpus();
  const limit = options.limit ?? 8;
  const mode =
    options.mode ||
    (isSemanticSearchEnabled() ? "hybrid" : "keyword");

  if (mode === "keyword") {
    const citations = keywordSearch(query, corpus, { limit });
    return {
      query,
      mode: "keyword",
      corpusFiles: corpus.length,
      semanticEnabled: false,
      citations,
      matches: citations.length ? citations.map((c) => c.text) : [`No SOP lines matched for "${query}"`],
    };
  }

  if (mode === "semantic") {
    const result = semanticSearchSopCorpus(query, corpus, { limit });
    return {
      ...result,
      corpusFiles: corpus.length,
      semanticEnabled: true,
    };
  }

  const keywordHits = keywordSearch(query, corpus, { limit: limit * 2 });
  const semanticResult = semanticSearchSopCorpus(query, corpus, { limit: limit * 2 });
  const citations = mergeHybridCitations(keywordHits, semanticResult.citations, { limit });

  return {
    query,
    mode: "hybrid",
    corpusFiles: corpus.length,
    semanticEnabled: true,
    chunkCount: semanticResult.chunkCount,
    citations,
    matches: citations.length ? citations.map((c) => c.text) : [`No SOP matches for "${query}"`],
  };
}

function scoreMatch(haystack, query, section) {
  let score = haystack.includes(query) ? 10 : 0;
  if (section.toLowerCase().includes(query)) score += 5;
  if (haystack.startsWith(query)) score += 3;
  return score;
}

export function listCorpusFiles() {
  return loadSopCorpus().map((d) => ({ file: d.file, sopId: d.sopId }));
}
