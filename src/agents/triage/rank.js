import { config } from "../../config.js";
import { beginAgentRun, endAgentRun } from "../../efficiency/index.js";
import { corridorStatusForLevel, loadDispatch } from "../../dispatch/index.js";
import { buildMapLayersFromTriage, loadGeoLayers, isHospitalPartner, setLastTriageRanking } from "../../geo/index.js";
import { recordTriageRank } from "../../audit/index.js";
import { logAgentEvent } from "../runtime/logger.js";
import { callLlmJson, getLlmConfig } from "../runtime/llm.js";
import { runTool } from "../runtime/tools.js";

const PRIORITY_SCORE = { P1: 100, P2: 70, P3: 40, P4: 20 };

/**
 * Triage agent: rank impacted trips, facilities, and corridor conflicts.
 * Deterministic scoring + map sync; LLM enriches summary and trip reasons when LLM mode on.
 */
export async function runTriageRank({ level } = {}) {
  const agent = "triage";
  const startedAt = beginAgentRun(agent);
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

  const toolResults = [
    { tool: "get_signal_status", result: signal },
    { tool: "summarize_dispatch", args: { level: threshold }, result: dispatch },
  ];

  const demoRanking = buildTriageRanking(threshold, signal, dispatch);
  let ranking = demoRanking;
  let mode = "demo";
  const llm = getLlmConfig();

  if (llm.enabled && !config.demoMode) {
    try {
      const llmRanking = await llmTriageRank({ toolResults, demoRanking, threshold, llm });
      ranking = mergeLlmTriageRanking(demoRanking, llmRanking);
      mode = llm.provider;
    } catch (err) {
      console.warn("[triage] LLM rank failed, using demo scoring:", err.message);
    }
  }

  setLastTriageRanking(ranking);
  const map = buildMapLayersFromTriage(ranking);

  logAgentEvent("agent_complete", { agent, mode, message: "Triage rank ready" });

  const audit = recordTriageRank({ signal, ranking, threshold, mode });
  const efficiency = endAgentRun(agent, mode, startedAt);

  return {
    agent,
    mode,
    framework: "openclaw-compatible-loop",
    threshold,
    toolResults,
    ranking,
    map,
    audit,
    efficiency,
  };
}

const TRIAGE_LLM_SYSTEM = `You are the Triage agent for Climate & Crisis Ops Command (Nassau Metro NEMT + hospital partners).
Given tool results and a pre-computed deterministic ranking, produce JSON that ENRICHES the ranking — do NOT reorder trips or change ranks/scores.

Required keys:
- summary (string): 2-3 sentence multi-agency triage narrative citing top trip IDs, hospital partner pressure, and corridor conflicts
- rankedTrips (array): { id, reasons } — id must match existing trip IDs; reasons is 1-3 short strings explaining priority (corridor, P1, clinical)
- corridorNotes (optional array): { corridor, note } — brief analyst note for CORR-01/CORR-02 conflicts

Rules:
- Use exact trip IDs (T-1001 etc.), corridor IDs, and facility names from tool results and demoRanking
- Do not invent trips or change rank order
- Mention PMH (Princess Margaret) and Doctor's Hospital when relevant
- Flag CORR-02 restricted and dialysis/oncology P1 trips explicitly when present`;

async function llmTriageRank({ toolResults, demoRanking, threshold, llm }) {
  const context = {
    threshold,
    toolResults,
    deterministicRanking: {
      summary: demoRanking.summary,
      rankedTrips: demoRanking.rankedTrips.slice(0, 12),
      rankedFacilities: demoRanking.rankedFacilities,
      corridorConflicts: demoRanking.corridorConflicts,
    },
  };

  const { json } = await callLlmJson({
    llm,
    agent: "triage",
    system: TRIAGE_LLM_SYSTEM,
    user: `Enrich triage ranking JSON from this context:\n${JSON.stringify(context, null, 2)}`,
  });
  return json;
}

/** Overlay LLM narrative onto deterministic ranking (ranks/scores/map pins unchanged). */
function mergeLlmTriageRanking(demoRanking, llmRanking) {
  const ranking = structuredClone(demoRanking);

  if (typeof llmRanking.summary === "string" && llmRanking.summary.trim()) {
    ranking.summary = llmRanking.summary.trim();
  }

  if (Array.isArray(llmRanking.rankedTrips)) {
    const byId = Object.fromEntries(
      llmRanking.rankedTrips.filter((t) => t.id).map((t) => [t.id, t])
    );
    ranking.rankedTrips = ranking.rankedTrips.map((trip) => {
      const llmTrip = byId[trip.id];
      if (!llmTrip?.reasons) return trip;
      const reasons = Array.isArray(llmTrip.reasons)
        ? llmTrip.reasons.map(String).filter(Boolean)
        : [String(llmTrip.reasons)];
      return reasons.length ? { ...trip, reasons } : trip;
    });
  }

  if (Array.isArray(llmRanking.corridorNotes)) {
    const notes = Object.fromEntries(
      llmRanking.corridorNotes.filter((c) => c.corridor).map((c) => [c.corridor, c.note])
    );
    ranking.corridorConflicts = ranking.corridorConflicts.map((c) =>
      notes[c.corridor] ? { ...c, analystNote: String(notes[c.corridor]) } : c
    );
  }

  ranking.confidence = {
    score: 0.85,
    basis: ["deterministic scoring", "dispatch manifest", "corridor status", "llm enrichment"],
  };

  return ranking;
}

function buildTriageRanking(level, signal, dispatch) {
  const corridorStatus = dispatch.corridorStatus || corridorStatusForLevel(level);
  const trips = loadDispatch();
  const { facilities } = loadGeoLayers();
  const facilityNames = Object.fromEntries(
    facilities.features.map((f) => [f.properties.id, f.properties.name])
  );
  const facilityRoles = Object.fromEntries(
    facilities.features.map((f) => [f.properties.id, f.properties.role])
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
    .map((f) => {
      const role = facilityRoles[f.id] || "destination";
      return {
        ...f,
        role,
        hitlRequired: isHospitalPartner(role),
        corridors: [...f.corridors],
        impactScore: f.p1Count * 30 + f.p2Count * 15 + f.impactedTrips * 5,
      };
    })
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
  const hospitalPartners = rankedFacilities
    .filter((f) => f.role === "hospital_partner" || f.role === "hospital_partner_private")
    .map((f) => f.name)
    .slice(0, 2)
    .join(" + ");
  const conflicts = corridorConflicts.filter((c) => c.severity !== "watch").length;
  return (
    `Level ${level} multi-agency triage: ${rankedTrips.length} trip(s) ranked across NEMT + hospital partners. ` +
    `Highest priority: ${top}. ` +
    `Hospital pressure: ${hospitalPartners || rankedFacilities[0]?.name || "unknown"}. ` +
    `${conflicts} corridor conflict(s) — liaisons must review before COMMS-03 release.`
  );
}
