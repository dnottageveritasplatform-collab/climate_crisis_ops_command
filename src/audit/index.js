import {
  appendPersistedAuditEntry,
  getAuditPersistStatus,
  loadPersistedAuditState,
} from "./store.js";

const boot = loadPersistedAuditState();
const entries = boot.entries.slice(0, 100);
let seq = boot.seq;
let lastPersistResult = null;

function mapCitations(citations) {
  if (!citations?.length) return [];
  return citations
    .map((c) =>
      typeof c === "string"
        ? { ref: c }
        : { ref: c.ref || c.sopId || "SOP", text: c.text?.slice(0, 120) }
    )
    .filter((c) => c.ref);
}

function uniqueCitationRefs(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const c of mapCitations(list)) {
      if (!seen.has(c.ref)) {
        seen.add(c.ref);
        out.push(c);
      }
    }
  }
  return out;
}

/**
 * Append-only audit trail — Week 2 Day 13+; Phase 2 Day 8 JSONL persistence.
 */
export function appendAuditEntry(entry) {
  const record = {
    id: `AUD-${String(++seq).padStart(4, "0")}`,
    ts: new Date().toISOString(),
    ...entry,
  };
  entries.unshift(record);
  const MAX = 100;
  if (entries.length > MAX) entries.length = MAX;
  lastPersistResult = appendPersistedAuditEntry(record);
  console.log(`[audit] ${record.type}`, record.summary || record.id);
  return record;
}

export { getAuditPersistStatus };

export function getLastAuditPersistResult() {
  return lastPersistResult;
}

export function getAuditLog(limit = 50) {
  return entries.slice(0, limit);
}

export function getLatestAuditEntry() {
  return entries[0] || null;
}

/** Structured audit trail for UI and demo export (Day 13). */
export function buildAuditTrail(limit = 15) {
  const log = getAuditLog(limit);
  const latestRelease = log.find((e) => e.type === "hitl_released") || null;
  const latestPipeline = log.find((e) => e.type === "pipeline_run") || null;

  return {
    ok: true,
    count: log.length,
    latest: log[0] || null,
    latestPipeline,
    latestRelease,
    entries: log.map((e) => ({
      id: e.id,
      ts: e.ts,
      type: e.type,
      summary: e.summary,
      agents: e.agents,
      steps: e.steps,
      citations: e.citations,
      cadCrossRef: e.cadCrossRef,
      handoffCrossRef: e.handoffCrossRef,
      publicSafetyCrossRef: e.publicSafetyCrossRef,
      enrichedDispatch: e.enrichedDispatch,
      esriCorridorSync: e.esriCorridorSync,
      shelterFleetCrossRef: e.shelterFleetCrossRef,
      signalMultiFeedSync: e.signalMultiFeedSync,
      sopCorpusSync: e.sopCorpusSync,
      routingPreviewSync: e.routingPreviewSync,
      floodHazardSync: e.floodHazardSync,
      glofasFloodSync: e.glofasFloodSync,
      urbanFloodSync: e.urbanFloodSync,
      windHazardSync: e.windHazardSync,
      multiHazardSync: e.multiHazardSync,
      sovereignDeploySync: e.sovereignDeploySync,
      roadNetworkSync: e.roadNetworkSync,
      demoRehearsalSync: e.demoRehearsalSync,
      defensibilitySync: e.defensibilitySync,
      approvers: e.approvers || normalizeApprovers(e.hitl?.approvers),
      hitl: e.hitl,
      mode: e.mode,
    })),
  };
}

function normalizeApprovers(approvers) {
  if (!approvers) return undefined;
  if (Array.isArray(approvers)) return approvers;
  return Object.entries(approvers).map(([role, name]) => ({
    role,
    name: typeof name === "string" ? name : name?.name,
    approvedAt: typeof name === "object" ? name?.approvedAt : undefined,
  }));
}

/** Record Monitor brief completion in the audit trail. */
export function recordMonitorBrief({ signal, brief, threshold, mode }) {
  const ts = new Date().toISOString();
  return appendAuditEntry({
    type: "monitor_brief",
    summary: `Level ${brief.level} ${brief.severity} brief generated`,
    signal: {
      level: signal?.level ?? threshold,
      label: signal?.label,
      event: signal?.event,
      institutionalCount: signal?.institutionalCount,
    },
    brief: {
      level: brief.level,
      severity: brief.severity,
      geography: brief.geography,
      citationCount: brief.sopCitations?.length ?? 0,
      atRiskTrips: brief.recommendedActions?.length ?? 0,
      confidence: brief.confidence?.score,
    },
    steps: [{ id: "monitor_brief", label: "Monitor brief", agent: "monitor", ts }],
    citations: mapCitations(brief.sopCitations),
    agents: ["monitor"],
    mode: mode || "demo",
  });
}

/** Record Triage rank completion in the audit trail. */
export function recordTriageRank({ signal, ranking, threshold, mode }) {
  const ts = new Date().toISOString();
  return appendAuditEntry({
    type: "triage_rank",
    summary: `Triage: ${ranking.rankedTrips.length} trips ranked · ${ranking.corridorConflicts.length} corridor conflicts`,
    signal: {
      level: signal?.level ?? threshold,
      label: signal?.label,
    },
    triage: {
      level: ranking.level,
      topTrip: ranking.rankedTrips[0]?.id,
      topFacility: ranking.rankedFacilities[0]?.name,
      corridorConflicts: ranking.corridorConflicts.length,
    },
    steps: [{ id: "triage_rank", label: "Triage rank", agent: "triage", ts }],
    agents: ["triage"],
    mode: mode || "demo",
  });
}

/** Record Action pack completion in the audit trail. */
export function recordActionPack({ signal, pack, threshold, mode }) {
  const ts = new Date().toISOString();
  return appendAuditEntry({
    type: "action_pack",
    summary: `Action pack: ${pack.checklist.length} checklist · ${pack.hospitalBulletins?.length ?? 1} COMMS-03 · ${pack.driverComms.length} driver SMS`,
    signal: {
      level: signal?.level ?? threshold,
      label: signal?.label,
    },
    action: {
      level: pack.level,
      checklistItems: pack.checklist.length,
      driverComms: pack.driverComms.length,
      bulletinSubject: pack.hospitalBulletin.subject,
      hospitalPartners: pack.hospitalPartners?.map((p) => p.name) ?? [],
      hitlRequired: pack.hitlRequired,
    },
    steps: [{ id: "action_pack", label: "Action pack staged", agent: "action", ts }],
    citations: mapCitations(pack.sopCitations),
    agents: ["action"],
    mode: mode || "demo",
  });
}

/** Record full agent pipeline (Monitor → Triage → Action + HITL gate). */
export function recordPipelineRun({
  signals,
  monitor,
  triage,
  action,
  hitl,
  threshold,
  mode,
  cadCrossRef,
  handoffCrossRef,
  publicSafetyCrossRef,
  enrichedDispatch,
  esriCorridorSync,
  shelterFleetCrossRef,
  signalMultiFeedSync,
  sopCorpusSync,
  routingPreviewSync,
  floodHazardSync,
  glofasFloodSync,
  urbanFloodSync,
  urbanFloodValidationSync,
  urbanFloodAirGapSync,
  glofasValidationSync,
  glofasAirGapSync,
  glofasRunbookSync,
  floodStackRunbookSync,
  windHazardSync,
  multiHazardSync,
  sovereignDeploySync,
  roadNetworkSync,
  demoRehearsalSync,
  defensibilitySync,
}) {
  const ts = new Date().toISOString();
  const cadNote = cadCrossRef?.matchedCount
    ? ` · CAD ${cadCrossRef.matchedCount}/${cadCrossRef.atRiskCount} cross-ref`
    : "";
  const handoffNote = handoffCrossRef?.matchedCount
    ? ` · handoff ${handoffCrossRef.matchedCount}/${handoffCrossRef.atRiskCount}`
    : "";
  const publicSafetyNote = publicSafetyCrossRef?.matchedCount
    ? ` · EOC ${publicSafetyCrossRef.matchedCount} unit(s) on restricted corridors`
    : "";
  const enrichNote = enrichedDispatch?.cadLinkedAtRisk
    ? ` · live CAD ${enrichedDispatch.cadLinkedAtRisk}/${enrichedDispatch.atRiskTrips} enriched`
    : "";
  const esriNote = esriCorridorSync?.source === "esri_feature_service"
    ? ` · ESRI ${esriCorridorSync.featureCount} corridor(s)`
    : "";
  const shelterFleetNote = shelterFleetCrossRef?.matchedCount
    ? ` · shelter/fleet ${shelterFleetCrossRef.matchedCount} on restricted corridors`
    : "";
  const signalFeedNote = signalMultiFeedSync?.corridorLinkedSignalCount
    ? ` · signals ${signalMultiFeedSync.corridorLinkedSignalCount} corridor-linked`
    : "";
  const sopNote = sopCorpusSync?.matchedSopCount
    ? ` · SOP ${sopCorpusSync.matchedSopCount} matched (${sopCorpusSync.mode})`
    : "";
  const routingNote = routingPreviewSync?.tripAdvisoryCount
    ? ` · routing ${routingPreviewSync.tripAdvisoryCount} trip advisory(ies)`
    : "";
  const floodNote = floodHazardSync?.tripExposureCount
    ? ` · flood ${floodHazardSync.tripExposureCount} trip(s) in hazard zones`
    : "";
  const glofasNote = glofasFloodSync?.fetchMode
    ? glofasFloodSync?.staleWarning
      ? ` · glofas_flood_sync · stale ${glofasFloodSync.staleHours}h · ${glofasFloodSync.fetchMode || "sync"}`
      : glofasFloodSync?.skippedRefresh || glofasFloodSync?.refreshed === false
        ? ` · glofas_flood_sync · cache_only · ${glofasFloodSync.fetchMode || "cache"}`
        : glofasFloodSync?.refreshPolicy === "escalation_refresh" || glofasFloodSync?.refreshed
          ? ` · glofas_flood_sync · escalation_refresh · ${glofasFloodSync.fetchMode || "sync"}`
          : glofasFloodSync?.cds?.ok
            ? ` · glofas_flood_sync · ${glofasFloodSync.fetchMode || "sync"}`
            : glofasFloodSync?.floodBadgeLabel
              ? ` · glofas_flood_sync · ${glofasFloodSync.floodBadgeLabel}`
              : glofasFloodSync?.cds?.reason === "missing_cds_key"
                ? " · glofas_flood_sync · demo (no CDS key)"
                : glofasFloodSync?.activeZoneCount
                  ? ` · glofas_flood_sync · ${glofasFloodSync.activeZoneCount} zone(s)`
                  : ""
    : "";
  const urbanNote = urbanFloodSync?.fetchMode
    ? urbanFloodSync?.staleWarning
      ? ` · urban_flood_sync · stale ${urbanFloodSync.staleHours}h · ${urbanFloodSync.fetchMode || "sync"}`
      : urbanFloodSync?.skippedRefresh || urbanFloodSync?.refreshed === false
        ? ` · urban_flood_sync · cache_only · ${urbanFloodSync.fetchMode || "cache"}`
        : urbanFloodSync?.refreshPolicy === "escalation_refresh" || urbanFloodSync?.refreshed
          ? ` · urban_flood_sync · escalation_refresh · ${urbanFloodSync.fetchMode || "sync"}`
          : urbanFloodSync?.vendor?.reason === "missing_api_key"
            ? " · urban_flood_sync · demo (no vendor key)"
            : urbanFloodSync?.activeZoneCount
              ? ` · urban_flood_sync · ${urbanFloodSync.activeZoneCount} zone(s)`
              : urbanFloodSync?.enabled === false
                ? " · urban_flood_sync · disabled"
                : ""
    : "";
  const urbanValidationNote = urbanFloodValidationSync?.decisionGate?.verdict
    ? ` · urban_flood_validation_sync · ${urbanFloodValidationSync.decisionGate.verdict.replace(/_/g, "-")}`
    : "";
  const glofasValidationNote = glofasValidationSync?.decisionGate?.verdict
    ? ` · glofas_validation_sync · ${glofasValidationSync.decisionGate.verdict.replace(/_/g, "-")}`
    : "";
  const urbanAirGapNote = urbanFloodAirGapSync?.clipReady
    ? ` · urban_flood_airgap_sync · ${urbanFloodAirGapSync.airGapBadgeLabel || "clip ready"}`
    : urbanFloodAirGapSync?.enabled
      ? " · urban_flood_airgap_sync · clip missing"
      : "";
  const glofasAirGapNote = glofasAirGapSync?.clipReady
    ? ` · glofas_airgap_sync · ${glofasAirGapSync.airGapBadgeLabel || "clip ready"}`
    : glofasAirGapSync?.enabled
      ? " · glofas_airgap_sync · clip missing"
      : "";
  const glofasRunbookNote = glofasRunbookSync?.runbookBadgeLabel
    ? ` · glofas_runbook_sync · ${glofasRunbookSync.runbookBadgeLabel}`
    : glofasRunbookSync?.step
      ? " · glofas_runbook_sync · scope-guard-review"
      : "";
  const floodStackRunbookNote = floodStackRunbookSync?.runbookBadgeLabel
    ? ` · flood_stack_runbook_sync · ${floodStackRunbookSync.runbookBadgeLabel}`
    : floodStackRunbookSync?.step
      ? " · flood_stack_runbook_sync · scope-guard-review"
      : "";
  const windNote = windHazardSync?.tripExposureCount
    ? ` · wind ${windHazardSync.tripExposureCount} trip(s) in gust zones`
    : "";
  const multiNote = multiHazardSync?.fusedTripCount
    ? ` · fused ${multiHazardSync.fusedTripCount} trip briefing(s) (${multiHazardSync.criticalTripCount} critical)`
    : "";
  const sovereignNote = sovereignDeploySync?.ok
    ? ` · sovereign ${sovereignDeploySync.checksPassed}/${sovereignDeploySync.checksTotal} deploy checks`
    : sovereignDeploySync
      ? ` · sovereign deploy ${sovereignDeploySync.checksPassed}/${sovereignDeploySync.checksTotal} checks`
      : "";
  const roadNetworkNote = roadNetworkSync?.avoidanceRouteCount
    ? ` · road network ${roadNetworkSync.avoidanceRouteCount} avoidance route(s)`
    : "";
  const rehearsalNote = demoRehearsalSync?.evalPassed != null
    ? ` · rehearsal ${demoRehearsalSync.evalPassed}/${demoRehearsalSync.evalTotal} eval · ${demoRehearsalSync.beatCount} beats`
    : demoRehearsalSync?.beatCount
      ? ` · rehearsal ${demoRehearsalSync.beatCount} beats`
      : "";
  const defensibilityNote = defensibilitySync?.pillarCount
    ? ` · defensibility ${defensibilitySync.pillarCount} pillars · Phase 2 ${defensibilitySync.phase2DaysDelivered}d`
    : "";
  const hitlModeNote = hitl?.extendedHitl ? " · extended HITL (5)" : "";
  return appendAuditEntry({
    type: "pipeline_run",
    summary: `Pipeline L${threshold}: brief → ${triage.ranking?.rankedTrips?.length ?? 0} ranked → action pack · HITL ${hitl?.active ? hitl.state : "idle"}${hitlModeNote}${cadNote}${handoffNote}${publicSafetyNote}${enrichNote}${esriNote}${shelterFleetNote}${signalFeedNote}${sopNote}${routingNote}${floodNote}${glofasNote}${urbanNote}${urbanValidationNote}${urbanAirGapNote}${glofasValidationNote}${glofasAirGapNote}${glofasRunbookNote}${floodStackRunbookNote}${windNote}${multiNote}${sovereignNote}${roadNetworkNote}${rehearsalNote}${defensibilityNote}`,
    signal: {
      level: threshold,
      label: signals?.label,
      event: signals?.event,
    },
    pipeline: {
      threshold,
      briefSeverity: monitor.brief?.severity,
      rankedTrips: triage.ranking?.rankedTrips?.length ?? 0,
      corridorConflicts: triage.ranking?.corridorConflicts?.length ?? 0,
      checklistItems: action.pack?.checklist?.length ?? 0,
      hospitalPartners: action.pack?.hospitalPartners?.map((p) => p.name) ?? [],
      hitlGateId: hitl?.id,
      hitlRequired: action.pack?.hitlRequired ?? true,
      extendedHitl: hitl?.extendedHitl ?? action.pack?.extendedHitlRequired ?? false,
      hitlRoles: hitl?.roles ? Object.keys(hitl.roles) : [],
      cadCrossRef: cadCrossRef
        ? {
            matchedCount: cadCrossRef.matchedCount,
            atRiskCount: cadCrossRef.atRiskCount,
            matches: cadCrossRef.matches?.slice(0, 6),
          }
        : undefined,
      handoffCrossRef: handoffCrossRef
        ? {
            matchedCount: handoffCrossRef.matchedCount,
            atRiskCount: handoffCrossRef.atRiskCount,
            pendingQueueCount: handoffCrossRef.pendingQueueCount,
            matches: handoffCrossRef.matches?.slice(0, 6),
          }
        : undefined,
      publicSafetyCrossRef: publicSafetyCrossRef
        ? {
            matchedCount: publicSafetyCrossRef.matchedCount,
            unitCount: publicSafetyCrossRef.unitCount,
            matches: publicSafetyCrossRef.matches?.slice(0, 6),
          }
        : undefined,
      enrichedDispatch: enrichedDispatch
        ? {
            cadLinkedAtRisk: enrichedDispatch.cadLinkedAtRisk,
            atRiskTrips: enrichedDispatch.atRiskTrips,
            nemtAssignedAtRisk: enrichedDispatch.nemtAssignedAtRisk,
            liveUnitStatusCounts: enrichedDispatch.liveUnitStatusCounts,
          }
        : undefined,
      esriCorridorSync: esriCorridorSync
        ? {
            source: esriCorridorSync.source,
            adapter: esriCorridorSync.adapter,
            featureCount: esriCorridorSync.featureCount,
            corridorStatus: esriCorridorSync.corridorStatus,
          }
        : undefined,
      shelterFleetCrossRef: shelterFleetCrossRef
        ? {
            matchedCount: shelterFleetCrossRef.matchedCount,
            matchedShelterCount: shelterFleetCrossRef.matchedShelterCount,
            matchedFleetCount: shelterFleetCrossRef.matchedFleetCount,
            atRiskOnRestrictedCount: shelterFleetCrossRef.atRiskOnRestrictedCount,
          }
        : undefined,
      signalMultiFeedSync: signalMultiFeedSync
        ? {
            institutionalCount: signalMultiFeedSync.institutionalCount,
            corridorLinkedSignalCount: signalMultiFeedSync.corridorLinkedSignalCount,
            matches: signalMultiFeedSync.matches?.slice(0, 4),
          }
        : undefined,
      sopCorpusSync: sopCorpusSync
        ? {
            matchedSopCount: sopCorpusSync.matchedSopCount,
            totalCitations: sopCorpusSync.totalCitations,
            mode: sopCorpusSync.mode,
            matchedSopIds: sopCorpusSync.matchedSopIds,
          }
        : undefined,
      routingPreviewSync: routingPreviewSync
        ? {
            tripAdvisoryCount: routingPreviewSync.tripAdvisoryCount,
            corridorAdvisoryCount: routingPreviewSync.corridorAdvisoryCount,
            restrictedCorridorCount: routingPreviewSync.restrictedCorridorCount,
            matches: routingPreviewSync.tripAdvisories?.slice(0, 4),
          }
        : undefined,
      floodHazardSync: floodHazardSync
        ? {
            activeZoneCount: floodHazardSync.activeZoneCount,
            corridorLinkedZoneCount: floodHazardSync.corridorLinkedZoneCount,
            tripExposureCount: floodHazardSync.tripExposureCount,
            matches: floodHazardSync.zoneMatches?.slice(0, 4),
          }
        : undefined,
      glofasFloodSync: glofasFloodSync
        ? {
            step: glofasFloodSync.step || "glofas_flood_sync",
            activeZoneCount: glofasFloodSync.activeZoneCount,
            tripExposureCount: glofasFloodSync.tripExposureCount,
            fetchMode: glofasFloodSync.fetchMode,
            lastSuccessfulFetchAt: glofasFloodSync.lastSuccessfulFetchAt,
            cdsOk: glofasFloodSync.cds?.ok ?? false,
            cdsReason: glofasFloodSync.cds?.reason,
            fallback: glofasFloodSync.fallback,
            mergeRule: glofasFloodSync.mergeRule,
            agencyZoneCount: glofasFloodSync.agencyZoneCount,
            glofasGapZoneCount: glofasFloodSync.glofasGapZoneCount,
            suppressedGlofasZoneCount: glofasFloodSync.suppressedGlofasZoneCount,
            floodBadgeLabel: glofasFloodSync.floodBadgeLabel,
            refreshed: glofasFloodSync.refreshed,
            skippedRefresh: glofasFloodSync.skippedRefresh,
            refreshPolicy: glofasFloodSync.refreshPolicy,
            staleWarning: glofasFloodSync.staleWarning,
            staleHours: glofasFloodSync.staleHours,
            staleThresholdHours: glofasFloodSync.staleThresholdHours,
            syncAt: glofasFloodSync.syncAt,
          }
        : undefined,
      urbanFloodSync: urbanFloodSync
        ? {
            step: urbanFloodSync.step || "urban_flood_sync",
            activeZoneCount: urbanFloodSync.activeZoneCount,
            tripExposureCount: urbanFloodSync.tripExposureCount,
            fetchMode: urbanFloodSync.fetchMode,
            vendor: urbanFloodSync.vendor,
            lastSuccessfulFetchAt: urbanFloodSync.lastSuccessfulFetchAt,
            vendorOk: urbanFloodSync.vendor?.ok ?? false,
            vendorReason: urbanFloodSync.vendor?.reason,
            fallback: urbanFloodSync.fallback,
            mergeRule: urbanFloodSync.mergeRule,
            enabled: urbanFloodSync.enabled,
            agencyZoneCount: urbanFloodSync.agencyZoneCount,
            commercialGapZoneCount: urbanFloodSync.commercialGapZoneCount,
            glofasGapZoneCount: urbanFloodSync.glofasGapZoneCount,
            suppressedCommercialZoneCount: urbanFloodSync.suppressedCommercialZoneCount,
            suppressedGlofasZoneCount: urbanFloodSync.suppressedGlofasZoneCount,
            escalationMinLevel: urbanFloodSync.escalationMinLevel,
            floodBadgeLabel: urbanFloodSync.floodBadgeLabel,
            refreshed: urbanFloodSync.refreshed,
            skippedRefresh: urbanFloodSync.skippedRefresh,
            refreshPolicy: urbanFloodSync.refreshPolicy,
            conversionPending: urbanFloodSync.conversionPending,
            staleWarning: urbanFloodSync.staleWarning,
            staleHours: urbanFloodSync.staleHours,
            staleThresholdHours: urbanFloodSync.staleThresholdHours,
            syncAt: urbanFloodSync.syncAt,
          }
        : undefined,
      glofasValidationSync: glofasValidationSync
        ? {
            step: glofasValidationSync.step || "glofas_validation_sync",
            eventCount: glofasValidationSync.eventCount,
            verdict: glofasValidationSync.decisionGate?.verdict,
            commercialReviewRecommended: glofasValidationSync.decisionGate?.commercialReviewRecommended,
            validationBadgeLabel: glofasValidationSync.validationBadgeLabel,
            syncAt: glofasValidationSync.syncAt,
          }
        : undefined,
      urbanFloodValidationSync: urbanFloodValidationSync
        ? {
            step: urbanFloodValidationSync.step || "urban_flood_validation_sync",
            eventCount: urbanFloodValidationSync.eventCount,
            verdict: urbanFloodValidationSync.decisionGate?.verdict,
            stayAgencyOnlyRecommended: urbanFloodValidationSync.decisionGate?.stayAgencyOnlyRecommended,
            validationBadgeLabel: urbanFloodValidationSync.validationBadgeLabel,
            badge: urbanFloodValidationSync.badge,
            syncAt: urbanFloodValidationSync.syncAt,
          }
        : undefined,
      urbanFloodAirGapSync: urbanFloodAirGapSync
        ? {
            step: urbanFloodAirGapSync.step || "urban_flood_airgap_sync",
            clipReady: urbanFloodAirGapSync.clipReady,
            clipFeatureCount: urbanFloodAirGapSync.clipFeatureCount,
            fetchPolicy: urbanFloodAirGapSync.fetchPolicy,
            airGapBadgeLabel: urbanFloodAirGapSync.airGapBadgeLabel,
            syncAt: urbanFloodAirGapSync.syncAt,
          }
        : undefined,
      glofasAirGapSync: glofasAirGapSync
        ? {
            step: glofasAirGapSync.step || "glofas_airgap_sync",
            clipReady: glofasAirGapSync.clipReady,
            clipFeatureCount: glofasAirGapSync.clipFeatureCount,
            fetchPolicy: glofasAirGapSync.fetchPolicy,
            airGapBadgeLabel: glofasAirGapSync.airGapBadgeLabel,
            syncAt: glofasAirGapSync.syncAt,
          }
        : undefined,
      glofasRunbookSync: glofasRunbookSync
        ? {
            step: glofasRunbookSync.step || "glofas_runbook_sync",
            ruleCount: glofasRunbookSync.ruleCount,
            primaryTrust: glofasRunbookSync.currentPosture?.primaryTrust,
            primaryRuleId: glofasRunbookSync.currentPosture?.primaryRuleId,
            scopeGuardHeadline: glofasRunbookSync.scopeGuardReview?.headline,
            runbookBadgeLabel: glofasRunbookSync.runbookBadgeLabel,
            syncAt: glofasRunbookSync.syncAt,
          }
        : undefined,
      floodStackRunbookSync: floodStackRunbookSync
        ? {
            step: floodStackRunbookSync.step || "flood_stack_runbook_sync",
            ruleCount: floodStackRunbookSync.ruleCount,
            primaryTrust: floodStackRunbookSync.currentPosture?.primaryTrust,
            primaryRuleId: floodStackRunbookSync.currentPosture?.primaryRuleId,
            scopeGuardHeadline: floodStackRunbookSync.scopeGuardReview?.headline,
            runbookBadgeLabel: floodStackRunbookSync.runbookBadgeLabel,
            urbanValidationVerdict: floodStackRunbookSync.urbanValidationVerdict,
            syncAt: floodStackRunbookSync.syncAt,
          }
        : undefined,
      windHazardSync: windHazardSync
        ? {
            activeZoneCount: windHazardSync.activeZoneCount,
            corridorLinkedZoneCount: windHazardSync.corridorLinkedZoneCount,
            tripExposureCount: windHazardSync.tripExposureCount,
            matches: windHazardSync.zoneMatches?.slice(0, 4),
          }
        : undefined,
      multiHazardSync: multiHazardSync
        ? {
            fusedTripCount: multiHazardSync.fusedTripCount,
            criticalTripCount: multiHazardSync.criticalTripCount,
            highTripCount: multiHazardSync.highTripCount,
            matches: multiHazardSync.tripBriefings?.slice(0, 4),
          }
        : undefined,
      sovereignDeploySync: sovereignDeploySync
        ? {
            ok: sovereignDeploySync.ok,
            checksPassed: sovereignDeploySync.checksPassed,
            checksTotal: sovereignDeploySync.checksTotal,
            auditPersistPath: sovereignDeploySync.auditPersistPath,
            llmOutbound: sovereignDeploySync.llmOutbound,
          }
        : undefined,
      roadNetworkSync: roadNetworkSync
        ? {
            avoidanceRouteCount: roadNetworkSync.avoidanceRouteCount,
            blockedEdgeCount: roadNetworkSync.blockedEdgeCount,
            nodeCount: roadNetworkSync.nodeCount,
            edgeCount: roadNetworkSync.edgeCount,
            matches: roadNetworkSync.tripAvoidanceRoutes?.slice(0, 4),
          }
        : undefined,
      demoRehearsalSync: demoRehearsalSync
        ? {
            beatCount: demoRehearsalSync.beatCount,
            evalPassed: demoRehearsalSync.evalPassed,
            evalTotal: demoRehearsalSync.evalTotal,
            evalSuiteMs: demoRehearsalSync.evalSuiteMs,
            lastPipelineMs: demoRehearsalSync.lastPipelineMs,
            lastPipelineTokens: demoRehearsalSync.lastPipelineTokens,
          }
        : undefined,
      defensibilitySync: defensibilitySync
        ? {
            pillarCount: defensibilitySync.pillarCount,
            phase2DaysDelivered: defensibilitySync.phase2DaysDelivered,
            phase2TrackCount: defensibilitySync.phase2TrackCount,
            evalPassed: defensibilitySync.evalPassed,
            evalTotal: defensibilitySync.evalTotal,
            slideCount: defensibilitySync.slideCount,
          }
        : undefined,
    },
    cadCrossRef: cadCrossRef?.matches?.map((m) => ({
      tripId: m.tripId,
      runId: m.runId,
      incidentId: m.incidentId,
      unitId: m.unitId,
    })),
    handoffCrossRef: handoffCrossRef?.matches?.map((m) => ({
      tripId: m.linkedTripId,
      handoffId: m.handoffId,
      emsRunId: m.emsRunId,
      nemtRunId: m.nemtRunId,
      status: m.status,
    })),
    publicSafetyCrossRef: publicSafetyCrossRef?.matches?.map((m) => ({
      unitId: m.unitId,
      agency: m.agency,
      corridor: m.corridor,
      corridorStatus: m.corridorStatus,
    })),
    enrichedDispatch: enrichedDispatch?.atRiskDetails
      ?.filter((t) => t.cadLinked)
      .slice(0, 4)
      .map((t) => ({
        tripId: t.tripId,
        cadRunId: t.cadRunId,
        unitStatus: t.unitStatus,
        handoffStatus: t.handoffStatus,
        nemtRunId: t.nemtRunId,
      })),
    esriCorridorSync: esriCorridorSync?.corridors?.slice(0, 4).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      layerSource: c.layerSource,
    })),
    shelterFleetCrossRef: [
      ...(shelterFleetCrossRef?.shelterMatches || []).slice(0, 2).map((s) => ({
        kind: "shelter",
        id: s.shelterId,
        corridor: s.corridor,
        status: s.status,
      })),
      ...(shelterFleetCrossRef?.fleetMatches || []).slice(0, 2).map((f) => ({
        kind: "fleet",
        id: f.assetId,
        corridor: f.corridor,
        status: f.status,
      })),
    ],
    signalMultiFeedSync: signalMultiFeedSync?.matches?.slice(0, 4).map((m) => ({
      signalId: m.signalId,
      source: m.source,
      linkedCorridors: m.linkedCorridors,
    })),
    sopCorpusSync: sopCorpusSync?.matchedSopIds?.map((id) => ({ sopId: id, mode: sopCorpusSync.mode })),
    routingPreviewSync: routingPreviewSync?.tripAdvisories?.slice(0, 4).map((a) => ({
      tripId: a.tripId,
      corridor: a.corridor,
      alternateName: a.alternateName,
      corridorStatus: a.corridorStatus,
    })),
    floodHazardSync: floodHazardSync?.zoneMatches?.slice(0, 4).map((z) => ({
      zoneId: z.zoneId,
      corridorId: (z.restrictedLinkedCorridors || z.linkedCorridors || [])[0],
      depthLevel: z.depthBand || `${z.depthInches}"`,
      exposureCount: z.exposureCount,
    })),
    glofasFloodSync: glofasFloodSync
      ? [
          {
            step: glofasFloodSync.step || "glofas_flood_sync",
            fetchMode: glofasFloodSync.fetchMode,
            badge: glofasFloodSync.floodBadgeLabel,
            gapZones: glofasFloodSync.glofasGapZoneCount,
            cdsOk: glofasFloodSync.cds?.ok,
            refreshed: glofasFloodSync.refreshed,
            skippedRefresh: glofasFloodSync.skippedRefresh,
            refreshPolicy: glofasFloodSync.refreshPolicy,
            staleWarning: glofasFloodSync.staleWarning,
            staleHours: glofasFloodSync.staleHours,
          },
        ]
      : undefined,
    urbanFloodSync: urbanFloodSync
      ? [
          {
            step: urbanFloodSync.step || "urban_flood_sync",
            fetchMode: urbanFloodSync.fetchMode,
            vendor: urbanFloodSync.vendor,
            badge: urbanFloodSync.floodBadgeLabel,
            zones: urbanFloodSync.activeZoneCount,
            commercialGap: urbanFloodSync.commercialGapZoneCount,
            vendorOk: urbanFloodSync.vendor?.ok,
            refreshed: urbanFloodSync.refreshed,
            skippedRefresh: urbanFloodSync.skippedRefresh,
            refreshPolicy: urbanFloodSync.refreshPolicy,
            conversionPending: urbanFloodSync.conversionPending,
            staleWarning: urbanFloodSync.staleWarning,
            staleHours: urbanFloodSync.staleHours,
          },
        ]
      : undefined,
    glofasValidationSync: glofasValidationSync
      ? [
          {
            step: glofasValidationSync.step || "glofas_validation_sync",
            verdict: glofasValidationSync.decisionGate?.verdict,
            badge: glofasValidationSync.validationBadgeLabel,
            commercialReview: glofasValidationSync.decisionGate?.commercialReviewRecommended,
          },
        ]
      : undefined,
    urbanFloodValidationSync: urbanFloodValidationSync
      ? [
          {
            step: urbanFloodValidationSync.step || "urban_flood_validation_sync",
            verdict: urbanFloodValidationSync.decisionGate?.verdict,
            badge: urbanFloodValidationSync.validationBadgeLabel || urbanFloodValidationSync.badge,
            stayAgencyOnly: urbanFloodValidationSync.decisionGate?.stayAgencyOnlyRecommended,
          },
        ]
      : undefined,
    urbanFloodAirGapSync: urbanFloodAirGapSync
      ? [
          {
            step: urbanFloodAirGapSync.step || "urban_flood_airgap_sync",
            clipReady: urbanFloodAirGapSync.clipReady,
            badge: urbanFloodAirGapSync.airGapBadgeLabel,
            fetchPolicy: urbanFloodAirGapSync.fetchPolicy,
          },
        ]
      : undefined,
    glofasAirGapSync: glofasAirGapSync
      ? [
          {
            step: glofasAirGapSync.step || "glofas_airgap_sync",
            clipReady: glofasAirGapSync.clipReady,
            badge: glofasAirGapSync.airGapBadgeLabel,
            fetchPolicy: glofasAirGapSync.fetchPolicy,
          },
        ]
      : undefined,
    glofasRunbookSync: glofasRunbookSync
      ? [
          {
            step: glofasRunbookSync.step || "glofas_runbook_sync",
            badge: glofasRunbookSync.runbookBadgeLabel,
            primaryTrust: glofasRunbookSync.currentPosture?.primaryTrust,
            scopeGuard: glofasRunbookSync.scopeGuardReview?.headline,
          },
        ]
      : undefined,
    floodStackRunbookSync: floodStackRunbookSync
      ? [
          {
            step: floodStackRunbookSync.step || "flood_stack_runbook_sync",
            badge: floodStackRunbookSync.runbookBadgeLabel,
            primaryTrust: floodStackRunbookSync.currentPosture?.primaryTrust,
            scopeGuard: floodStackRunbookSync.scopeGuardReview?.headline,
          },
        ]
      : undefined,
    windHazardSync: windHazardSync?.zoneMatches?.slice(0, 4).map((z) => ({
      zoneId: z.zoneId,
      corridorId: (z.restrictedLinkedCorridors || z.linkedCorridors || [])[0],
      gustMph: z.gustMph,
      windBand: z.windBand,
    })),
    multiHazardSync: multiHazardSync?.tripBriefings?.slice(0, 4).map((t) => ({
      tripId: t.tripId,
      compositeRisk: t.compositeRisk,
      hazardTypes: t.hazardTypes,
      briefingLine: t.briefingLine,
    })),
    sovereignDeploySync: sovereignDeploySync
      ? [
          {
            profile: sovereignDeploySync.profile,
            checks: `${sovereignDeploySync.checksPassed}/${sovereignDeploySync.checksTotal}`,
            ok: sovereignDeploySync.ok,
          },
        ]
      : undefined,
    roadNetworkSync: roadNetworkSync?.tripAvoidanceRoutes?.slice(0, 4).map((r) => ({
      tripId: r.tripId,
      corridor: r.corridor,
      stepCount: r.stepCount,
      briefingLine: r.briefingLine,
    })),
    demoRehearsalSync: demoRehearsalSync
      ? [
          {
            eval: `${demoRehearsalSync.evalPassed ?? "?"}/${demoRehearsalSync.evalTotal}`,
            beats: demoRehearsalSync.beatCount,
            durationMin: demoRehearsalSync.durationMin,
          },
        ]
      : undefined,
    defensibilitySync: defensibilitySync
      ? [
          {
            pillars: defensibilitySync.pillarCount,
            phase2Days: defensibilitySync.phase2DaysDelivered,
            eval: `${defensibilitySync.evalPassed ?? "?"}/${defensibilitySync.evalTotal}`,
            slides: defensibilitySync.slideCount,
          },
        ]
      : undefined,
    steps: [
      { id: "monitor", label: "Monitor brief", agent: "monitor", auditId: monitor.audit?.id, ts: monitor.audit?.ts },
      { id: "triage", label: "Triage rank", agent: "triage", auditId: triage.audit?.id, ts: triage.audit?.ts },
      { id: "action", label: "Action pack", agent: "action", auditId: action.audit?.id, ts: action.audit?.ts },
      { id: "hitl_staged", label: "HITL staged", gateId: hitl?.id, ts: hitl?.stagedAt || ts },
      ...(glofasFloodSync?.fetchMode
        ? [
            {
              id: "glofas_flood_sync",
              label: glofasFloodSync.staleWarning
                ? `glofas_flood_sync · stale ${glofasFloodSync.staleHours}h · ${glofasFloodSync.fetchMode}`
                : glofasFloodSync.skippedRefresh || glofasFloodSync.refreshed === false
                  ? `glofas_flood_sync · cache_only · ${glofasFloodSync.fetchMode}`
                  : `glofas_flood_sync · escalation_refresh · ${glofasFloodSync.fetchMode}`,
              ts: glofasFloodSync.syncAt || ts,
            },
          ]
        : []),
      ...(urbanFloodSync?.step
        ? [
            {
              id: "urban_flood_sync",
              label: urbanFloodSync.staleWarning
                ? `urban_flood_sync · stale ${urbanFloodSync.staleHours}h · ${urbanFloodSync.fetchMode || "sync"}`
                : urbanFloodSync.skippedRefresh || urbanFloodSync.refreshed === false
                  ? `urban_flood_sync · cache_only · ${urbanFloodSync.fetchMode || "cache"}`
                  : `urban_flood_sync · escalation_refresh · ${urbanFloodSync.fetchMode || "sync"}`,
              ts: urbanFloodSync.syncAt || ts,
            },
          ]
        : []),
      ...(urbanFloodValidationSync?.decisionGate?.verdict
        ? [
            {
              id: "urban_flood_validation_sync",
              label: `urban_flood_validation_sync · ${urbanFloodValidationSync.decisionGate.verdict.replace(/_/g, "-")}`,
              ts: urbanFloodValidationSync.syncAt || ts,
            },
          ]
        : []),
      ...(urbanFloodAirGapSync?.step
        ? [
            {
              id: "urban_flood_airgap_sync",
              label: urbanFloodAirGapSync.clipReady
                ? `urban_flood_airgap_sync · ${urbanFloodAirGapSync.airGapBadgeLabel}`
                : "urban_flood_airgap_sync · clip missing",
              ts: urbanFloodAirGapSync.syncAt || ts,
            },
          ]
        : []),
      ...(glofasValidationSync?.decisionGate?.verdict
        ? [
            {
              id: "glofas_validation_sync",
              label: `glofas_validation_sync · ${glofasValidationSync.decisionGate.verdict.replace(/_/g, "-")}`,
              ts: glofasValidationSync.syncAt || ts,
            },
          ]
        : []),
      ...(glofasAirGapSync?.step
        ? [
            {
              id: "glofas_airgap_sync",
              label: glofasAirGapSync.clipReady
                ? `glofas_airgap_sync · ${glofasAirGapSync.airGapBadgeLabel}`
                : "glofas_airgap_sync · clip missing",
              ts: glofasAirGapSync.syncAt || ts,
            },
          ]
        : []),
      ...(glofasRunbookSync?.step
        ? [
            {
              id: "glofas_runbook_sync",
              label: `glofas_runbook_sync · ${glofasRunbookSync.runbookBadgeLabel || "scope-guard-review"}`,
              ts: glofasRunbookSync.syncAt || ts,
            },
          ]
        : []),
      ...(floodStackRunbookSync?.step
        ? [
            {
              id: "flood_stack_runbook_sync",
              label: `flood_stack_runbook_sync · ${floodStackRunbookSync.runbookBadgeLabel || "scope-guard-review"}`,
              ts: floodStackRunbookSync.syncAt || ts,
            },
          ]
        : []),
      { id: "audit_persist", label: "Audit persisted (JSONL)", ts },
    ],
    citations: uniqueCitationRefs(monitor.brief?.sopCitations, action.pack?.sopCitations),
    childAudits: [monitor.audit?.id, triage.audit?.id, action.audit?.id].filter(Boolean),
    agents: ["monitor", "triage", "action"],
    mode: mode || "demo",
  });
}

/** Record NEMT CAD handoff accept write-back — separate from Triple HITL (COMMS-03). */
export function recordHandoffWriteBack({ transitions, source, acceptedBy, scopeGuard }) {
  const ts = new Date().toISOString();
  const summary =
    transitions.length === 1
      ? `Handoff write-back: ${transitions[0].handoffId} ${transitions[0].from}→${transitions[0].to} · ${transitions[0].nemtRunId}`
      : `Handoff write-back: ${transitions.length} accept(s) · ${transitions.map((t) => `${t.handoffId}→${t.nemtRunId}`).join(", ")}`;

  return appendAuditEntry({
    type: "handoff_writeback",
    summary,
    source: source || "pilot",
    acceptedBy: acceptedBy || "nemt_dispatch",
    scopeGuard,
    handoffWriteBack: transitions.map((t) => ({
      handoffId: t.handoffId,
      from: t.from,
      to: t.to,
      linkedTripId: t.linkedTripId,
      nemtRunId: t.nemtRunId,
      emsRunId: t.emsRunId,
      incidentId: t.incidentId,
      acceptedAt: t.acceptedAt,
      acceptedBy: t.acceptedBy,
    })),
    steps: [{ id: "nemt_handoff_accept", label: "NEMT handoff accept (not HITL)", ts }],
    mode: "write_back_pilot",
  });
}

/** Record full Week 1 demo run (exit-criteria checkpoint). */
export function recordWeek1Demo({ signals, monitor, map }) {
  return appendAuditEntry({
    type: "week1_demo",
    summary: "Week 1 exit: signal → Monitor brief → map layers",
    signal: {
      level: signals.level,
      label: signals.label,
      event: signals.event,
    },
    brief: {
      level: monitor.brief?.level,
      severity: monitor.brief?.severity,
      citationCount: monitor.brief?.sopCitations?.length ?? 0,
    },
    map: {
      level: map.level,
      atRiskCount: map.atRiskCount,
      corridors: Object.keys(map.corridorStatus || {}),
    },
    agents: ["monitor"],
    exitCriteria: {
      signalIn: true,
      briefOnScreen: true,
      auditLogged: true,
    },
  });
}
