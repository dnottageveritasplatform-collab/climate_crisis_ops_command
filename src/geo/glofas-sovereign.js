/** Phase 3 Day 9 — GloFAS pre-downloaded clip bundle for sovereign / air-gap edge. */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DEFAULT_CLIP_PATH } from "./glofas-convert.js";
import { isGlofasEnabled } from "./glofas.js";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const GLOFAS_AIRGAP_SCOPE_GUARD =
  "GloFAS air-gap bundle — pre-downloaded Nassau clip on operator disk; no live CDS/EWDS required at runtime.";

const BUNDLE_FILES = [
  {
    id: "clip",
    env: "GLOFAS_CLIP_PATH",
    defaultPath: DEFAULT_CLIP_PATH,
    required: true,
    purpose: "Pre-downloaded Nassau clip GeoJSON (offline flood gap-fill)",
  },
  {
    id: "grid",
    env: "GLOFAS_GRID_PATH",
    defaultPath: path.join(geoRoot, "glofas-grid-nassau-demo.json"),
    required: false,
    purpose: "Optional discharge grid sidecar for bundle refresh worker",
  },
  {
    id: "cache",
    env: "GLOFAS_CDS_CACHE_PATH",
    defaultPath: path.join(geoRoot, "glofas-cds-cache.json"),
    required: false,
    purpose: "Last fetch metadata — stale warning without outbound call",
  },
  {
    id: "validation_catalog",
    env: "GLOFAS_VALIDATION_CATALOG_PATH",
    defaultPath: path.join(geoRoot, "glofas-validation-catalog.json"),
    required: false,
    purpose: "Alma/Dorian validation spike catalog for offline review",
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

export function getGlofasAirGapConfig() {
  const clipPath = process.env.GLOFAS_CLIP_PATH || DEFAULT_CLIP_PATH;
  const airGap = String(process.env.GLOFAS_AIRGAP ?? "").toLowerCase() === "true";
  const live = String(process.env.GLOFAS_LIVE ?? "").toLowerCase() === "true";
  return {
    enabled: isGlofasEnabled(),
    airGap,
    live,
    clipPath,
    demoFallback: String(process.env.GLOFAS_DEMO ?? "true").toLowerCase() !== "false",
    docs: "docs/sovereign-deploy.md#glofas-air-gap-bundle",
  };
}

export function buildGlofasAirGapProfile() {
  const cfg = getGlofasAirGapConfig();
  const bundle = BUNDLE_FILES.map((item) => {
    const filePath =
      item.env === "GLOFAS_CLIP_PATH"
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
    phase: "phase-3-day-10",
    profile: "glofas_airgap_bundle",
    enabled: cfg.enabled,
    clipReady: Boolean(clip?.ok),
    clipPath: clip?.path || cfg.clipPath,
    clipFeatureCount: clip?.featureCount ?? null,
    clipModifiedAt: clip?.modifiedAt ?? null,
    fetchPolicy: cfg.live ? "live_cds_optional" : "offline_clip_only",
    airGapMode: cfg.airGap || (!cfg.live && clip?.ok),
    bundleFiles: bundle,
    bundleFileCount: bundle.filter((b) => b.ok).length,
    optionalBundleCount: optionalPresent,
    recommendedEnv: {
      GLOFAS_ENABLED: "true",
      GLOFAS_AIRGAP: "true",
      GLOFAS_LIVE: "false",
      GLOFAS_DEMO: "false",
      GLOFAS_CLIP_PATH: "data/geo/glofas-nassau-latest.json",
    },
    refreshWorker: "docs/glofas-sovereign-cron.md",
    scopeGuard: GLOFAS_AIRGAP_SCOPE_GUARD,
    docs: cfg.docs,
  };
}

/** Pipeline step — verify pre-downloaded clip bundle on sovereign edge. */
export function buildGlofasAirGapPipelineStep() {
  if (!isGlofasEnabled()) return null;
  const profile = buildGlofasAirGapProfile();
  return {
    ok: profile.ok,
    step: "glofas_airgap_sync",
    phase: "phase-3-day-10",
    ...profile,
    airGapBadgeLabel: profile.clipReady
      ? `air-gap clip · ${profile.clipFeatureCount ?? "?"} feature(s)`
      : "air-gap clip missing",
    syncAt: new Date().toISOString(),
  };
}
