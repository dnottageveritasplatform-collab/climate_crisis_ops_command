/** Phase 3b Day 9 — commercial urban flood pre-downloaded clip bundle for sovereign / air-gap edge. */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DEFAULT_CLIP_PATH, DEFAULT_GRID_PATH } from "./urban-flood-convert.js";
import { isUrbanFloodEnabled } from "./urban-flood.js";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const URBAN_FLOOD_AIRGAP_SCOPE_GUARD =
  "Urban flood air-gap bundle — pre-downloaded Nassau commercial clip on operator disk; no live vendor API required at runtime.";

const BUNDLE_FILES = [
  {
    id: "clip",
    env: "URBAN_FLOOD_CLIP_PATH",
    defaultPath: DEFAULT_CLIP_PATH,
    required: true,
    purpose: "Pre-downloaded Nassau urban clip GeoJSON (offline commercial pluvial gap-fill)",
  },
  {
    id: "grid",
    env: "URBAN_FLOOD_GRID_PATH",
    defaultPath: DEFAULT_GRID_PATH,
    required: false,
    purpose: "Optional depth grid sidecar for bundle refresh worker",
  },
  {
    id: "cache",
    env: "URBAN_FLOOD_CACHE_PATH",
    defaultPath: path.join(geoRoot, "urban-flood-cache.json"),
    required: false,
    purpose: "Last vendor fetch metadata — stale warning without outbound call",
  },
  {
    id: "validation_catalog",
    env: "URBAN_FLOOD_VALIDATION_CATALOG_PATH",
    defaultPath: path.join(geoRoot, "urban-flood-validation-catalog.json"),
    required: false,
    purpose: "Dorian FLOOD-04 offline validation spike catalog",
  },
];

function resolvePath(envName, defaultPath) {
  const raw = process.env[envName]?.trim();
  if (raw) return path.isAbsolute(raw) ? raw : path.join(projectRoot, raw);
  return defaultPath;
}

function fileStat(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { exists: false, path: filePath };
    const stat = fs.statSync(filePath);
    let featureCount = null;
    if (filePath.endsWith(".json")) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
        featureCount = Array.isArray(raw.features) ? raw.features.length : null;
      } catch {
        featureCount = null;
      }
    }
    return {
      exists: true,
      path: filePath,
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      featureCount,
    };
  } catch {
    return { exists: false, path: filePath };
  }
}

export function getUrbanFloodAirGapConfig() {
  const clipPath = process.env.URBAN_FLOOD_CLIP_PATH || DEFAULT_CLIP_PATH;
  const airGap = String(process.env.URBAN_FLOOD_AIRGAP ?? "").toLowerCase() === "true";
  const live = String(process.env.URBAN_FLOOD_LIVE ?? "").toLowerCase() === "true";
  return {
    enabled: isUrbanFloodEnabled(),
    airGap,
    live,
    clipPath,
    demoFallback: String(process.env.URBAN_FLOOD_DEMO ?? "true").toLowerCase() !== "false",
    docs: "docs/sovereign-deploy.md#urban-flood-air-gap-bundle",
  };
}

export function buildUrbanFloodAirGapProfile() {
  const cfg = getUrbanFloodAirGapConfig();
  const bundle = BUNDLE_FILES.map((item) => {
    const filePath =
      item.env === "URBAN_FLOOD_CLIP_PATH"
        ? cfg.clipPath
        : resolvePath(item.env, item.defaultPath);
    const stat = fileStat(filePath);
    return {
      id: item.id,
      env: item.env,
      path: filePath,
      required: item.required,
      purpose: item.purpose,
      ok: stat.exists,
      ...stat,
    };
  });

  const clip = bundle.find((b) => b.id === "clip");
  const requiredOk = bundle.filter((b) => b.required).every((b) => b.ok);
  const optionalPresent = bundle.filter((b) => !b.required && b.ok).length;

  return {
    ok: cfg.enabled ? requiredOk : true,
    phase: "phase-3b-day-9",
    profile: "urban_flood_airgap_bundle",
    enabled: cfg.enabled,
    clipReady: Boolean(clip?.ok),
    clipPath: clip?.path || cfg.clipPath,
    clipFeatureCount: clip?.featureCount ?? null,
    clipModifiedAt: clip?.modifiedAt ?? null,
    fetchPolicy: cfg.live ? "live_vendor_optional" : "offline_clip_only",
    airGapMode: cfg.airGap || (!cfg.live && clip?.ok),
    bundleFiles: bundle,
    bundleFileCount: bundle.filter((b) => b.ok).length,
    optionalBundleCount: optionalPresent,
    recommendedEnv: {
      URBAN_FLOOD_ENABLED: "true",
      URBAN_FLOOD_AIRGAP: "true",
      URBAN_FLOOD_LIVE: "false",
      URBAN_FLOOD_DEMO: "false",
      URBAN_FLOOD_CLIP_PATH: "data/geo/urban-flood-nassau-latest.json",
    },
    refreshWorker: "docs/urban-flood-sovereign-cron.md",
    scopeGuard: URBAN_FLOOD_AIRGAP_SCOPE_GUARD,
    docs: cfg.docs,
  };
}

/** Pipeline step — verify pre-downloaded urban clip bundle on sovereign edge. */
export function buildUrbanFloodAirGapPipelineStep() {
  if (!isUrbanFloodEnabled()) return null;
  const profile = buildUrbanFloodAirGapProfile();
  return {
    ok: profile.ok,
    step: "urban_flood_airgap_sync",
    phase: "phase-3b-day-9",
    ...profile,
    airGapBadgeLabel: profile.clipReady
      ? `urban air-gap clip · ${profile.clipFeatureCount ?? "?"} feature(s)`
      : "urban air-gap clip missing",
    syncAt: new Date().toISOString(),
  };
}
