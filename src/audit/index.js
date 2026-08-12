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
  const hitlModeNote = hitl?.extendedHitl ? " · extended HITL (5)" : "";
  return appendAuditEntry({
    type: "pipeline_run",
    summary: `Pipeline L${threshold}: brief → ${triage.ranking?.rankedTrips?.length ?? 0} ranked → action pack · HITL ${hitl?.active ? hitl.state : "idle"}${hitlModeNote}${cadNote}${handoffNote}${publicSafetyNote}${enrichNote}${esriNote}${shelterFleetNote}${signalFeedNote}${sopNote}`,
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
    steps: [
      { id: "monitor", label: "Monitor brief", agent: "monitor", auditId: monitor.audit?.id, ts: monitor.audit?.ts },
      { id: "triage", label: "Triage rank", agent: "triage", auditId: triage.audit?.id, ts: triage.audit?.ts },
      { id: "action", label: "Action pack", agent: "action", auditId: action.audit?.id, ts: action.audit?.ts },
      { id: "hitl_staged", label: "HITL staged", gateId: hitl?.id, ts: hitl?.stagedAt || ts },
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
