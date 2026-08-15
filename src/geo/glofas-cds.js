/** Phase 3 Day 2+ — Copernicus CDS metadata fetch + Day 3 grid→polygon conversion. */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { convertGlofasGridFile } from "./glofas-convert.js";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultCachePath = path.join(geoRoot, "glofas-cds-cache.json");

const DEFAULT_CDS_URL = "https://cds.climate.copernicus.eu/api";
const DEFAULT_DATASET = "cems-glofas-forecast";
const DEFAULT_TIMEOUT_MS = 20000;

export function getGlofasStaleThresholdHours() {
  const n = Number(process.env.GLOFAS_STALE_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 36;
}

export function getGlofasCdsConfig() {
  const key = process.env.GLOFAS_CDS_KEY?.trim() || null;
  const baseUrl = (process.env.GLOFAS_CDS_URL?.trim() || DEFAULT_CDS_URL).replace(/\/$/, "");
  const dataset = process.env.GLOFAS_CDS_DATASET?.trim() || DEFAULT_DATASET;
  const cachePath = process.env.GLOFAS_CDS_CACHE_PATH || defaultCachePath;
  const live = String(process.env.GLOFAS_LIVE || "").toLowerCase() === "true";
  const mock = String(process.env.GLOFAS_CDS_MOCK || "").toLowerCase() === "true";
  return {
    keyConfigured: Boolean(key),
    key,
    baseUrl,
    dataset,
    cachePath,
    live,
    mock,
    timeoutMs: Number(process.env.GLOFAS_FETCH_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    docs: "docs/glofas-cds-setup.md",
  };
}

export function readGlofasCdsCache() {
  const { cachePath } = getGlofasCdsConfig();
  try {
    if (!fs.existsSync(cachePath)) return null;
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

export function writeGlofasCdsCache(payload) {
  const { cachePath } = getGlofasCdsConfig();
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const next = {
    ...readGlofasCdsCache(),
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(cachePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function attachGridConversion(cdsResult) {
  try {
    const conversion = convertGlofasGridFile();
    recordAttempt({
      lastSuccessfulFetchAt: cdsResult.lastSuccessfulFetchAt || new Date().toISOString(),
      ok: true,
      fetchMode: conversion.fetchMode,
      conversionPending: false,
      clipPath: conversion.clipPath,
      gridPath: conversion.gridPath,
      featureCount: conversion.featureCount,
      filteredBelowThreshold: conversion.filteredBelowThreshold,
      message: "Grid converted to Nassau clip GeoJSON",
    });
    return {
      ...cdsResult,
      conversion,
      fetchMode: conversion.fetchMode,
      conversionPending: false,
      clipPath: conversion.clipPath,
      featureCount: conversion.featureCount,
    };
  } catch (err) {
    recordAttempt({
      ok: cdsResult.ok,
      conversionPending: true,
      conversionError: err.message,
    });
    return { ...cdsResult, conversion: { ok: false, error: err.message }, conversionPending: true };
  }
}

function recordAttempt(partial) {
  return writeGlofasCdsCache({
    lastAttemptAt: new Date().toISOString(),
    ...partial,
  });
}

function catalogueUrls(baseUrl, dataset) {
  return [
    `${baseUrl}/catalogue/v1/collections/${dataset}`,
    `${baseUrl}/catalogue/v1/messages?limit=1`,
    `${baseUrl}/retrieve/v1/processes?limit=1`,
  ];
}

async function probeCdsEndpoint(url, key, timeoutMs) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "PRIVATE-TOKEN": key,
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

/** Probe CDS credentials + catalogue; Day 3 adds GRIB retrieve + polygon clip. */
export async function fetchGlofasFromCds({ refresh = true } = {}) {
  const cfg = getGlofasCdsConfig();
  const cache = readGlofasCdsCache();
  const attemptAt = new Date().toISOString();

  if (!cfg.keyConfigured && !cfg.mock) {
    recordAttempt({
      lastAttemptAt: attemptAt,
      ok: false,
      reason: "missing_cds_key",
      message: "Set GLOFAS_CDS_KEY — see docs/glofas-cds-setup.md",
      fallback: "demo_json",
    });
    return {
      ok: false,
      reason: "missing_cds_key",
      message: "Set GLOFAS_CDS_KEY for live EWDS fetch",
      fallback: "demo_json",
      keyConfigured: false,
      dataset: cfg.dataset,
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
      reason: "cds_mock",
      fetchMode: "cds_metadata_mock",
      dataset: cfg.dataset,
      catalogueOk: true,
      conversionPending: true,
      provider: "Copernicus CDS (mock)",
      message: "GLOFAS_CDS_MOCK=true — metadata OK; polygon conversion ships Day 3",
    });
    return attachGridConversion({
      ok: true,
      reason: "cds_mock",
      dataset: cfg.dataset,
      catalogueOk: true,
      keyConfigured: true,
      lastSuccessfulFetchAt: mockMeta.lastSuccessfulFetchAt,
      lastAttemptAt: attemptAt,
      message: "GLOFAS_CDS_MOCK — metadata OK; grid converted to Nassau clip",
      cache: mockMeta,
    });
  }

  let lastError = null;
  for (const url of catalogueUrls(cfg.baseUrl, cfg.dataset)) {
    try {
      const probe = await probeCdsEndpoint(url, cfg.key, cfg.timeoutMs);
      if (probe.ok) {
        const forecastReference =
          probe.body?.properties?.metadata?.["forecast reference"] ||
          probe.body?.forecastReference ||
          probe.body?.updated ||
          null;
        const cacheMeta = recordAttempt({
          lastAttemptAt: attemptAt,
          lastSuccessfulFetchAt: attemptAt,
          ok: true,
          reason: "cds_metadata",
          fetchMode: "cds_metadata",
          dataset: cfg.dataset,
          catalogueOk: true,
          conversionPending: true,
          provider: "Copernicus CDS / EWDS",
          probeUrl: url,
          probeStatus: probe.status,
          forecastReference,
          message: "CDS credentials verified — GRIB clip + polygon conversion ships Phase 3 Day 3",
        });
        return attachGridConversion({
          ok: true,
          reason: "cds_metadata",
          dataset: cfg.dataset,
          catalogueOk: true,
          keyConfigured: true,
          lastSuccessfulFetchAt: cacheMeta.lastSuccessfulFetchAt,
          lastAttemptAt: attemptAt,
          forecastReference,
          probeUrl: url,
          message: "CDS credentials verified — grid converted to Nassau clip GeoJSON",
          cache: cacheMeta,
        });
      }
      lastError = {
        reason: probe.status === 401 || probe.status === 403 ? "cds_auth_failed" : "cds_probe_failed",
        status: probe.status,
        url,
        body: probe.body,
      };
    } catch (err) {
      lastError = { reason: "cds_network_error", message: err.message, url };
    }
  }

  recordAttempt({
    lastAttemptAt: attemptAt,
    ok: false,
    reason: lastError?.reason || "cds_probe_failed",
    message: lastError?.message || `CDS probe failed (${lastError?.status ?? "network"})`,
    fallback: "demo_json",
    dataset: cfg.dataset,
    lastSuccessfulFetchAt: cache?.lastSuccessfulFetchAt || null,
    probeUrl: lastError?.url,
  });

  return {
    ok: false,
    reason: lastError?.reason || "cds_probe_failed",
    message: lastError?.message || "CDS catalogue probe failed — using demo fallback",
    fallback: "demo_json",
    keyConfigured: true,
    dataset: cfg.dataset,
    lastSuccessfulFetchAt: cache?.lastSuccessfulFetchAt || null,
    lastAttemptAt: attemptAt,
    conversionPending: true,
    probeStatus: lastError?.status,
    probeUrl: lastError?.url,
  };
}

export function getGlofasCdsStatus() {
  const cfg = getGlofasCdsConfig();
  const cache = readGlofasCdsCache();
  const staleHours = cache?.lastSuccessfulFetchAt
    ? (Date.now() - Date.parse(cache.lastSuccessfulFetchAt)) / 3600000
    : null;

  const staleThresholdHours = getGlofasStaleThresholdHours();

  return {
    ok: true,
    phase: "phase-3-day-10",
    keyConfigured: cfg.keyConfigured,
    live: cfg.live,
    mock: cfg.mock,
    dataset: cfg.dataset,
    baseUrl: cfg.baseUrl,
    cachePath: cfg.cachePath,
    lastSuccessfulFetchAt: cache?.lastSuccessfulFetchAt || null,
    lastAttemptAt: cache?.lastAttemptAt || null,
    fetchMode: cache?.fetchMode || "demo_json",
    catalogueOk: cache?.catalogueOk ?? false,
    conversionPending: cache?.conversionPending ?? !cache?.clipPath,
    clipPath: cache?.clipPath || null,
    featureCount: cache?.featureCount ?? null,
    staleHours: staleHours != null ? Math.round(staleHours * 10) / 10 : null,
    staleThresholdHours,
    staleWarning: staleHours != null && staleHours > staleThresholdHours,
    docs: cfg.docs,
  };
}
