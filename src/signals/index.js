import { fetchDemoSignals } from "./adapters/demo.js";
import { fetchLiveWeather } from "./adapters/weather.js";
import { clearSignalCache, getCachedSignals, setCachedSignals } from "./store.js";

/**
 * Ingest weather + institutional signals. Demo mock by default; optional NHC overlay.
 */
export async function fetchSignals({ refresh = false } = {}) {
  if (!refresh && getCachedSignals()) {
    return getCachedSignals();
  }

  const demo = await fetchDemoSignals();
  const liveWeather = await fetchLiveWeather();

  let weather = demo.weather;
  let mode = demo.mode;
  const signals = [...demo.signals];

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

  const payload = {
    ok: true,
    mode,
    liveWeather: Boolean(liveWeather),
    scenario: demo.scenario,
    serviceArea: demo.serviceArea,
    level: weather.level,
    label: weather.label,
    event: weather.event,
    source: weather.source,
    weather,
    institutional: demo.institutional,
    signals,
    signalCount: signals.length,
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
    fetchedAt: data.fetchedAt,
    mode: data.mode,
    liveWeather: data.liveWeather,
  };
}

export { clearSignalCache, getCachedSignals };
