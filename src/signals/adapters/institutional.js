import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const defaultPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/signals/institutional-feed-demo.json"
);

function resolveFeedPath() {
  return process.env.INSTITUTIONAL_FEED_PATH || defaultPath;
}

function normalizeSignal(item) {
  return {
    id: item.id,
    source: item.source,
    type: item.type || "institutional",
    severity: item.severity || "watch",
    headline: item.headline,
    summary: item.summary,
    corridors: Array.isArray(item.corridors) ? item.corridors : [],
    issuedAt: item.issuedAt || new Date().toISOString(),
    category: "institutional",
  };
}

export function loadInstitutionalFeedFile() {
  const feedPath = resolveFeedPath();
  const raw = fs.readFileSync(feedPath, "utf8");
  const parsed = JSON.parse(raw);
  const items = parsed.feeds || parsed.institutional || parsed.signals || [];
  return {
    feeds: items.map(normalizeSignal),
    scopeGuard: parsed.scopeGuard,
    source: "json",
    feedPath,
  };
}

/** Optional REST adapter when pilot agency provides institutional feed endpoint. */
export async function fetchLiveInstitutionalFeed() {
  const url = process.env.INSTITUTIONAL_FEED_URL;
  if (!url) return null;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const parsed = await res.json();
    const items = parsed.feeds || parsed.institutional || parsed.signals || [];
    if (!Array.isArray(items) || !items.length) return null;

    return {
      feeds: items.map(normalizeSignal),
      scopeGuard: parsed.scopeGuard,
      source: "rest",
      feedUrl: url,
    };
  } catch {
    return null;
  }
}
