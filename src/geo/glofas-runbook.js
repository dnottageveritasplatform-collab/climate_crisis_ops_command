/** Phase 3 Day 10 — GloFAS pilot runbook + scope guard review (agency-first trust matrix). */

import { getGlofasFloodStatus, isGlofasEnabled } from "./glofas.js";
import { buildGlofasValidationSummary } from "./glofas-validation.js";
import { buildGlofasAirGapProfile } from "./glofas-sovereign.js";

export const GLOFAS_RUNBOOK_SCOPE_GUARD =
  "GloFAS pilot runbook — operator trust matrix for model gap-fill vs agency GIS; not hydrology authority.";

export const GLOFAS_SCOPE_GUARDS = [
  "GloFAS gap-fill is model guidance — not Water & Sewerage / NEMA hydrology authority.",
  "Agency flood GIS wins on corridor overlap — GloFAS fills silent corridors only.",
  "Never auto-close corridors or auto-send COMMS from model_estimated zones alone.",
  "Extended HITL remains mandatory before outbound messaging.",
  "Urban pluvial / street ponding may require agency GIS or Phase 3b commercial layer.",
  "0.05° GloFAS grid is credible for river/network flooding — not inch-perfect street depth.",
];

export const GLOFAS_TRUST_RULES = [
  {
    id: "agency_fresh",
    situation: "Agency flood GIS fresh on corridor",
    trust: "agency_confirmed",
    operatorAction: "Prefer agency depth/inches; use GloFAS only where agency layer is silent.",
    autoBlocked: ["corridor_auto_close", "comms_auto_send"],
  },
  {
    id: "agency_stale_or_empty",
    situation: "Agency GIS stale, empty, or webhook down",
    trust: "model_estimated_gap_fill",
    operatorAction: "Use dashed GloFAS zones with model label; verify with field/EOC before hard restrictions.",
    autoBlocked: ["comms_auto_send"],
  },
  {
    id: "ewds_stale",
    situation: "GloFAS EWDS fetch older than stale threshold",
    trust: "wait_for_agency",
    operatorAction: "Prefer agency webhook; treat cached GloFAS clip as stale guidance until refresh completes.",
    autoBlocked: ["corridor_auto_close", "comms_auto_send"],
  },
  {
    id: "urban_pluvial",
    situation: "Urban pluvial / street ponding (Bay Street, cul-de-sacs)",
    trust: "agency_or_commercial",
    operatorAction: "Do not trust coarse GloFAS alone — wait for agency GIS or Phase 3b commercial urban layer.",
    autoBlocked: ["corridor_auto_close", "comms_auto_send"],
  },
  {
    id: "validation_urban_caveat",
    situation: "Validation gate continue_glofas_urban_caveat",
    trust: "model_with_caveat",
    operatorAction: "Continue network/river gap-fill; flag urban corridors for optional commercial review.",
    autoBlocked: ["comms_auto_send"],
  },
  {
    id: "airgap_offline",
    situation: "Sovereign air-gap edge (offline clip only)",
    trust: "offline_clip_only",
    operatorAction: "Use pre-downloaded glofas-nassau-latest.json; refresh on connected LAN worker only.",
    autoBlocked: ["cds_outbound", "comms_auto_send"],
  },
];

function deriveCurrentPosture({ flood, validation, airGap, level = 2 } = {}) {
  const activeRules = [];
  if (airGap?.airGapMode && airGap?.clipReady) activeRules.push("airgap_offline");
  if (flood?.staleWarning) activeRules.push("ewds_stale");
  if (validation?.decisionGate?.verdict === "continue_glofas_urban_caveat") {
    activeRules.push("validation_urban_caveat");
    activeRules.push("urban_pluvial");
  }
  if (flood?.agencyZoneCount > 0 && !flood?.staleWarning) activeRules.push("agency_fresh");
  if (!flood?.agencyZoneCount || flood?.staleWarning) activeRules.push("agency_stale_or_empty");
  if (!activeRules.length) activeRules.push("agency_stale_or_empty");

  const primaryRuleId = activeRules.includes("ewds_stale")
    ? "ewds_stale"
    : activeRules.includes("airgap_offline")
      ? "airgap_offline"
      : activeRules.includes("urban_pluvial")
        ? "urban_pluvial"
        : activeRules.includes("agency_fresh")
          ? "agency_fresh"
          : "agency_stale_or_empty";

  const primaryRule = GLOFAS_TRUST_RULES.find((r) => r.id === primaryRuleId) || GLOFAS_TRUST_RULES[1];

  return {
    level,
    primaryRuleId,
    primaryTrust: primaryRule.trust,
    activeRuleIds: [...new Set(activeRules)],
    headline: `Trust ${primaryRule.trust.replace(/_/g, " ")} — ${primaryRule.operatorAction.split(";")[0]}`,
    agencyFirst: primaryRuleId === "agency_fresh" || primaryRuleId === "ewds_stale",
    hitlRequired: true,
    autoActionsBlocked: [...new Set(GLOFAS_TRUST_RULES.flatMap((r) => r.autoBlocked))],
  };
}

export function buildGlofasRunbookSummary(level = 2) {
  const flood = isGlofasEnabled() ? getGlofasFloodStatus(level) : null;
  const validation = isGlofasEnabled() ? buildGlofasValidationSummary() : null;
  const airGap = isGlofasEnabled() ? buildGlofasAirGapProfile() : null;
  const posture = deriveCurrentPosture({ flood, validation, airGap, level });

  return {
    ok: isGlofasEnabled() ? true : true,
    phase: "phase-3-day-10",
    step: "glofas_runbook_sync",
    profile: "glofas_pilot_runbook",
    enabled: isGlofasEnabled(),
    ruleCount: GLOFAS_TRUST_RULES.length,
    scopeGuardCount: GLOFAS_SCOPE_GUARDS.length,
    trustRules: GLOFAS_TRUST_RULES,
    scopeGuards: GLOFAS_SCOPE_GUARDS,
    scopeGuardReview: {
      headline: "Gap-fill not replacement hydrology",
      verdict: "agency_first_model_gap_fill",
      bullets: GLOFAS_SCOPE_GUARDS,
      defensibilityLine:
        "CCOC defensibility on GloFAS is honest labeling + agency-wins merge + HITL — not claiming Copernicus replaces Bahamian field hydrology.",
    },
    validationVerdict: validation?.decisionGate?.verdict || null,
    fetchPolicy: airGap?.fetchPolicy || flood?.fetchMode || null,
    currentPosture: posture,
    operatorChecklist: [
      "Confirm agency flood webhook status before trusting model zones.",
      "Check map badge: agency solid vs GloFAS dashed model zones.",
      "Review Monitor GloFAS sync state (cache-only / stale / L2 refresh).",
      "Do not approve COMMS from model_estimated zones without field/EOC confirmation.",
      "On sovereign edge: verify pre-downloaded clip age via air-gap profile.",
    ],
    docs: "docs/glofas-pilot-runbook.md",
    scopeGuard: GLOFAS_RUNBOOK_SCOPE_GUARD,
  };
}

/** Monitor tool + compact status. */
export function getGlofasRunbookStatus(level = 2) {
  const summary = buildGlofasRunbookSummary(level);
  return {
    ok: summary.enabled,
    phase: summary.phase,
    enabled: summary.enabled,
    ruleCount: summary.ruleCount,
    primaryTrust: summary.currentPosture.primaryTrust,
    primaryRuleId: summary.currentPosture.primaryRuleId,
    agencyFirst: summary.currentPosture.agencyFirst,
    validationVerdict: summary.validationVerdict,
    scopeGuardHeadline: summary.scopeGuardReview.headline,
    runbookBadgeLabel: summary.enabled
      ? `agency-first-${summary.ruleCount}rules-${summary.currentPosture.primaryTrust.replace(/_/g, "-")}`
      : "glofas disabled",
    summary: summary.enabled
      ? `GloFAS runbook — ${summary.currentPosture.primaryTrust.replace(/_/g, " ")} · ${summary.ruleCount} trust rules`
      : "Set GLOFAS_ENABLED=true for pilot runbook",
    docs: summary.docs,
    scopeGuard: summary.scopeGuard,
  };
}

/** Pipeline step — operator runbook + scope guard review on every GloFAS-enabled run. */
export function buildGlofasRunbookPipelineStep(level = 2) {
  if (!isGlofasEnabled()) return null;
  const summary = buildGlofasRunbookSummary(level);
  const status = getGlofasRunbookStatus(level);
  return {
    ...summary,
    syncAt: new Date().toISOString(),
    runbookBadgeLabel: status.runbookBadgeLabel,
    scopeGuardBadgeLabel: summary.scopeGuardReview.headline.replace(/\s+/g, "-").toLowerCase(),
  };
}
