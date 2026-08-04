import { fetchSignals } from "../signals/index.js";
import { runMonitorBrief } from "../agents/monitor/brief.js";
import { buildMapLayers } from "../geo/index.js";
import { recordWeek1Demo, getLatestAuditEntry } from "../audit/index.js";

/**
 * Week 1 demo beat: signal ingest → Monitor brief → map layers → audit entry.
 * Satisfies Day 7 exit criteria.
 */
export async function runWeek1Demo() {
  const signals = await fetchSignals({ refresh: true });
  const monitor = await runMonitorBrief();
  const map = buildMapLayers(signals.level ?? monitor.threshold ?? 2);
  const audit = recordWeek1Demo({ signals, monitor, map });

  return {
    ok: true,
    phase: "week-1-day-7",
    exitCriteria: audit.exitCriteria,
    signals,
    monitor,
    map,
    audit,
    latestAudit: getLatestAuditEntry(),
  };
}
