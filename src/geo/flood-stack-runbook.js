/** Phase 3b Day 10 — three-layer flood stack runbook (agency · GloFAS · commercial urban). */

import { getGlofasFloodStatus, isGlofasEnabled } from "./glofas.js";
import { getUrbanFloodStatus, isUrbanFloodEnabled } from "./urban-flood.js";
import { buildGlofasValidationSummary } from "./glofas-validation.js";
import { buildUrbanFloodValidationSummary } from "./urban-flood-validation.js";
import { buildGlofasAirGapProfile } from "./glofas-sovereign.js";
import { buildUrbanFloodAirGapProfile } from "./urban-flood-sovereign.js";
import { GLOFAS_TRUST_RULES, GLOFAS_SCOPE_GUARDS } from "./glofas-runbook.js";

export const FLOOD_STACK_RUNBOOK_SCOPE_GUARD =
  "Flood stack runbook — operator trust matrix for agency · GloFAS · commercial urban layers; not hydrology authority.";

export const FLOOD_STACK_COMMERCIAL_RULES = [
  {
    id: "commercial_urban_acceptable",
    situation: "Urban validation gate urban_layer_acceptable (Dorian FLOOD-04 demo)",
    trust: "commercial_model_gap_fill",
    operatorAction:
      "Three-way merge active — agency wins overlap; dotted violet commercial fills urban pluvial gaps GloFAS misses.",
    autoBlocked: ["corridor_auto_close", "comms_auto_send"],
  },
  {
    id: "commercial_stay_agency_only",
    situation: "Urban validation stay_agency_only OR vendor feed stale beyond threshold",
    trust: "agency_only_urban",
    operatorAction:
      "Suppress commercial urban merge; prefer agency GIS until vendor clip improves or L2+ refresh completes.",
    autoBlocked: ["corridor_auto_close", "comms_auto_send"],
  },
];

export const FLOOD_STACK_TRUST_RULES = [...GLOFAS_TRUST_RULES, ...FLOOD_STACK_COMMERCIAL_RULES];

export const FLOOD_STACK_SCOPE_GUARDS = [
  ...GLOFAS_SCOPE_GUARDS,
  "Commercial urban flood is licensed model guidance — not Water & Sewerage / NEMA hydrology authority.",
  "Three-way merge order: agency → commercial urban → GloFAS — each layer honestly labeled on map + audit.",
];

function stackEnabled() {
  return isGlofasEnabled() || isUrbanFloodEnabled();
}

function deriveCurrentPosture({
  flood,
  urban,
  glofasValidation,
  urbanValidation,
  glofasAirGap,
  urbanAirGap,
  level = 2,
} = {}) {
  const activeRules = [];

  if (urbanAirGap?.airGapMode && urbanAirGap?.clipReady) activeRules.push("airgap_offline");
  if (glofasAirGap?.airGapMode && glofasAirGap?.clipReady) activeRules.push("airgap_offline");
  if (urban?.staleWarning) activeRules.push("commercial_stay_agency_only");
  if (urbanValidation?.decisionGate?.verdict === "stay_agency_only") {
    activeRules.push("commercial_stay_agency_only");
  }
  if (urbanValidation?.decisionGate?.verdict === "urban_layer_acceptable") {
    activeRules.push("commercial_urban_acceptable");
  }
  if (flood?.staleWarning) activeRules.push("ewds_stale");
  if (glofasValidation?.decisionGate?.verdict === "continue_glofas_urban_caveat") {
    activeRules.push("validation_urban_caveat");
    activeRules.push("urban_pluvial");
  }
  if (urban?.enabled || glofasValidation?.decisionGate?.verdict === "continue_glofas_urban_caveat") {
    activeRules.push("urban_pluvial");
  }
  if (flood?.agencyZoneCount > 0 && !flood?.staleWarning) activeRules.push("agency_fresh");
  if (!flood?.agencyZoneCount || flood?.staleWarning) activeRules.push("agency_stale_or_empty");
  if (!activeRules.length) activeRules.push("agency_stale_or_empty");

  const primaryRuleId = activeRules.includes("commercial_stay_agency_only")
    ? "commercial_stay_agency_only"
    : activeRules.includes("ewds_stale")
      ? "ewds_stale"
      : activeRules.includes("airgap_offline")
        ? "airgap_offline"
        : activeRules.includes("commercial_urban_acceptable")
          ? "commercial_urban_acceptable"
          : activeRules.includes("urban_pluvial")
            ? "urban_pluvial"
            : activeRules.includes("agency_fresh")
              ? "agency_fresh"
              : "agency_stale_or_empty";

  const primaryRule =
    FLOOD_STACK_TRUST_RULES.find((r) => r.id === primaryRuleId) || FLOOD_STACK_TRUST_RULES[1];

  return {
    level,
    primaryRuleId,
    primaryTrust: primaryRule.trust,
    activeRuleIds: [...new Set(activeRules)],
    headline: `Trust ${primaryRule.trust.replace(/_/g, " ")} — ${primaryRule.operatorAction.split(";")[0]}`,
    agencyFirst:
      primaryRuleId === "agency_fresh" ||
      primaryRuleId === "ewds_stale" ||
      primaryRuleId === "commercial_stay_agency_only",
    threeLayerMerge: Boolean(urban?.enabled && flood?.enabled),
    hitlRequired: true,
    autoActionsBlocked: [...new Set(FLOOD_STACK_TRUST_RULES.flatMap((r) => r.autoBlocked))],
  };
}

export function buildFloodStackRunbookSummary(level = 2) {
  const flood = isGlofasEnabled() ? getGlofasFloodStatus(level) : null;
  const urban = isUrbanFloodEnabled() ? getUrbanFloodStatus(level) : null;
  const glofasValidation = isGlofasEnabled() ? buildGlofasValidationSummary() : null;
  const urbanValidation = isUrbanFloodEnabled() ? buildUrbanFloodValidationSummary() : null;
  const glofasAirGap = isGlofasEnabled() ? buildGlofasAirGapProfile() : null;
  const urbanAirGap = isUrbanFloodEnabled() ? buildUrbanFloodAirGapProfile() : null;
  const posture = deriveCurrentPosture({
    flood,
    urban,
    glofasValidation,
    urbanValidation,
    glofasAirGap,
    urbanAirGap,
    level,
  });

  return {
    ok: true,
    phase: "phase-3b-day-10",
    step: "flood_stack_runbook_sync",
    profile: "flood_stack_runbook",
    enabled: stackEnabled(),
    glofasEnabled: isGlofasEnabled(),
    urbanEnabled: isUrbanFloodEnabled(),
    ruleCount: FLOOD_STACK_TRUST_RULES.length,
    scopeGuardCount: FLOOD_STACK_SCOPE_GUARDS.length,
    trustRules: FLOOD_STACK_TRUST_RULES,
    scopeGuards: FLOOD_STACK_SCOPE_GUARDS,
    scopeGuardReview: {
      headline: "Three-layer honest stack — gap-fill not replacement hydrology",
      verdict: "agency_first_three_layer_merge",
      bullets: FLOOD_STACK_SCOPE_GUARDS,
      defensibilityLine:
        "CCOC defensibility on the flood stack is honest labeling + agency-wins merge + commercial urban only where validated + HITL — not claiming Copernicus or Fathom replaces Bahamian field hydrology.",
    },
    glofasValidationVerdict: glofasValidation?.decisionGate?.verdict || null,
    urbanValidationVerdict: urbanValidation?.decisionGate?.verdict || null,
    floodBadgeLabel: urban?.floodBadgeLabel || flood?.floodBadgeLabel || null,
    fetchPolicy: urbanAirGap?.fetchPolicy || glofasAirGap?.fetchPolicy || urban?.fetchMode || flood?.fetchMode || null,
    currentPosture: posture,
    operatorChecklist: [
      "Confirm agency flood webhook status before trusting model or commercial zones.",
      "Read map flood stack badge: agency solid · GloFAS dashed · commercial dotted violet.",
      "Check Monitor urban + GloFAS sync (cache-only / stale / L2 escalation refresh).",
      "Review pipeline audit: validation · air-gap · flood_stack_runbook chips.",
      "Do not approve COMMS from commercial_model or model_estimated zones without EOC confirmation.",
      "On sovereign edge: verify glofas + urban clip age via air-gap profiles.",
    ],
    docs: "docs/flood-stack-runbook.md",
    inherits: "docs/glofas-pilot-runbook.md",
    scopeGuard: FLOOD_STACK_RUNBOOK_SCOPE_GUARD,
  };
}

export function getFloodStackRunbookStatus(level = 2) {
  const summary = buildFloodStackRunbookSummary(level);
  return {
    ok: summary.enabled,
    phase: summary.phase,
    enabled: summary.enabled,
    ruleCount: summary.ruleCount,
    primaryTrust: summary.currentPosture.primaryTrust,
    primaryRuleId: summary.currentPosture.primaryRuleId,
    agencyFirst: summary.currentPosture.agencyFirst,
    threeLayerMerge: summary.currentPosture.threeLayerMerge,
    glofasValidationVerdict: summary.glofasValidationVerdict,
    urbanValidationVerdict: summary.urbanValidationVerdict,
    floodBadgeLabel: summary.floodBadgeLabel,
    scopeGuardHeadline: summary.scopeGuardReview.headline,
    runbookBadgeLabel: summary.enabled
      ? `three-layer-${summary.ruleCount}rules-${summary.currentPosture.primaryTrust.replace(/_/g, "-")}`
      : "flood-stack disabled",
    summary: summary.enabled
      ? `Flood stack runbook — ${summary.currentPosture.primaryTrust.replace(/_/g, " ")} · ${summary.ruleCount} trust rules`
      : "Set GLOFAS_ENABLED or URBAN_FLOOD_ENABLED for flood stack runbook",
    docs: summary.docs,
    scopeGuard: summary.scopeGuard,
  };
}

export function buildFloodStackRunbookPipelineStep(level = 2) {
  if (!stackEnabled()) return null;
  const summary = buildFloodStackRunbookSummary(level);
  const status = getFloodStackRunbookStatus(level);
  return {
    ...summary,
    syncAt: new Date().toISOString(),
    runbookBadgeLabel: status.runbookBadgeLabel,
    scopeGuardBadgeLabel: summary.scopeGuardReview.headline.replace(/\s+/g, "-").toLowerCase(),
  };
}
