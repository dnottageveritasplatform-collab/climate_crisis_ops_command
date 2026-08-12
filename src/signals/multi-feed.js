/** Phase 2 Day 9 — multi-feed signal ingest (NHC live + institutional overlays). */

import { getActiveCorridorStatus } from "../geo/esri.js";
import { fetchLiveWeather } from "./adapters/weather.js";
import { fetchLiveInstitutionalFeed, loadInstitutionalFeedFile } from "./adapters/institutional.js";

export const MULTI_FEED_SCOPE_GUARD =
  "Multi-feed signal ingest — weather + institutional overlays; escalation level stays on demo SOP thresholds.";

let cachedInstitutional = null;
let webhookInstitutional = null;

function dedupeById(signals) {
  const seen = new Set();
  const out = [];
  for (const s of signals) {
    if (!s?.id || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

export function ingestInstitutionalFeed(source = "json") {
  const loaded = loadInstitutionalFeedFile();
  cachedInstitutional = {
    feeds: loaded.feeds,
    feedCount: loaded.feeds.length,
    source,
    ingestedAt: new Date().toISOString(),
    scopeGuard: loaded.scopeGuard || MULTI_FEED_SCOPE_GUARD,
    feedPath: loaded.feedPath,
  };
  return cachedInstitutional;
}

export function ingestInstitutionalWebhook(payload) {
  const items = payload?.feeds || payload?.institutional || payload?.signals;
  if (!Array.isArray(items) || !items.length) {
    throw new Error("Institutional webhook payload must include feeds, institutional, or signals array");
  }

  webhookInstitutional = {
    feeds: items.map((item) => ({
      ...item,
      category: "institutional",
      corridors: Array.isArray(item.corridors) ? item.corridors : [],
    })),
    feedCount: items.length,
    source: "webhook",
    ingestedAt: new Date().toISOString(),
    scopeGuard: MULTI_FEED_SCOPE_GUARD,
  };

  return {
    ok: true,
    ingested: webhookInstitutional.feedCount,
    source: "webhook",
    ingestedAt: webhookInstitutional.ingestedAt,
  };
}

export function getInstitutionalOverlay({ refresh = false } = {}) {
  if (!cachedInstitutional || refresh) ingestInstitutionalFeed("json");

  const merged = dedupeById([
    ...(webhookInstitutional?.feeds || []),
    ...(cachedInstitutional?.feeds || []),
  ]);

  return {
    ...cachedInstitutional,
    feeds: merged,
    feedCount: merged.length,
    webhookActive: Boolean(webhookInstitutional?.feeds?.length),
  };
}

/** Merge demo institutional rows with adapter file + optional live REST feed. */
export async function mergeInstitutionalSignals(demoInstitutional = []) {
  const overlay = getInstitutionalOverlay();
  const live = await fetchLiveInstitutionalFeed();
  const merged = dedupeById([
    ...(live?.feeds || []),
    ...(overlay.feeds || []),
    ...demoInstitutional.map((item) => ({
      ...item,
      category: "institutional",
      corridors: item.corridors || extractCorridors(`${item.headline} ${item.summary}`),
    })),
  ]);

  return {
    institutional: merged,
    sources: buildSourceList({ liveInstitutional: live, overlay, demoCount: demoInstitutional.length }),
    liveInstitutional: Boolean(live),
    adapter: live ? "rest" : overlay.webhookActive ? "webhook" : "json",
  };
}

function extractCorridors(text = "") {
  const matches = text.match(/CORR-\d+/gi) || [];
  return [...new Set(matches.map((c) => c.toUpperCase()))];
}

function buildSourceList({ liveInstitutional, overlay, demoCount }) {
  const sources = [{ id: "demo_weather", label: "Demo weather (SOP thresholds)", active: true }];
  if (process.env.NHC_FEED_URL) {
    sources.push({ id: "nhc_live", label: "NHC live RSS overlay", active: true, url: process.env.NHC_FEED_URL });
  }
  if (liveInstitutional) {
    sources.push({
      id: "institutional_rest",
      label: "Institutional REST feed",
      active: true,
      url: process.env.INSTITUTIONAL_FEED_URL,
    });
  } else if (overlay?.feedCount) {
    sources.push({
      id: "institutional_json",
      label: "Institutional JSON adapter",
      active: true,
      path: overlay.feedPath,
    });
  }
  if (overlay?.webhookActive) {
    sources.push({ id: "institutional_webhook", label: "Institutional webhook ingest", active: true });
  }
  if (demoCount) {
    sources.push({ id: "demo_institutional", label: "Demo institutional fallback", active: true });
  }
  return sources;
}

export async function getMultiFeedSources() {
  const overlay = getInstitutionalOverlay();
  const liveWeather = await fetchLiveWeather();
  const liveInstitutional = await fetchLiveInstitutionalFeed();

  return {
    ok: true,
    phase: "phase-2-day-9",
    scopeGuard: MULTI_FEED_SCOPE_GUARD,
    sources: buildSourceList({
      liveInstitutional,
      overlay,
      demoCount: overlay.feedCount,
    }),
    liveWeather: Boolean(liveWeather),
    nhcFeedUrl: process.env.NHC_FEED_URL || null,
    institutionalFeedUrl: process.env.INSTITUTIONAL_FEED_URL || null,
    institutionalFeedPath: overlay.feedPath,
    ingestedAt: overlay.ingestedAt,
  };
}

/** Cross-reference institutional headlines with corridor restriction status. */
export function buildMultiFeedCrossRef(level = 2) {
  const overlay = getInstitutionalOverlay();
  const corridorStatus = getActiveCorridorStatus(level);

  const restrictedCorridors = Object.entries(corridorStatus)
    .filter(([, st]) => st !== "open")
    .map(([id]) => id);

  const matches = overlay.feeds
    .map((signal) => {
      const corridors = signal.corridors?.length
        ? signal.corridors
        : extractCorridors(`${signal.headline} ${signal.summary}`);
      const linked = corridors.filter((c) => restrictedCorridors.includes(c));
      if (!linked.length && !corridors.length) return null;
      return {
        signalId: signal.id,
        source: signal.source,
        headline: signal.headline,
        severity: signal.severity,
        corridors,
        linkedCorridors: linked,
        corridorStatus: Object.fromEntries(linked.map((c) => [c, corridorStatus[c]])),
      };
    })
    .filter(Boolean);

  const corridorLinkedCount = matches.filter((m) => m.linkedCorridors.length).length;

  return {
    ok: true,
    phase: "phase-2-day-9",
    level,
    institutionalCount: overlay.feedCount,
    restrictedCorridorCount: restrictedCorridors.length,
    corridorLinkedSignalCount: corridorLinkedCount,
    matchedCount: corridorLinkedCount,
    matches: matches.slice(0, 8),
    scopeGuard: MULTI_FEED_SCOPE_GUARD,
    ingestedAt: overlay.ingestedAt,
  };
}

export function buildMultiFeedSummary(level = 2) {
  const overlay = getInstitutionalOverlay();
  const crossRef = buildMultiFeedCrossRef(level);
  const sources = buildSourceList({ liveInstitutional: null, overlay, demoCount: overlay.feedCount });

  return {
    ok: true,
    phase: "phase-2-day-9",
    headline: "Multi-feed signal ingest — NHC live + institutional overlays",
    level,
    institutionalCount: overlay.feedCount,
    feedSourceCount: sources.filter((s) => s.active).length,
    sources,
    institutional: overlay.feeds,
    corridorLinkedSignalCount: crossRef.corridorLinkedSignalCount,
    scopeGuard: MULTI_FEED_SCOPE_GUARD,
    adapter: overlay.webhookActive ? "webhook" : "json",
    ingestedAt: overlay.ingestedAt,
  };
}

/** Compact status for Monitor agent tool. */
export async function getMultiFeedStatus() {
  const overlay = getInstitutionalOverlay();
  const crossRef = buildMultiFeedCrossRef(2);
  const liveWeather = await fetchLiveWeather();
  const sourceMeta = await getMultiFeedSources();

  return {
    ok: true,
    phase: "phase-2-day-9",
    institutionalCount: overlay.feedCount,
    feedSourceCount: sourceMeta.sources.filter((s) => s.active).length,
    liveWeather: Boolean(liveWeather),
    liveInstitutional: sourceMeta.sources.some((s) => s.id === "institutional_rest"),
    corridorLinkedSignalCount: crossRef.corridorLinkedSignalCount,
    institutionalHeadlines: overlay.feeds.slice(0, 4).map((s) => s.headline),
    sources: sourceMeta.sources.map((s) => s.id),
    scopeGuard: MULTI_FEED_SCOPE_GUARD,
    ingestedAt: overlay.ingestedAt,
  };
}
