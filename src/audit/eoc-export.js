import { buildAuditTrail } from "./index.js";
import { getAuditPersistStatus } from "./store.js";
import { buildCopExport } from "../public-safety/index.js";
import { buildShelterFleetCrossRef } from "../shelter-fleet/index.js";
import { buildMultiFeedCrossRef } from "../signals/multi-feed.js";
import { buildSopCorpusCrossRef } from "../sops/corpus.js";
import { buildRoutingPreviewCrossRef } from "../geo/routing.js";
import { buildFloodHazardCrossRef } from "../geo/hazards.js";
import { getGlofasFloodStatus } from "../geo/glofas.js";
import { getUrbanFloodStatus, isUrbanFloodEnabled } from "../geo/urban-flood.js";
import { buildGlofasValidationSummary } from "../geo/glofas-validation.js";
import { buildUrbanFloodValidationSummary } from "../geo/urban-flood-validation.js";
import { buildGlofasAirGapProfile } from "../geo/glofas-sovereign.js";
import { buildUrbanFloodAirGapProfile } from "../geo/urban-flood-sovereign.js";
import { buildGlofasRunbookSummary } from "../geo/glofas-runbook.js";
import { buildFloodStackRunbookSummary } from "../geo/flood-stack-runbook.js";
import { buildWindHazardCrossRef } from "../geo/wind.js";
import { buildMultiHazardCrossRef } from "../geo/multi-hazard.js";
import { getSovereignDeployStatus } from "../deploy/sovereign.js";
import { buildRoadNetworkCrossRef } from "../geo/road-network.js";
import { getDemoRehearsalStatus } from "../demo/rehearsal.js";
import { getDefensibilityStatus } from "../defensibility/index.js";

const EOC_AUDIT_SCOPE_GUARD =
  "EOC audit briefing export — append-only persisted trail + read-only situational feeds. Not dispatch authority.";

/**
 * Combined audit trail + COP snapshot for EOC briefings (Phase 2 Day 8).
 */
export async function buildEocAuditBriefing({ level = 2, limit = 20 } = {}) {
  const trail = buildAuditTrail(limit);
  const cop = await buildCopExport(level);
  const shelterFleet = buildShelterFleetCrossRef(level);
  const signalMultiFeed = buildMultiFeedCrossRef(level);
  const sopCorpus = buildSopCorpusCrossRef(level);
  const routingPreview = buildRoutingPreviewCrossRef(level);
  const floodHazard = buildFloodHazardCrossRef(level);
  const glofasFlood = getGlofasFloodStatus(level);
  const urbanFlood = getUrbanFloodStatus(level);
  const glofasValidation = buildGlofasValidationSummary();
  const urbanFloodValidation = buildUrbanFloodValidationSummary();
  const glofasAirGap = buildGlofasAirGapProfile();
  const urbanFloodAirGap = buildUrbanFloodAirGapProfile();
  const glofasRunbook = buildGlofasRunbookSummary(level);
  const floodStackRunbook = buildFloodStackRunbookSummary(level);
  const windHazard = buildWindHazardCrossRef(level);
  const multiHazard = buildMultiHazardCrossRef(level);
  const sovereignDeploy = getSovereignDeployStatus();
  const roadNetwork = buildRoadNetworkCrossRef(level);
  const demoRehearsal = getDemoRehearsalStatus();
  const defensibility = getDefensibilityStatus();
  const persist = getAuditPersistStatus(trail.count);

  const pipelineRuns = trail.entries.filter((e) => e.type === "pipeline_run");
  const hitlReleases = trail.entries.filter((e) => e.type === "hitl_released");
  const writeBacks = trail.entries.filter((e) => e.type === "handoff_writeback");

  return {
    ok: true,
    phase: isUrbanFloodEnabled() ? "phase-3b-day-7" : "phase-3-day-10",
    exportType: "eoc_audit_briefing",
    generatedAt: new Date().toISOString(),
    level,
    scopeGuard: EOC_AUDIT_SCOPE_GUARD,
    persist,
    summary: {
      auditEntryCount: trail.count,
      latestPipelineId: pipelineRuns[0]?.id || null,
      latestPipelineSummary: pipelineRuns[0]?.summary || null,
      pipelineRunCount: pipelineRuns.length,
      hitlReleaseCount: hitlReleases.length,
      handoffWriteBackCount: writeBacks.length,
      shelterFleetMatches: shelterFleet.matchedCount,
      corridorLinkedSignals: signalMultiFeed.corridorLinkedSignalCount,
      matchedSops: sopCorpus.matchedSopCount,
      routingTripAdvisories: routingPreview.tripAdvisoryCount,
      floodTripExposures: floodHazard.tripExposureCount,
      floodActiveZones: floodHazard.activeZoneCount,
      windTripExposures: windHazard.tripExposureCount,
      windActiveZones: windHazard.activeZoneCount,
      fusedTripBriefings: multiHazard.fusedTripCount,
      criticalFusedTrips: multiHazard.criticalTripCount,
      sovereignDeployOk: sovereignDeploy.ok,
      sovereignChecks: `${sovereignDeploy.checksPassed}/${sovereignDeploy.checksTotal}`,
      roadNetworkAvoidanceRoutes: roadNetwork.avoidanceRouteCount,
      roadNetworkBlockedEdges: roadNetwork.blockedEdgeCount,
      demoRehearsalBeats: demoRehearsal.beatCount,
      demoRehearsalEval: `${demoRehearsal.evalPassed ?? "?"}/${demoRehearsal.evalTotal}`,
      defensibilityPillars: defensibility.pillarCount,
      defensibilityPhase2Days: defensibility.phase2DaysDelivered,
    },
    situation: cop.situation,
    operatingPicture: {
      corridors: cop.corridors,
      corridorLayer: cop.corridorLayer,
      publicSafety: cop.publicSafety,
      nemtCad: cop.nemtCad,
      transportDesk: cop.transportDesk,
      shelterFleet: {
        matchedCount: shelterFleet.matchedCount,
        matchedShelterCount: shelterFleet.matchedShelterCount,
        matchedFleetCount: shelterFleet.matchedFleetCount,
        atRiskOnRestrictedCount: shelterFleet.atRiskOnRestrictedCount,
      },
      signalMultiFeed: {
        institutionalCount: signalMultiFeed.institutionalCount,
        corridorLinkedSignalCount: signalMultiFeed.corridorLinkedSignalCount,
        matches: signalMultiFeed.matches?.slice(0, 4),
      },
      sopCorpus: {
        matchedSopCount: sopCorpus.matchedSopCount,
        totalCitations: sopCorpus.totalCitations,
        mode: sopCorpus.mode,
        matchedSopIds: sopCorpus.matchedSopIds,
      },
      routingPreview: {
        tripAdvisoryCount: routingPreview.tripAdvisoryCount,
        corridorAdvisoryCount: routingPreview.corridorAdvisoryCount,
        restrictedCorridorCount: routingPreview.restrictedCorridorCount,
        tripAdvisories: routingPreview.tripAdvisories?.slice(0, 4),
      },
      floodHazard: {
        activeZoneCount: floodHazard.activeZoneCount,
        corridorLinkedZoneCount: floodHazard.corridorLinkedZoneCount,
        tripExposureCount: floodHazard.tripExposureCount,
        mergeRule: floodHazard.mergeRule,
        agencyZoneCount: floodHazard.agencyZoneCount,
        glofasGapZoneCount: floodHazard.glofasGapZoneCount,
        suppressedGlofasZoneCount: floodHazard.suppressedGlofasZoneCount,
        zoneMatches: floodHazard.zoneMatches?.slice(0, 4),
        scopeGuard: floodHazard.scopeGuard,
      },
      glofasFlood: {
        pipelineStep: glofasFlood.pipelineStep,
        monitorTool: glofasFlood.monitorTool,
        enabled: glofasFlood.enabled,
        fetchMode: glofasFlood.fetchMode,
        lastSuccessfulFetchAt: glofasFlood.lastSuccessfulFetchAt,
        activeZoneCount: glofasFlood.activeZoneCount,
        tripExposureCount: glofasFlood.tripExposureCount,
        corridorLinkedZoneCount: glofasFlood.corridorLinkedZoneCount,
        mergeRule: glofasFlood.mergeRule,
        agencyZoneCount: glofasFlood.agencyZoneCount,
        glofasGapZoneCount: glofasFlood.glofasGapZoneCount,
        suppressedGlofasZoneCount: glofasFlood.suppressedGlofasZoneCount,
        floodBadgeLabel: glofasFlood.floodBadgeLabel,
        cdsKeyConfigured: glofasFlood.cds?.keyConfigured ?? false,
        cdsCatalogueOk: glofasFlood.cds?.catalogueOk ?? false,
        staleWarning: glofasFlood.staleWarning,
        staleHours: glofasFlood.staleHours,
        staleThresholdHours: glofasFlood.staleThresholdHours,
        refreshed: glofasFlood.refreshed,
        refreshPolicy: glofasFlood.refreshPolicy,
        escalationMinLevel: glofasFlood.escalationMinLevel,
        conversionPending: glofasFlood.conversionPending,
        gridResolutionDeg: glofasFlood.gridResolutionDeg,
        sampleZones: glofasFlood.sampleZones,
        scopeGuard: glofasFlood.scopeGuard,
      },
      urbanFlood: {
        pipelineStep: urbanFlood.pipelineStep,
        monitorTool: urbanFlood.monitorTool,
        enabled: urbanFlood.enabled,
        vendor: urbanFlood.vendor,
        fetchMode: urbanFlood.fetchMode,
        lastSuccessfulFetchAt: urbanFlood.lastSuccessfulFetchAt,
        activeZoneCount: urbanFlood.activeZoneCount,
        tripExposureCount: urbanFlood.tripExposureCount,
        corridorLinkedZoneCount: urbanFlood.corridorLinkedZoneCount,
        mergeRule: urbanFlood.mergeRule,
        agencyZoneCount: urbanFlood.agencyZoneCount,
        commercialGapZoneCount: urbanFlood.commercialGapZoneCount,
        glofasGapZoneCount: urbanFlood.glofasGapZoneCount,
        suppressedCommercialZoneCount: urbanFlood.suppressedCommercialZoneCount,
        suppressedGlofasZoneCount: urbanFlood.suppressedGlofasZoneCount,
        floodBadgeLabel: urbanFlood.floodBadgeLabel,
        vendorCatalogueOk: urbanFlood.vendorStatus?.catalogueOk ?? false,
        staleWarning: urbanFlood.staleWarning,
        staleHours: urbanFlood.staleHours,
        staleThresholdHours: urbanFlood.staleThresholdHours,
        refreshed: urbanFlood.refreshed,
        refreshPolicy: urbanFlood.refreshPolicy,
        escalationMinLevel: urbanFlood.escalationMinLevel,
        conversionPending: urbanFlood.conversionPending,
        gridResolutionDeg: urbanFlood.gridResolutionDeg,
        sampleZones: urbanFlood.sampleZones,
        scopeGuard: urbanFlood.scopeGuard,
      },
      glofasValidation: {
        step: glofasValidation.step,
        eventCount: glofasValidation.eventCount,
        verdict: glofasValidation.decisionGate?.verdict,
        commercialReviewRecommended: glofasValidation.decisionGate?.commercialReviewRecommended,
        rationale: glofasValidation.decisionGate?.rationale,
        reports: glofasValidation.reports,
        scopeGuard: glofasValidation.scopeGuard,
      },
      urbanFloodValidation: {
        step: urbanFloodValidation.step,
        eventCount: urbanFloodValidation.eventCount,
        verdict: urbanFloodValidation.decisionGate?.verdict,
        stayAgencyOnlyRecommended: urbanFloodValidation.decisionGate?.stayAgencyOnlyRecommended,
        rationale: urbanFloodValidation.decisionGate?.rationale,
        reports: urbanFloodValidation.reports,
        scopeGuard: urbanFloodValidation.scopeGuard,
      },
      glofasAirGap: {
        clipReady: glofasAirGap.clipReady,
        clipPath: glofasAirGap.clipPath,
        clipFeatureCount: glofasAirGap.clipFeatureCount,
        fetchPolicy: glofasAirGap.fetchPolicy,
        airGapMode: glofasAirGap.airGapMode,
        bundleFileCount: glofasAirGap.bundleFileCount,
        recommendedEnv: glofasAirGap.recommendedEnv,
        scopeGuard: glofasAirGap.scopeGuard,
      },
      urbanFloodAirGap: {
        clipReady: urbanFloodAirGap.clipReady,
        clipPath: urbanFloodAirGap.clipPath,
        clipFeatureCount: urbanFloodAirGap.clipFeatureCount,
        fetchPolicy: urbanFloodAirGap.fetchPolicy,
        airGapMode: urbanFloodAirGap.airGapMode,
        bundleFileCount: urbanFloodAirGap.bundleFileCount,
        recommendedEnv: urbanFloodAirGap.recommendedEnv,
        scopeGuard: urbanFloodAirGap.scopeGuard,
      },
      glofasRunbook: {
        step: glofasRunbook.step,
        ruleCount: glofasRunbook.ruleCount,
        primaryTrust: glofasRunbook.currentPosture?.primaryTrust,
        primaryRuleId: glofasRunbook.currentPosture?.primaryRuleId,
        scopeGuardHeadline: glofasRunbook.scopeGuardReview?.headline,
        defensibilityLine: glofasRunbook.scopeGuardReview?.defensibilityLine,
        operatorChecklist: glofasRunbook.operatorChecklist,
        scopeGuard: glofasRunbook.scopeGuard,
      },
      floodStackRunbook: {
        step: floodStackRunbook.step,
        ruleCount: floodStackRunbook.ruleCount,
        primaryTrust: floodStackRunbook.currentPosture?.primaryTrust,
        primaryRuleId: floodStackRunbook.currentPosture?.primaryRuleId,
        scopeGuardHeadline: floodStackRunbook.scopeGuardReview?.headline,
        defensibilityLine: floodStackRunbook.scopeGuardReview?.defensibilityLine,
        urbanValidationVerdict: floodStackRunbook.urbanValidationVerdict,
        glofasValidationVerdict: floodStackRunbook.glofasValidationVerdict,
        floodBadgeLabel: floodStackRunbook.floodBadgeLabel,
        operatorChecklist: floodStackRunbook.operatorChecklist,
        scopeGuard: floodStackRunbook.scopeGuard,
      },
      windHazard: {
        activeZoneCount: windHazard.activeZoneCount,
        corridorLinkedZoneCount: windHazard.corridorLinkedZoneCount,
        tripExposureCount: windHazard.tripExposureCount,
        zoneMatches: windHazard.zoneMatches?.slice(0, 4),
        scopeGuard: windHazard.scopeGuard,
      },
      multiHazard: {
        fusedTripCount: multiHazard.fusedTripCount,
        criticalTripCount: multiHazard.criticalTripCount,
        highTripCount: multiHazard.highTripCount,
        floodMergeRule: multiHazard.floodMergeRule,
        agencyFloodTripCount: multiHazard.agencyFloodTripCount,
        modelFloodTripCount: multiHazard.modelFloodTripCount,
        floodSuppressedGlofasZoneCount: multiHazard.floodSuppressedGlofasZoneCount,
        floodSuppressedCommercialZoneCount: multiHazard.floodSuppressedCommercialZoneCount ?? 0,
        commercialFloodTripCount: multiHazard.commercialFloodTripCount ?? 0,
        floodBadgeLabel: multiHazard.floodBadgeLabel,
        tripBriefings: multiHazard.tripBriefings?.slice(0, 4),
        scopeGuard: multiHazard.scopeGuard,
      },
      sovereignDeploy: {
        ok: sovereignDeploy.ok,
        checksPassed: sovereignDeploy.checksPassed,
        checksTotal: sovereignDeploy.checksTotal,
        auditPersistPath: sovereignDeploy.auditPersistPath,
        llmOutbound: sovereignDeploy.llmOutbound,
        scopeGuard: sovereignDeploy.scopeGuard,
      },
      roadNetwork: {
        nodeCount: roadNetwork.nodeCount,
        edgeCount: roadNetwork.edgeCount,
        blockedEdgeCount: roadNetwork.blockedEdgeCount,
        avoidanceRouteCount: roadNetwork.avoidanceRouteCount,
        tripAvoidanceRoutes: roadNetwork.tripAvoidanceRoutes?.slice(0, 4),
        scopeGuard: roadNetwork.scopeGuard,
      },
      demoRehearsal: {
        beatCount: demoRehearsal.beatCount,
        durationMin: demoRehearsal.durationMin,
        evalPassed: demoRehearsal.evalPassed,
        evalTotal: demoRehearsal.evalTotal,
        evalSuiteMs: demoRehearsal.evalSuiteMs,
        lastPipelineMs: demoRehearsal.lastPipelineMs,
        lastPipelineTokens: demoRehearsal.lastPipelineTokens,
        api: demoRehearsal.api,
        scopeGuard: demoRehearsal.scopeGuard,
      },
      defensibility: {
        pillarCount: defensibility.pillarCount,
        phase2DaysDelivered: defensibility.phase2DaysDelivered,
        phase2TrackCount: defensibility.phase2TrackCount,
        phase2Complete: defensibility.phase2Complete,
        evalPassed: defensibility.evalPassed,
        evalTotal: defensibility.evalTotal,
        slideCount: defensibility.slideCount,
        founder: defensibility.founder,
        scopeGuard: defensibility.scopeGuard,
        api: defensibility.api,
      },
    },
    auditTrail: {
      latest: trail.latest,
      latestPipeline: trail.latestPipeline,
      latestRelease: trail.latestRelease,
      entries: trail.entries,
    },
    disclaimer: cop.disclaimer,
  };
}
