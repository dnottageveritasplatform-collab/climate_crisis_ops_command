const entries = [];
const MAX = 100;
let seq = 0;

/**
 * Append-only audit trail for Week 1 demo (signal → agent → brief → map).
 * Week 2 extends with dual HITL approver fields.
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

/** Record Monitor brief completion in the audit trail. */
export function recordMonitorBrief({ signal, brief, threshold, mode }) {
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
    agents: ["monitor"],
    mode: mode || "demo",
  });
}

/** Record Triage rank completion in the audit trail. */
export function recordTriageRank({ signal, ranking, threshold, mode }) {
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
    agents: ["triage"],
    mode: mode || "demo",
  });
}

/** Record Action pack completion in the audit trail. */
export function recordActionPack({ signal, pack, threshold, mode }) {
  return appendAuditEntry({
    type: "action_pack",
    summary: `Action pack: ${pack.checklist.length} checklist · COMMS-03 draft · ${pack.driverComms.length} driver SMS`,
    signal: {
      level: signal?.level ?? threshold,
      label: signal?.label,
    },
    action: {
      level: pack.level,
      checklistItems: pack.checklist.length,
      driverComms: pack.driverComms.length,
      bulletinSubject: pack.hospitalBulletin.subject,
      hitlRequired: pack.hitlRequired,
    },
    agents: ["action"],
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
