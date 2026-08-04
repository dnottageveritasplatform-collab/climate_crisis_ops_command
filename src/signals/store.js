let cache = null;

export function getCachedSignals() {
  return cache;
}

export function setCachedSignals(payload) {
  cache = payload;
  return cache;
}

export function clearSignalCache() {
  cache = null;
}
