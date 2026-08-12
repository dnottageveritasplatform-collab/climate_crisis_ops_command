import { fetchDemoSignals } from "./adapters/demo.js";
import { fetchLiveWeather } from "./adapters/weather.js";
import { clearSignalCache, getCachedSignals, setCachedSignals } from "./store.js";
import { mergeInstitutionalSignals, buildMultiFeedSummary } from "./multi-feed.js";

/**
 * Ingest weather + institutional signals. Demo mock by default; optional NHC + institutional overlays.
 */
export async function fetchSignals({ refresh = false } = {}) {
  if (!refresh && getCachedSignals()) {
    return getCachedSignals();
  }

  const demo = await fetchDemoSignals();
  const liveWeather = await fetchLiveWeather();
  const institutionalMerge = await mergeInstitutionalSignals(demo.institutional);

  let weather = demo.weather;
  let mode = demo.mode;
  const institutional = institutionalMerge.institutional;
  const signals = [weather, ...institutional];

  if (liveWeather) {
    weather = {
      ...demo.weather,
      ...liveWeather,
      level: demo.weather.level,
      label: demo.weather.label,
      demoEvent: demo.weather.event,
    };
    mode = "demo+live_weather";
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
    fetchedAt: new Date().toISOString(),
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
