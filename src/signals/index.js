import { fetchDemoSignals } from "./adapters/demo.js";
import { fetchLiveWeather, prefetchLiveWeather } from "./adapters/weather.js";
import { clearSignalCache, getCachedSignals, setCachedSignals } from "./store.js";
import { mergeInstitutionalSignals, buildMultiFeedSummary } from "./multi-feed.js";
import { applyNhcEscalation } from "./nhc-escalation.js";

let evalMode = false;
/** @type {Promise<any> | null} */
let inflightFetch = null;

/** Eval harness uses scripted levels — skip live NHC so scenarios stay deterministic. */
export function setEvalSignalMode(enabled) {
  evalMode = enabled;
}

export { prefetchLiveWeather };

function nhcLiveEnabled() {
  return !evalMode && process.env.NHC_LIVE !== "false" && Boolean(process.env.NHC_FEED_URL?.trim());
}

/**
 * Ingest weather + institutional signals.
 * When NHC live is enabled, escalation level/label and outlook text come from the real feed.
 */
export async function fetchSignals({ refresh = false } = {}) {
  const cached = getCachedSignals();
  const shouldRetryFailedNhc =
    cached?.nhcFetchFailed && nhcLiveEnabled() && !evalMode;

  if (!refresh && cached && !shouldRetryFailedNhc) {
    return cached;
  }

  if (inflightFetch) {
    return inflightFetch;
  }

  inflightFetch = fetchSignalsInternal({ refresh: true }).finally(() => {
    inflightFetch = null;
  });

  return inflightFetch;
}

async function fetchSignalsInternal({ refresh = false } = {}) {
  if (!refresh && getCachedSignals()) {
    return getCachedSignals();
  }

  const demo = await fetchDemoSignals();
  const liveWeather = nhcLiveEnabled() ? await fetchLiveWeather() : null;
  const institutionalMerge = await mergeInstitutionalSignals(demo.institutional);

  let weather = demo.weather;
  let mode = demo.mode;
  const institutional = institutionalMerge.institutional;
  const signals = [weather, ...institutional];
  const fetchedAt = new Date().toISOString();
  const nhcRequested = nhcLiveEnabled();

  if (liveWeather) {
    weather = applyNhcEscalation(
      {
        ...liveWeather,
        demoFallback: {
          event: demo.weather.event,
          level: demo.weather.level,
          label: demo.weather.label,
        },
      },
      { serviceArea: demo.serviceArea }
    );
    if (liveWeather.stale) {
      weather.nhcStale = true;
      weather.outlookExcerpt = `[Cached NHC · ${Math.round(liveWeather.staleAgeMs / 60000)}m ago] ${weather.outlookExcerpt || ""}`;
    }
    mode = liveWeather.stale ? "live_weather_stale" : "live_weather";
    signals[0] = weather;
  } else if (nhcRequested) {
    weather = {
      ...demo.weather,
      issuedAt: fetchedAt,
      escalationSource: "demo_fallback",
      nhcFetchFailed: true,
      event: "NHC feed unavailable — demo scenario loaded",
      summary:
        "Live NHC fetch failed after retries. Tropical Storm Alma is synthetic demo data for the Nassau Metro exercise — not a real NHC advisory. Click Refresh or restart the server; check console for [nhc] errors.",
      outlookExcerpt:
        "Demo only: fictional Tropical Storm Alma scenario. Live NHC Atlantic Tropical Weather Outlook could not be retrieved.",
      demoScenarioEvent: demo.weather.event,
    };
    mode = "demo_nhc_unavailable";
    signals[0] = weather;
  } else {
    weather = {
      ...weather,
      issuedAt: fetchedAt,
      escalationSource: "demo_sop",
      outlookExcerpt: demo.weather.summary?.split(".").slice(0, 2).join(". ") + ".",
    };
    signals[0] = weather;
  }

  if (institutionalMerge.liveInstitutional) {
    mode = mode === "demo" ? "demo+live_institutional" : `${mode}+live_institutional`;
  }

  const multiFeed = buildMultiFeedSummary(weather.level ?? 2);

  const payload = {
    ok: true,
    mode,
    liveWeather: Boolean(liveWeather),
    nhcRequested,
    nhcFetchFailed: nhcRequested && !liveWeather,
    liveInstitutional: institutionalMerge.liveInstitutional,
    scenario: demo.scenario,
    serviceArea: demo.serviceArea,
    level: weather.level,
    label: weather.label,
    event: weather.event,
    source: weather.source,
    weather,
    institutional,
    signals,
    signalCount: signals.length,
    multiFeed: {
      feedSourceCount: multiFeed.feedSourceCount,
      institutionalCount: multiFeed.institutionalCount,
      corridorLinkedSignalCount: multiFeed.corridorLinkedSignalCount,
      sources: multiFeed.sources,
      adapter: institutionalMerge.adapter,
      scopeGuard: multiFeed.scopeGuard,
    },
    fetchedAt,
  };

  return setCachedSignals(payload);
}

/** Compact shape for Monitor agent tool `get_signal_status`. */
export async function getSignalStatus() {
  const data = await fetchSignals();
  return {
    level: data.level,
    label: data.label,
    event: data.event,
    source: data.source,
    serviceArea: data.serviceArea,
    scenario: data.scenario,
    weatherSummary: data.weather.summary,
    outlookExcerpt: data.weather.outlookExcerpt,
    escalationSource: data.weather.escalationSource,
    escalationRationale: data.weather.escalationRationale,
    activeSystems: data.weather.activeSystems,
    institutionalCount: data.institutional.length,
    institutionalHeadlines: data.institutional.map((s) => s.headline),
    feedSourceCount: data.multiFeed?.feedSourceCount,
    corridorLinkedSignals: data.multiFeed?.corridorLinkedSignalCount,
    fetchedAt: data.fetchedAt,
    mode: data.mode,
    liveWeather: data.liveWeather,
    liveInstitutional: data.liveInstitutional,
  };
}

export { clearSignalCache, getCachedSignals };
