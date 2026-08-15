/** Phase 2 Day 15 — sovereign / on-prem deploy profile for Caribbean operators. */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { getAuditPersistStatus } from "../audit/store.js";
import { buildDeployChecklist } from "./index.js";
import { buildGlofasAirGapProfile } from "../geo/glofas-sovereign.js";
import { buildUrbanFloodAirGapProfile } from "../geo/urban-flood-sovereign.js";

export const SOVEREIGN_SCOPE_GUARD =
  "Sovereign on-prem deploy profile — operator-controlled data residency; not multi-tenant cloud SaaS or 911 dispatch authority.";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function fileExists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function envFlag(name, { preferTruthy = true } = {}) {
  const raw = process.env[name];
  if (raw == null || raw === "") return null;
  const val = String(raw).toLowerCase();
  if (["true", "1", "yes"].includes(val)) return true;
  if (["false", "0", "no"].includes(val)) return false;
  return preferTruthy ? Boolean(raw) : raw;
}

/** Readiness checks for air-gapped / on-prem operator deployment. */
export function buildSovereignDeployProfile({ baseUrl } = {}) {
  const staging = buildDeployChecklist(baseUrl);
  const auditPersist = getAuditPersistStatus();
  const glofasAirGap = buildGlofasAirGapProfile();
  const urbanFloodAirGap = buildUrbanFloodAirGapProfile();

  const checks = [
    {
      name: "dockerfile",
      ok: fileExists("Dockerfile"),
      detail: "Container image for edge VM or hospital NOC host",
    },
    {
      name: "sovereign_env_example",
      ok: fileExists(".env.sovereign.example"),
      detail: ".env.sovereign.example — no external LLM keys required",
    },
    {
      name: "sovereign_compose",
      ok: fileExists("docker-compose.sovereign.yml"),
      detail: "docker-compose.sovereign.yml — single-host on-prem stack",
    },
    {
      name: "sovereign_guide",
      ok: fileExists("docs/sovereign-deploy.md"),
      detail: "docs/sovereign-deploy.md — Caribbean data residency runbook",
    },
    {
      name: "local_sop_corpus",
      ok: fileExists("docs/sops"),
      detail: "Operator SOP corpus stays on-prem (keyword + hybrid RAG, no vector DB)",
    },
    {
      name: "audit_persist_local",
      ok: auditPersist.enabled !== false,
      detail: auditPersist.storePath || "data/audit-trail.jsonl append-only",
    },
    {
      name: "demo_mode_airgap",
      ok: true,
      recommended: config.demoMode,
      detail: config.demoMode
        ? "DEMO_MODE=true — zero external LLM calls (recommended for sovereign pilot)"
        : "DEMO_MODE=false — outbound LLM API; set true for air-gapped edge",
    },
    {
      name: "staging_baseline",
      ok: staging.ok,
      detail: staging.summary,
    },
    {
      name: "glofas_airgap_clip",
      ok: !glofasAirGap.enabled || glofasAirGap.clipReady,
      recommended: glofasAirGap.enabled,
      detail: glofasAirGap.enabled
        ? glofasAirGap.clipReady
          ? `${glofasAirGap.clipPath} · ${glofasAirGap.clipFeatureCount ?? "?"} feature(s) offline`
          : "Pre-download glofas-nassau-latest.json for air-gap edge — see docs/sovereign-deploy.md"
        : "Set GLOFAS_ENABLED=true to require offline clip bundle",
    },
    {
      name: "urban_flood_airgap_clip",
      ok: !urbanFloodAirGap.enabled || urbanFloodAirGap.clipReady,
      recommended: urbanFloodAirGap.enabled,
      detail: urbanFloodAirGap.enabled
        ? urbanFloodAirGap.clipReady
          ? `${urbanFloodAirGap.clipPath} · ${urbanFloodAirGap.clipFeatureCount ?? "?"} feature(s) offline`
          : "Pre-download urban-flood-nassau-latest.json for air-gap edge — see docs/sovereign-deploy.md"
        : "Set URBAN_FLOOD_ENABLED=true to require offline urban clip bundle",
    },
  ];

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => c.ok === false);

  const nhcLive = envFlag("NHC_LIVE");
  const dataResidency = {
    dispatchManifest: "data/sample-dispatch (synthetic — replace with operator feed on pilot)",
    auditTrail: auditPersist.storePath || "data/audit-trail.jsonl",
    sopCorpus: "docs/sops/*.txt (local filesystem)",
    geoLayers: "data/geo/*.json (agency GIS ingest via webhook)",
    glofasClip: glofasAirGap.enabled
      ? glofasAirGap.clipReady
        ? `${glofasAirGap.clipPath} (${glofasAirGap.clipFeatureCount ?? "?"} features · offline)`
        : "missing — pre-download glofas-nassau-latest.json"
      : "disabled (GLOFAS_ENABLED=false)",
    urbanFloodClip: urbanFloodAirGap.enabled
      ? urbanFloodAirGap.clipReady
        ? `${urbanFloodAirGap.clipPath} (${urbanFloodAirGap.clipFeatureCount ?? "?"} features · offline)`
        : "missing — pre-download urban-flood-nassau-latest.json"
      : "disabled (URBAN_FLOOD_ENABLED=false)",
    llmCalls: config.demoMode ? "none (demo mode)" : "optional outbound — disable for air-gap",
    nhcFeed: nhcLive === false ? "disabled (demo signals)" : "optional outbound weather XML",
  };

  return {
    ok: failed.length === 0,
    phase: "phase-3b-day-9",
    profile: "sovereign_on_prem",
    headline: "Sovereign on-prem deploy — Caribbean operator data residency",
    regionNote: "New Providence pilot · extensible to Bahamas/Caribbean operator-controlled VM or edge appliance",
    dataResidency,
    glofasAirGap: glofasAirGap.enabled
      ? {
          clipReady: glofasAirGap.clipReady,
          clipPath: glofasAirGap.clipPath,
          clipFeatureCount: glofasAirGap.clipFeatureCount,
          fetchPolicy: glofasAirGap.fetchPolicy,
          bundleFileCount: glofasAirGap.bundleFileCount,
          recommendedEnv: glofasAirGap.recommendedEnv,
        }
      : null,
    urbanFloodAirGap: urbanFloodAirGap.enabled
      ? {
          clipReady: urbanFloodAirGap.clipReady,
          clipPath: urbanFloodAirGap.clipPath,
          clipFeatureCount: urbanFloodAirGap.clipFeatureCount,
          fetchPolicy: urbanFloodAirGap.fetchPolicy,
          bundleFileCount: urbanFloodAirGap.bundleFileCount,
          recommendedEnv: urbanFloodAirGap.recommendedEnv,
        }
      : null,
    deploymentOptions: [
      {
        id: "docker-edge",
        label: "Docker on operator edge VM",
        command: "docker build -t ccoc:sovereign . && docker run --rm -p 8787:8787 --env-file .env.sovereign.example ccoc:sovereign",
        bestFor: "Hospital NOC or NEMT dispatch center single host",
      },
      {
        id: "docker-compose",
        label: "Docker Compose (persistent audit volume)",
        command: "docker compose -f docker-compose.sovereign.yml up --build",
        bestFor: "Pilot with local audit JSONL retention on mounted data/",
      },
      {
        id: "nebius-sovereign",
        label: "Nebius VM in operator-selected region",
        command: "Same container · operator owns VM + disk · no GPU required",
        bestFor: "Future Caribbean track — sovereign cloud VM when business email approved",
      },
    ],
    recommendedEnv: {
      DEMO_MODE: "true",
      AUDIT_PERSIST: "true",
      NHC_LIVE: "false",
      GLOFAS_ENABLED: "true",
      GLOFAS_AIRGAP: "true",
      GLOFAS_LIVE: "false",
      GLOFAS_DEMO: "false",
      GLOFAS_CLIP_PATH: "data/geo/glofas-nassau-latest.json",
      URBAN_FLOOD_ENABLED: "true",
      URBAN_FLOOD_AIRGAP: "true",
      URBAN_FLOOD_LIVE: "false",
      URBAN_FLOOD_DEMO: "false",
      URBAN_FLOOD_CLIP_PATH: "data/geo/urban-flood-nassau-latest.json",
      PORT: "8787",
      NODE_ENV: "production",
    },
    checks,
    summary: `${passed}/${checks.length} sovereign deploy checks passed`,
    failedCount: failed.length,
    scopeGuard: SOVEREIGN_SCOPE_GUARD,
    docs: {
      sovereign: "docs/sovereign-deploy.md",
      staging: "docs/staging-deploy.md",
    },
    api: {
      profile: "/api/deploy/sovereign",
      checklist: "/api/deploy/sovereign/checklist",
      staging: "/api/deploy/checklist",
    },
    smokeTest: {
      health: `${baseUrl || `http://127.0.0.1:${config.port}`}/api/health`,
      sovereign: `${baseUrl || `http://127.0.0.1:${config.port}`}/api/deploy/sovereign`,
      pipeline: `curl.exe -X POST ${baseUrl || `http://127.0.0.1:${config.port}`}/api/orchestrator/run`,
    },
  };
}

/** Compact status for Monitor agent tool + pipeline audit. */
export function getSovereignDeployStatus({ baseUrl } = {}) {
  const profile = buildSovereignDeployProfile({ baseUrl });
  return {
    ok: profile.ok,
    phase: "phase-3b-day-9",
    profile: profile.profile,
    checksPassed: profile.checks.filter((c) => c.ok).length,
    checksTotal: profile.checks.length,
    summary: profile.summary,
    demoMode: config.demoMode,
    auditPersistPath: profile.dataResidency.auditTrail,
    glofasClipReady: profile.glofasAirGap?.clipReady ?? null,
    glofasAirGapFetchPolicy: profile.glofasAirGap?.fetchPolicy ?? null,
    urbanClipReady: profile.urbanFloodAirGap?.clipReady ?? null,
    urbanAirGapFetchPolicy: profile.urbanFloodAirGap?.fetchPolicy ?? null,
    llmOutbound: profile.dataResidency.llmCalls,
    deploymentOptionCount: profile.deploymentOptions.length,
    scopeGuard: SOVEREIGN_SCOPE_GUARD,
  };
}
