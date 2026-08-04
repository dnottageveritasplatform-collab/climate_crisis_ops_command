import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

/**
 * RAG-style keyword search across the full SOP corpus.
 * Returns structured citations ranked by match quality.
 */
export function querySopCorpus(query) {
  const q = query.toLowerCase();
  const corpus = loadSopCorpus();
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
        });
      }
    }
  }

  citations.sort((a, b) => b.score - a.score);

  return {
    query,
    corpusFiles: corpus.length,
    citations,
    matches: citations.length ? citations.map((c) => c.text) : [`No SOP lines matched for "${query}"`],
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
