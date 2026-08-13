import { buildAuditTrail } from "./index.js";
import { getAuditPersistStatus } from "./store.js";
import { buildCopExport } from "../public-safety/index.js";
import { buildShelterFleetCrossRef } from "../shelter-fleet/index.js";
import { buildMultiFeedCrossRef } from "../signals/multi-feed.js";
import { buildSopCorpusCrossRef } from "../sops/corpus.js";
import { buildRoutingPreviewCrossRef } from "../geo/routing.js";
import { buildFloodHazardCrossRef } from "../geo/hazards.js";

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
  const persist = getAuditPersistStatus(trail.count);

  const pipelineRuns = trail.entries.filter((e) => e.type === "pipeline_run");
  const hitlReleases = trail.entries.filter((e) => e.type === "hitl_released");
  const writeBacks = trail.entries.filter((e) => e.type === "handoff_writeback");

  return {
    ok: true,
    phase: "phase-2-day-12",
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
        zoneMatches: floodHazard.zoneMatches?.slice(0, 4),
        scopeGuard: floodHazard.scopeGuard,
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
