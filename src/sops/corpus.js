/** Phase 2 Day 10 — expanded operator corpus status + scenario cross-ref. */

import { loadSopCorpus, querySopCorpus } from "./index.js";
import { buildSemanticChunks, isSemanticSearchEnabled } from "./semantic.js";

export const SOP_CORPUS_SCOPE_GUARD =
  "Expanded operator SOP corpus with optional hybrid semantic RAG — citations in audit; not auto-dispatch authority.";

const SCENARIO_TAGS = {
  1: ["Level 1", "Monitor"],
  2: ["Level 2", "CORR", "COMMS-03", "SHELTER", "FLEET"],
  3: ["Level 3", "CORR", "COMMS-03", "SHELTER", "FLEET", "Restrict"],
  4: ["Level 4", "CORR", "COMMS-03", "closed"],
};

function uniqueSopIds(citations) {
  return [...new Set((citations || []).map((c) => c.sopId).filter(Boolean))];
}

/** Cross-reference scenario tags with hybrid SOP retrieval at escalation level. */
export function buildSopCorpusCrossRef(level = 2) {
  const tags = SCENARIO_TAGS[level] || SCENARIO_TAGS[2];
  const mode = isSemanticSearchEnabled() ? "hybrid" : "keyword";
  const tagResults = tags.map((tag) => {
    const result = querySopCorpus(tag, { mode, limit: 4 });
    return {
      tag,
      citationCount: result.citations.length,
      sopIds: uniqueSopIds(result.citations),
      topRef: result.citations[0]?.ref || null,
    };
  });

  const matchedSopIds = [...new Set(tagResults.flatMap((t) => t.sopIds))];
  const totalCitations = tagResults.reduce((sum, t) => sum + t.citationCount, 0);

  return {
    ok: true,
    phase: "phase-2-day-10",
    level,
    mode,
    tagCount: tags.length,
    matchedSopCount: matchedSopIds.length,
    matchedCount: matchedSopIds.length,
    totalCitations,
    matchedSopIds,
    tagResults,
    scopeGuard: SOP_CORPUS_SCOPE_GUARD,
  };
}

export function buildSopCorpusSummary() {
  const corpus = loadSopCorpus();
  const chunks = buildSemanticChunks(corpus);
  const semanticEnabled = isSemanticSearchEnabled();

  return {
    ok: true,
    phase: "phase-2-day-10",
    headline: "Expanded operator SOP corpus — keyword + optional hybrid semantic RAG",
    fileCount: corpus.length,
    chunkCount: chunks.length,
    sopIds: corpus.map((d) => d.sopId),
    files: corpus.map((d) => ({ file: d.file, sopId: d.sopId })),
    semanticEnabled,
    searchMode: semanticEnabled ? "hybrid" : "keyword",
    scopeGuard: SOP_CORPUS_SCOPE_GUARD,
    adapter: "local_tfidf",
  };
}

/** Compact status for Monitor agent tool. */
export function getSopCorpusStatus() {
  const summary = buildSopCorpusSummary();
  const crossRef = buildSopCorpusCrossRef(2);

  return {
    ok: true,
    phase: "phase-2-day-10",
    fileCount: summary.fileCount,
    chunkCount: summary.chunkCount,
    sopIds: summary.sopIds,
    semanticEnabled: summary.semanticEnabled,
    searchMode: summary.searchMode,
    scenarioMatchedSops: crossRef.matchedSopCount,
    scopeGuard: SOP_CORPUS_SCOPE_GUARD,
  };
}
