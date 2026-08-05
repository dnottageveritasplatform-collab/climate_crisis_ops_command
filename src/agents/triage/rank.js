import { corridorStatusForLevel, loadDispatch } from "../../dispatch/index.js";
import { buildMapLayersFromTriage, loadGeoLayers, setLastTriageRanking } from "../../geo/index.js";
import { recordTriageRank } from "../../audit/index.js";
import { logAgentEvent } from "../runtime/logger.js";
import { runTool } from "../runtime/tools.js";

const PRIORITY_SCORE = { P1: 100, P2: 70, P3: 40, P4: 20 };

/**
 * Day 8 Triage agent: rank impacted trips, facilities, and corridor conflicts.
 * Demo mode — deterministic scoring, no LLM/Nebius required.
 */
export async function runTriageRank({ level } = {}) {
  const agent = "triage";
  logAgentEvent("agent_start", { agent, message: "Triage rank started" });

  logAgentEvent("tool_call", { agent, tool: "get_signal_status", args: {} });
  const signal = await runTool("get_signal_status", {});
  logAgentEvent("tool_result", { agent, tool: "get_signal_status", args: {}, result: signal });

  const threshold = level ?? signal.level ?? 2;

  logAgentEvent("tool_call", { agent, tool: "summarize_dispatch", args: { level: threshold } });
  const dispatch = await runTool("summarize_dispatch", { level: threshold });
  logAgentEvent("tool_result", {
    agent,
    tool: "summarize_dispatch",
    args: { level: threshold },
    result: dispatch,
  });

  const ranking = buildTriageRanking(threshold, signal, dispatch);

  setLastTriageRanking(ranking);
  const map = buildMapLayersFromTriage(ranking);

  logAgentEvent("agent_complete", { agent, mode: "demo", message: "Triage rank ready" });

  const audit = recordTriageRank({ signal, ranking, threshold, mode: "demo" });

  return {
    agent,
    mode: "demo",
    framework: "openclaw-compatible-loop",
    threshold,
    toolResults: [
      { tool: "get_signal_status", result: signal },
      { tool: "summarize_dispatch", args: { level: threshold }, result: dispatch },
    ],
    ranking,
    map,
    audit,
  };
}

function buildTriageRanking(level, signal, dispatch) {
  const corridorStatus = dispatch.corridorStatus || corridorStatusForLevel(level);
  const trips = loadDispatch();
  const { facilities } = loadGeoLayers();
  const facilityNames = Object.fromEntries(
    facilities.features.map((f) => [f.properties.id, f.properties.name])
  );

  const rankedTrips = trips
    .map((trip) => scoreTrip(trip, level, corridorStatus))
    .filter((t) => t.conflictScore > 0 || PRIORITY_SCORE[trip.priority] >= PRIORITY_SCORE.P2)
    .sort((a, b) => b.conflictScore - a.conflictScore || a.scheduledAt.localeCompare(b.scheduledAt))
    .map((t, i) => ({ rank: i + 1, ...t }));

  const facilityImpact = {};
  for (const trip of trips) {
    const destId = trip.facilityId || "unknown";
    if (!facilityImpact[destId]) {
      facilityImpact[destId] = {
        id: destId,
        name: facilityNames[destId] || trip.facility,
        impactedTrips: 0,
        p1Count: 0,
        p2Count: 0,
        corridors: new Set(),
      };
    }
    facilityImpact[destId].impactedTrips++;
    if (trip.priority === "P1") facilityImpact[destId].p1Count++;
    if (trip.priority === "P2") facilityImpact[destId].p2Count++;
    facilityImpact[destId].corridors.add(trip.corridor);
  }

  const rankedFacilities = Object.values(facilityImpact)
    .map((f) => ({
      ...f,
      corridors: [...f.corridors],
      impactScore: f.p1Count * 30 + f.p2Count * 15 + f.impactedTrips * 5,
    }))
    .sort((a, b) => b.impactScore - a.impactScore)
    .map((f, i) => ({ rank: i + 1, ...f }));

  const corridorConflicts = Object.entries(corridorStatus)
    .map(([corridor, status]) => {
      const affected = trips.filter((t) => t.corridor === corridor);
      const atRisk = affected.filter((t) =>
        level >= 3 ? ["P1", "P2"].includes(t.priority) : t.priority === "P1"
      );
      const severity =
        status === "closed" ? "critical" : status === "restricted" ? "high" : "watch";
      return {
        corridor,
        status,
        severity,
        totalTrips: affected.length,
        atRiskTrips: atRisk.length,
        tripIds: atRisk.map((t) => t.id),
        name: corridorName(corridor),
      };
    })
    .filter((c) => c.status !== "open" || c.atRiskTrips > 0)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return {
    level,
    geography: signal.serviceArea,
    summary: buildSummary(rankedTrips, rankedFacilities, corridorConflicts, level),
    rankedTrips,
    rankedFacilities,
    corridorConflicts,
    confidence: { score: 0.8, basis: ["demo scoring", "dispatch manifest", "corridor status"] },
  };
}

function scoreTrip(trip, level, corridorStatus) {
  let conflictScore = PRIORITY_SCORE[trip.priority] || 10;
  const reasons = [];

  const status = corridorStatus[trip.corridor];
  if (status === "closed") {
    conflictScore += 50;
    reasons.push(`${trip.corridor} CLOSED at Level ${level}`);
  } else if (status === "restricted") {
    conflictScore += 30;
    reasons.push(`${trip.corridor} RESTRICTED at Level ${level}`);
  }

  if (/dialysis|oncology/i.test(trip.patientCode)) {
    conflictScore += 15;
    reasons.push("Clinical priority patient (dialysis/oncology)");
  }

  if (trip.priority === "P1") reasons.push("P1 — requires supervisor review");

  return {
    id: trip.id,
    priority: trip.priority,
    pickup: trip.pickup,
    facility: trip.facility,
    facilityId: trip.facilityId,
    corridor: trip.corridor,
    scheduledAt: trip.scheduledAt,
    conflictScore,
    reasons,
  };
}

function corridorName(id) {
  const names = {
    "CORR-01": "Paradise Island Bridge approach",
    "CORR-02": "Eastern Road low segment",
  };
  return names[id] || id;
}

function severityRank(s) {
  return { critical: 3, high: 2, watch: 1 }[s] || 0;
}

function buildSummary(rankedTrips, rankedFacilities, corridorConflicts, level) {
  const top = rankedTrips.slice(0, 3).map((t) => t.id).join(", ") || "none";
  const topFacility = rankedFacilities[0]?.name || "unknown";
  const conflicts = corridorConflicts.filter((c) => c.severity !== "watch").length;
  return (
    `Level ${level} triage: ${rankedTrips.length} trip(s) ranked. ` +
    `Top impacts: ${top}. ` +
    `Primary facility pressure: ${topFacility}. ` +
    `${conflicts} corridor conflict(s) require routing review.`
  );
}
