const entries = [];
const MAX = 100;
let seq = 0;

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
 * Append-only audit trail — Week 2 Day 13+: steps, citations, approver timestamps.
 */
export function appendAuditEntry(entry) {
  const record = {
    id: `AUD-${String(++seq).padStart(4, "0")}`,
    ts: new Date().toISOString(),
    ...entry,
  };
  entries.unshift(record);
  if (entries.length > MAX) entries.length = MAX;
  console.log(`[audit] ${record.type}`, record.summary || record.id);
  return record;
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
export function recordPipelineRun({ signals, monitor, triage, action, hitl, threshold, mode }) {
  const ts = new Date().toISOString();
  return appendAuditEntry({
    type: "pipeline_run",
    summary: `Pipeline L${threshold}: brief → ${triage.ranking?.rankedTrips?.length ?? 0} ranked → action pack · HITL ${hitl?.active ? hitl.state : "idle"}`,
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
      hitlRoles: hitl?.roles ? Object.keys(hitl.roles) : [],
    },
    steps: [
      { id: "monitor", label: "Monitor brief", agent: "monitor", auditId: monitor.audit?.id, ts: monitor.audit?.ts },
      { id: "triage", label: "Triage rank", agent: "triage", auditId: triage.audit?.id, ts: triage.audit?.ts },
      { id: "action", label: "Action pack", agent: "action", auditId: action.audit?.id, ts: action.audit?.ts },
      { id: "hitl_staged", label: "HITL staged", gateId: hitl?.id, ts: hitl?.stagedAt || ts },
    ],
    citations: uniqueCitationRefs(monitor.brief?.sopCitations, action.pack?.sopCitations),
    childAudits: [monitor.audit?.id, triage.audit?.id, action.audit?.id].filter(Boolean),
    agents: ["monitor", "triage", "action"],
    mode: mode || "demo",
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
