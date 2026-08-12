import { buildAuditTrail } from "./index.js";
import { getAuditPersistStatus } from "./store.js";
import { buildCopExport } from "../public-safety/index.js";
import { buildShelterFleetCrossRef } from "../shelter-fleet/index.js";

const EOC_AUDIT_SCOPE_GUARD =
  "EOC audit briefing export — append-only persisted trail + read-only situational feeds. Not dispatch authority.";

/**
 * Combined audit trail + COP snapshot for EOC briefings (Phase 2 Day 8).
 */
export async function buildEocAuditBriefing({ level = 2, limit = 20 } = {}) {
  const trail = buildAuditTrail(limit);
  const cop = await buildCopExport(level);
  const shelterFleet = buildShelterFleetCrossRef(level);
  const persist = getAuditPersistStatus(trail.count);

  const pipelineRuns = trail.entries.filter((e) => e.type === "pipeline_run");
  const hitlReleases = trail.entries.filter((e) => e.type === "hitl_released");
  const writeBacks = trail.entries.filter((e) => e.type === "handoff_writeback");

  return {
    ok: true,
    phase: "phase-2-day-8",
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
