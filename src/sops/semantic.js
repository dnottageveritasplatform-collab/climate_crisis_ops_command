/** Phase 2 Day 10 — lightweight TF-IDF semantic search (no vector DB / no embedding API). */

const STOP = new Set([
  "a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "at", "by", "with", "is", "are",
  "be", "as", "it", "from", "each", "before", "after", "only", "not", "no", "via", "require",
]);

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function termFrequency(tokens) {
  const tf = new Map();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  return tf;
}

function buildIdf(chunks) {
  const df = new Map();
  for (const chunk of chunks) {
    const seen = new Set(chunk.tokens);
    for (const token of seen) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }
  const n = chunks.length || 1;
  const idf = new Map();
  for (const [token, count] of df.entries()) {
    idf.set(token, Math.log((n + 1) / (count + 1)) + 1);
  }
  return idf;
}

function toTfidfVector(tf, idf) {
  const vec = new Map();
  let norm = 0;
  for (const [token, freq] of tf.entries()) {
    const weight = freq * (idf.get(token) || 1);
    vec.set(token, weight);
    norm += weight * weight;
  }
  return { vec, norm: Math.sqrt(norm) || 1 };
}

function cosineSimilarity(a, b) {
  let dot = 0;
  const [small, large] = a.vec.size <= b.vec.size ? [a, b] : [b, a];
  for (const [token, weight] of small.vec.entries()) {
    const other = large.vec.get(token);
    if (other) dot += weight * other;
  }
  return dot / (a.norm * b.norm);
}

/** Chunk SOP docs into searchable bullet/section segments. */
export function buildSemanticChunks(corpus) {
  const chunks = [];

  for (const doc of corpus) {
    let section = doc.sopId;

    for (let i = 0; i < doc.lines.length; i++) {
      const line = doc.lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.endsWith(":") && !trimmed.startsWith("-")) {
        section = trimmed.slice(0, -1);
        continue;
      }

      const text = trimmed.startsWith("-") ? trimmed.slice(1).trim() : trimmed;
      if (!text || text.length < 12) continue;

      chunks.push({
        sopId: doc.sopId,
        file: doc.file,
        section,
        line: i + 1,
        text,
        ref: `${doc.sopId} §${section}`,
        tokens: tokenize(`${section} ${text}`),
      });
    }
  }

  return chunks;
}

/** Semantic (TF-IDF cosine) search over SOP chunks. */
export function semanticSearchSopCorpus(query, corpus, { limit = 8 } = {}) {
  const chunks = buildSemanticChunks(corpus);
  if (!chunks.length) {
    return { query, mode: "semantic", citations: [], matches: [`No SOP chunks indexed for "${query}"`] };
  }

  const idf = buildIdf(chunks);
  const queryVec = toTfidfVector(termFrequency(tokenize(query)), idf);
  const scored = chunks
    .map((chunk) => {
      const chunkVec = toTfidfVector(termFrequency(chunk.tokens), idf);
      const score = cosineSimilarity(queryVec, chunkVec);
      return {
        sopId: chunk.sopId,
        file: chunk.file,
        section: chunk.section,
        line: chunk.line,
        text: chunk.text,
        ref: chunk.ref,
        score: Math.round(score * 1000) / 1000,
        matchType: "semantic",
      };
    })
    .filter((c) => c.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    query,
    mode: "semantic",
    chunkCount: chunks.length,
    citations: scored,
    matches: scored.length ? scored.map((c) => c.text) : [`No semantic SOP matches for "${query}"`],
  };
}

export function isSemanticSearchEnabled() {
  return process.env.SOP_SEMANTIC !== "false";
}
