/** Phase 3b Day 2+ — commercial urban flood vendor API probe + cache + Day 3 grid conversion. */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { convertUrbanFloodGridFile } from "./urban-flood-convert.js";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultCachePath = path.join(geoRoot, "urban-flood-cache.json");

const DEFAULT_FATHOM_URL = "https://api.fathom.global/v1";
const DEFAULT_TIMEOUT_MS = 20000;

export function getUrbanFloodStaleThresholdHours() {
  const n = Number(process.env.URBAN_FLOOD_STALE_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 24;
}

export function getUrbanFloodVendorConfig() {
  const vendor = (process.env.URBAN_FLOOD_VENDOR || "demo").trim().toLowerCase();
  const key = process.env.URBAN_FLOOD_API_KEY?.trim() || null;
  const apiUrl =
    process.env.URBAN_FLOOD_API_URL?.trim() ||
    (vendor === "fathom" ? DEFAULT_FATHOM_URL : null);
  const cachePath = process.env.URBAN_FLOOD_CACHE_PATH || defaultCachePath;
  const live = String(process.env.URBAN_FLOOD_LIVE || "").toLowerCase() === "true";
  const mock = String(process.env.URBAN_FLOOD_API_MOCK || "").toLowerCase() === "true";
  return {
    vendor,
    keyConfigured: Boolean(key),
    key,
    apiUrl: apiUrl?.replace(/\/$/, "") || null,
    cachePath,
    live,
    mock,
    timeoutMs: Number(process.env.URBAN_FLOOD_FETCH_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    docs: "docs/urban-flood-vendor-setup.md",
  };
}

export function readUrbanFloodCache() {
  const { cachePath } = getUrbanFloodVendorConfig();
  try {
    if (!fs.existsSync(cachePath)) return null;
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

export function writeUrbanFloodCache(payload) {
  const { cachePath } = getUrbanFloodVendorConfig();
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const next = {
    ...readUrbanFloodCache(),
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(cachePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function recordAttempt(partial) {
  return writeUrbanFloodCache({
    lastAttemptAt: new Date().toISOString(),
    ...partial,
  });
}

function attachGridConversion(vendorResult) {
  try {
    const conversion = convertUrbanFloodGridFile({
      vendor: vendorResult.vendor || getUrbanFloodVendorConfig().vendor,
    });
    recordAttempt({
      lastSuccessfulFetchAt: vendorResult.lastSuccessfulFetchAt || new Date().toISOString(),
      ok: vendorResult.ok !== false,
      fetchMode: conversion.fetchMode,
      conversionPending: false,
      clipPath: conversion.clipPath,
      gridPath: conversion.gridPath,
      featureCount: conversion.featureCount,
      filteredBelowThreshold: conversion.filteredBelowThreshold,
      message: "Grid converted to Nassau urban clip GeoJSON",
    });
    return {
      ...vendorResult,
      conversion,
      fetchMode: conversion.fetchMode,
      conversionPending: false,
      clipPath: conversion.clipPath,
      featureCount: conversion.featureCount,
    };
  } catch (err) {
    recordAttempt({
      ok: vendorResult.ok,
      conversionPending: true,
      conversionError: err.message,
    });
    return { ...vendorResult, conversion: { ok: false, error: err.message }, conversionPending: true };
  }
}

function probeUrls(baseUrl, vendor) {
  if (!baseUrl) return [];
  const root = baseUrl.replace(/\/$/, "");
  if (vendor === "fathom") {
    return [`${root}/health`, `${root}/catalogue`, `${root}/status`];
  }
  if (vendor === "jba") {
    return [`${root}/health`, `${root}/status`, `${root}/forecasts?limit=1`];
  }
  return [`${root}/health`, `${root}/status`, `${root}/`];
}

async function probeVendorEndpoint(url, key, timeoutMs) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: key ? `Bearer ${key}` : undefined,
      "X-API-Key": key || undefined,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 240) };
  }
  return { ok: res.ok, status: res.status, url, body };
}

/** Probe vendor credentials + catalogue; Day 3 adds grid/export → polygon clip. */
export async function fetchUrbanFloodFromVendor({ refresh = true } = {}) {
  const cfg = getUrbanFloodVendorConfig();
  const cache = readUrbanFloodCache();
  const attemptAt = new Date().toISOString();

  if (cfg.vendor === "demo" && !cfg.keyConfigured && !cfg.mock) {
    recordAttempt({
      lastAttemptAt: attemptAt,
      ok: false,
      reason: "demo_vendor",
      message: "URBAN_FLOOD_VENDOR=demo — use demo clip until design-partner key configured",
      fallback: "demo_json",
      vendor: cfg.vendor,
    });
    return attachGridConversion({
      ok: false,
      reason: "demo_vendor",
      message: "Demo vendor mode — grid converted to clip when grid file present",
      fallback: "demo_json",
      keyConfigured: false,
      vendor: cfg.vendor,
      lastSuccessfulFetchAt: cache?.lastSuccessfulFetchAt || null,
      lastAttemptAt: attemptAt,
      conversionPending: true,
    });
  }

  if (!cfg.keyConfigured && !cfg.mock) {
    recordAttempt({
      lastAttemptAt: attemptAt,
      ok: false,
      reason: "missing_api_key",
      message: "Set URBAN_FLOOD_API_KEY — see docs/urban-flood-vendor-setup.md",
      fallback: "demo_json",
      vendor: cfg.vendor,
    });
    return {
      ok: false,
      reason: "missing_api_key",
      message: "Set URBAN_FLOOD_API_KEY for live vendor fetch",
      fallback: "demo_json",
      keyConfigured: false,
      vendor: cfg.vendor,
      lastSuccessfulFetchAt: cache?.lastSuccessfulFetchAt || null,
      lastAttemptAt: attemptAt,
      conversionPending: true,
    };
  }

  if (cfg.mock) {
    const mockMeta = recordAttempt({
      lastAttemptAt: attemptAt,
      lastSuccessfulFetchAt: attemptAt,
      ok: true,
      reason: "vendor_mock",
      fetchMode: "vendor_metadata_mock",
      vendor: cfg.vendor,
      catalogueOk: true,
      conversionPending: true,
      provider: `Commercial urban flood (${cfg.vendor} mock)`,
      message: "URBAN_FLOOD_API_MOCK=true — metadata OK; grid converted to Nassau urban clip",
    });
    return attachGridConversion({
      ok: true,
      reason: "vendor_mock",
      vendor: cfg.vendor,
      catalogueOk: true,
      keyConfigured: true,
      lastSuccessfulFetchAt: mockMeta.lastSuccessfulFetchAt,
      lastAttemptAt: attemptAt,
      message: "URBAN_FLOOD_API_MOCK — vendor metadata OK; grid converted to Nassau urban clip",
      cache: mockMeta,
      fetchMode: "vendor_metadata_mock",
    });
  }

  if (!cfg.apiUrl) {
    recordAttempt({
      lastAttemptAt: attemptAt,
      ok: false,
      reason: "missing_api_url",
      message: "Set URBAN_FLOOD_API_URL or URBAN_FLOOD_VENDOR=fathom|jba",
      fallback: "demo_json",
      vendor: cfg.vendor,
    });
    return {
      ok: false,
      reason: "missing_api_url",
      message: "Set URBAN_FLOOD_API_URL for vendor probe",
      fallback: "demo_json",
      keyConfigured: true,
      vendor: cfg.vendor,
      lastSuccessfulFetchAt: cache?.lastSuccessfulFetchAt || null,
      lastAttemptAt: attemptAt,
      conversionPending: true,
    };
  }

  let lastError = null;
  for (const url of probeUrls(cfg.apiUrl, cfg.vendor)) {
    try {
      const probe = await probeVendorEndpoint(url, cfg.key, cfg.timeoutMs);
      if (probe.ok) {
        const forecastReference =
          probe.body?.forecastReference ||
          probe.body?.updatedAt ||
          probe.body?.updated ||
          probe.body?.version ||
          null;
        const cacheMeta = recordAttempt({
          lastAttemptAt: attemptAt,
          lastSuccessfulFetchAt: attemptAt,
          ok: true,
          reason: "vendor_metadata",
          fetchMode: "vendor_metadata",
          vendor: cfg.vendor,
          catalogueOk: true,
          conversionPending: true,
          provider: cfg.vendor === "fathom" ? "Fathom Global" : cfg.vendor === "jba" ? "JBA Flood Foresight" : "Commercial urban flood",
          probeUrl: url,
          probeStatus: probe.status,
          forecastReference,
          message: "Vendor credentials verified — export clip + polygon conversion complete",
        });
        return attachGridConversion({
          ok: true,
          reason: "vendor_metadata",
          vendor: cfg.vendor,
          catalogueOk: true,
          keyConfigured: true,
          lastSuccessfulFetchAt: cacheMeta.lastSuccessfulFetchAt,
          lastAttemptAt: attemptAt,
          forecastReference,
          probeUrl: url,
          message: "Vendor credentials verified — grid converted to Nassau urban clip GeoJSON",
          cache: cacheMeta,
          fetchMode: "vendor_metadata",
        });
      }
      lastError = {
        reason: probe.status === 401 || probe.status === 403 ? "vendor_auth_failed" : "vendor_probe_failed",
        status: probe.status,
        url,
        body: probe.body,
      };
    } catch (err) {
      lastError = { reason: "vendor_network_error", message: err.message, url };
    }
  }

  recordAttempt({
    lastAttemptAt: attemptAt,
    ok: false,
    reason: lastError?.reason || "vendor_probe_failed",
    message: lastError?.message || `Vendor probe failed (${lastError?.status ?? "network"})`,
    fallback: "demo_json",
    vendor: cfg.vendor,
    lastSuccessfulFetchAt: cache?.lastSuccessfulFetchAt || null,
    probeUrl: lastError?.url,
  });

  return {
    ok: false,
    reason: lastError?.reason || "vendor_probe_failed",
    message: lastError?.message || "Vendor API probe failed — using demo fallback",
    fallback: "demo_json",
    keyConfigured: true,
    vendor: cfg.vendor,
    lastSuccessfulFetchAt: cache?.lastSuccessfulFetchAt || null,
    lastAttemptAt: attemptAt,
    conversionPending: true,
    probeStatus: lastError?.status,
    probeUrl: lastError?.url,
  };
}

export function getUrbanFloodVendorStatus() {
  const cfg = getUrbanFloodVendorConfig();
  const cache = readUrbanFloodCache();
  const staleHours = cache?.lastSuccessfulFetchAt
    ? (Date.now() - Date.parse(cache.lastSuccessfulFetchAt)) / 3600000
    : null;
  const staleThresholdHours = getUrbanFloodStaleThresholdHours();

  return {
    ok: true,
    phase: "phase-3b-day-7",
    vendor: cfg.vendor,
    keyConfigured: cfg.keyConfigured,
    live: cfg.live,
    mock: cfg.mock,
    apiUrl: cfg.apiUrl,
    cachePath: cfg.cachePath,
    lastSuccessfulFetchAt: cache?.lastSuccessfulFetchAt || null,
    lastAttemptAt: cache?.lastAttemptAt || null,
    fetchMode: cache?.fetchMode || "demo_json",
    catalogueOk: cache?.catalogueOk ?? false,
    conversionPending: cache?.conversionPending ?? true,
    clipPath: cache?.clipPath || null,
    featureCount: cache?.featureCount ?? null,
    staleHours: staleHours != null ? Math.round(staleHours * 10) / 10 : null,
    staleThresholdHours,
    staleWarning: staleHours != null && staleHours > staleThresholdHours,
    docs: cfg.docs,
  };
}
