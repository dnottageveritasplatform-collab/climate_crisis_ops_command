import { config } from "../../config.js";
import { beginAgentRun, endAgentRun } from "../../efficiency/index.js";
import { getAtRiskTrips, corridorStatusForLevel, loadDispatch } from "../../dispatch/index.js";
import { getLastTriageRanking, loadGeoLayers, isHospitalPartner } from "../../geo/index.js";
import { getShelterFleetStatus } from "../../shelter-fleet/index.js";
import { buildMultiHazardCrossRef } from "../../geo/multi-hazard.js";
import { recordActionPack } from "../../audit/index.js";
import { stageHitlPack } from "../../hitl/index.js";
import { logAgentEvent } from "../runtime/logger.js";
import { callLlmJson, getLlmConfig } from "../runtime/llm.js";
import { runTool } from "../runtime/tools.js";

/**
 * Action agent: operational checklist, COMMS-03 hospital bulletin drafts,
 * and driver SMS drafts. Demo templates by default; LLM when DEMO_MODE=false.
 */
export async function runActionPack({ level } = {}) {
  const agent = "action";
  const startedAt = beginAgentRun(agent);
  logAgentEvent("agent_start", { agent, message: "Action pack started" });

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

  logAgentEvent("tool_call", { agent, tool: "query_sop", args: { query: "COMMS-03" } });
  const commsSop = await runTool("query_sop", { query: "COMMS-03" });
  logAgentEvent("tool_result", {
    agent,
    tool: "query_sop",
    args: { query: "COMMS-03" },
    result: commsSop,
  });

  logAgentEvent("tool_call", { agent, tool: "query_sop", args: { query: `Level ${threshold}` } });
  const levelSop = await runTool("query_sop", { query: `Level ${threshold}` });
  logAgentEvent("tool_result", {
    agent,
    tool: "query_sop",
    args: { query: `Level ${threshold}` },
    result: levelSop,
  });

  let multiHazard = null;
  if (threshold >= 2) {
    logAgentEvent("tool_call", { agent, tool: "get_multi_hazard_status", args: {} });
    multiHazard = await runTool("get_multi_hazard_status", {});
    logAgentEvent("tool_result", {
      agent,
      tool: "get_multi_hazard_status",
      args: {},
      result: multiHazard,
    });
  }

  const toolResults = [
    { tool: "get_signal_status", result: signal },
    { tool: "summarize_dispatch", args: { level: threshold }, result: dispatch },
    { tool: "query_sop", args: { query: "COMMS-03" }, result: commsSop },
    { tool: "query_sop", args: { query: `Level ${threshold}` }, result: levelSop },
  ];
  if (multiHazard) {
    toolResults.push({ tool: "get_multi_hazard_status", result: multiHazard });
  }

  const demoPack = buildActionPack(threshold, signal, dispatch, commsSop, levelSop);
  let pack = demoPack;
  let mode = "demo";
  const llm = getLlmConfig();

  if (llm.enabled && !config.demoMode) {
    try {
      const triage = getLastTriageRanking();
      const llmPack = await llmActionPack({ toolResults, triage, threshold, llm });
      pack = mergeLlmActionPack(demoPack, llmPack, commsSop);
      mode = llm.provider;
    } catch (err) {
      console.warn("[action] LLM pack failed, using demo templates:", err.message);
    }
  }

  logAgentEvent("agent_complete", { agent, mode, message: "Action pack ready" });

  const audit = recordActionPack({ signal, pack, threshold, mode });
  const hitl = stageHitlPack(pack, { auditId: audit.id, level: threshold });
  const efficiency = endAgentRun(agent, mode, startedAt);

  return {
    agent,
    mode,
    framework: "openclaw-compatible-loop",
    threshold,
    toolResults,
    pack,
    audit,
    hitl,
    efficiency,
  };
}

const ACTION_LLM_SYSTEM = `You are the Action agent for Climate & Crisis Ops Command (Nassau Metro NEMT + hospital partners).
Given tool results (signals, dispatch manifest, SOP citations) and optional triage ranking, produce an operational action pack as JSON.

Required keys:
- summary (string): one paragraph for dispatch supervisors
- checklist (array): { id, task, owner, status } — owner is nemt_supervisor | dispatch | all; status pending
- hospitalBulletins (array): { facilityId, subject, body } — facilityId FAC-01 (Princess Margaret) or FAC-04 (Doctor's Hospital)
- driverComms (array): { tripId, draft } — SMS text for at-risk trips only

Rules:
- When get_multi_hazard_status is present, embed fused hazard + routing advisories in driver SMS (flood/wind exposure, alternate route headline)
- When fused briefing includes avoidanceRoute.turnByTurn, append segment-level turn-by-turn steps in driver SMS drafts only (HITL-gated)
- Use exact trip IDs, corridor IDs (CORR-01, CORR-02), and facility IDs from tool results
- Draft COMMS-03 hospital bulletins per partner; cite corridor status and P1 dialysis/oncology trips
- End each bulletin body with: "--- DRAFT ONLY — COMMS-03 — Triple HITL approval required before send ---"
- Do not claim messages were sent; all outputs are drafts pending human approval
- Reference SOP citations from query_sop results where relevant`;

async function llmActionPack({ toolResults, triage, threshold, llm }) {
  const context = {
    threshold,
    toolResults,
    triageRanking: triage
      ? {
          summary: triage.summary,
          topTrips: triage.rankedTrips?.slice(0, 8),
          corridorConflicts: triage.corridorConflicts,
          rankedFacilities: triage.rankedFacilities?.filter((f) => f.hitlRequired),
        }
      : null,
  };

  const { json } = await callLlmJson({
    llm,
    agent: "action",
    system: ACTION_LLM_SYSTEM,
    user: `Generate action pack JSON from this context:\n${JSON.stringify(context, null, 2)}`,
  });
  return json;
}

/** Merge LLM narrative onto deterministic pack skeleton (preserves facilityId, HITL metadata). */
function mergeLlmActionPack(demoPack, llmPack, commsSop) {
  const pack = structuredClone(demoPack);

  if (typeof llmPack.summary === "string" && llmPack.summary.trim()) {
    pack.summary = llmPack.summary.trim();
  }

  if (Array.isArray(llmPack.checklist) && llmPack.checklist.length) {
    const byId = Object.fromEntries(llmPack.checklist.filter((c) => c.id).map((c) => [c.id, c]));
    pack.checklist = pack.checklist.map((item, i) => {
      const llmItem = byId[item.id] || llmPack.checklist[i];
      if (!llmItem?.task) return item;
      return {
        ...item,
        task: String(llmItem.task),
        owner: llmItem.owner || item.owner,
        status: llmItem.status || item.status,
      };
    });
  }

  if (Array.isArray(llmPack.hospitalBulletins)) {
    for (const llmBulletin of llmPack.hospitalBulletins) {
      const idx = pack.hospitalBulletins.findIndex((b) => b.facilityId === llmBulletin.facilityId);
      if (idx < 0) continue;
      if (llmBulletin.subject) pack.hospitalBulletins[idx].subject = String(llmBulletin.subject);
      if (llmBulletin.body) pack.hospitalBulletins[idx].body = String(llmBulletin.body);
    }
  }

  if (Array.isArray(llmPack.driverComms)) {
    const byTrip = Object.fromEntries(
      llmPack.driverComms.filter((d) => d.tripId).map((d) => [d.tripId, d])
    );
    pack.driverComms = pack.driverComms.map((d) => {
      const llmSms = byTrip[d.tripId];
      if (!llmSms?.draft) return d;
      return { ...d, draft: String(llmSms.draft), llmEdited: true };
    });
  }

  pack.hospitalBulletin = buildCombinedHospitalBulletin(pack.hospitalBulletins, pack.level, commsSop);
  return pack;
}

function fusedBriefingMap(level) {
  if (level < 2) return {};
  const crossRef = buildMultiHazardCrossRef(level);
  return Object.fromEntries((crossRef.tripBriefings || []).map((t) => [t.tripId, t]));
}

function formatFusionForDriver(fusion) {
  if (!fusion) return null;
  const parts = [];
  if (fusion.hazardTypes?.length) {
    parts.push(`Exposure: ${fusion.hazardTypes.join(" + ")}`);
  }
  if (fusion.floodExposure?.zoneId) {
    const depth = fusion.floodExposure.depthInches ? ` (${fusion.floodExposure.depthInches}" depth)` : "";
    parts.push(`Flood zone ${fusion.floodExposure.zoneId}${depth}`);
  }
  if (fusion.windExposure?.zoneId) {
    const gust = fusion.windExposure.gustMph ? `${fusion.windExposure.gustMph} mph gusts · ` : "";
    parts.push(`Wind ${gust}${fusion.windExposure.zoneId}`);
  }
  if (fusion.routingAdvisory?.alternateName) {
    parts.push(`Alternate route: ${fusion.routingAdvisory.alternateName}`);
  }
  if (fusion.routingAdvisory?.advisory) {
    parts.push(fusion.routingAdvisory.advisory);
  }
  return parts.join(" ");
}

function formatTurnByTurnForDriver(fusion) {
  const turns = fusion?.avoidanceRoute?.turnByTurn;
  if (!turns?.length) return null;
  const condensed = turns.map((step) => step.replace(/^\d+\.\s*/, "")).join(" → ");
  return `Turn-by-turn: ${condensed}`;
}

function formatFusionForHospital(fusion) {
  if (!fusion) return null;
  const hazards = fusion.hazardTypes?.length ? fusion.hazardTypes.join("+") : "routing";
  const alt = fusion.routingAdvisory?.alternateName ? ` · alt ${fusion.routingAdvisory.alternateName}` : "";
  return `  • ${fusion.tripId}: ${fusion.corridor} · ${hazards}${alt} (${fusion.compositeRisk})`;
}

function buildActionPack(level, signal, dispatch, commsSop, levelSop) {
  const atRisk = getAtRiskTrips(level);
  const corridorStatus = dispatch.corridorStatus || corridorStatusForLevel(level);
  const corrLines = Object.entries(corridorStatus)
    .map(([id, st]) => `${id}: ${st.toUpperCase()}`)
    .join("; ");
  const fusedByTrip = fusedBriefingMap(level);
  const fusedCount = Object.keys(fusedByTrip).length;

  const checklist = buildChecklist(level, dispatch, atRisk, corridorStatus, fusedCount);
  const hospitalBulletins = buildHospitalBulletins(
    level,
    signal,
    dispatch,
    atRisk,
    corrLines,
    commsSop,
    fusedByTrip
  );
  const hospitalBulletin = buildCombinedHospitalBulletin(hospitalBulletins, level, commsSop);
  const driverComms = buildDriverComms(atRisk, level, corridorStatus, fusedByTrip);
  const shelterFleet = level >= 2 ? getShelterFleetStatus() : null;
  const { shelterRoutingBrief, fleetAllocationBrief } = buildShelterFleetBriefs(
    level,
    signal,
    atRisk,
    corrLines,
    shelterFleet
  );
  const extendedHitlRequired = level >= 2 && Boolean(shelterRoutingBrief && fleetAllocationBrief);

  const partnerCount = hospitalBulletins.length;
  const hitlLabel = extendedHitlRequired
    ? "Extended HITL (5 roles): NEMT + hospital liaisons + shelter coordinator + fleet logistics"
    : "Triple HITL: NEMT supervisor + both hospital liaisons";

  return {
    level,
    geography: signal.serviceArea,
    summary: `Level ${level} ${signal.label} action pack — ${checklist.length} dispatch checklist items, ${partnerCount} hospital COMMS-03 draft(s) (PMH + Doctor's), ${driverComms.length} driver SMS draft(s)${fusedCount ? ` with ${fusedCount} hazard-fusion advisory(ies)` : ""}. ${hitlLabel} must approve before send.`,
    checklist,
    hospitalBulletins,
    hospitalBulletin,
    driverComms,
    multiHazardFusion: fusedCount
      ? {
          fusedTripCount: fusedCount,
          criticalTripCount: Object.values(fusedByTrip).filter((t) => t.compositeRisk === "critical").length,
          scopeGuard: "Driver SMS + COMMS embed fused advisories — drafts only until HITL release",
        }
      : null,
    shelterRoutingBrief,
    fleetAllocationBrief,
    extendedHitlRequired,
    hitlRequired: true,
    hospitalPartners: hospitalBulletins.map((b) => ({
      id: b.facilityId,
      name: b.facilityName,
      partnerType: b.partnerType,
    })),
    sopCitations: [
      ...(commsSop.citations?.slice(0, 2) || []),
      ...(levelSop.citations?.slice(0, 2) || []),
    ],
  };
}

function buildChecklist(level, dispatch, atRisk, corridorStatus, fusedCount = 0) {
  const items = [
    {
      id: "CHK-01",
      task: "Export 24h manifest; tag dialysis/oncology trips as PRIORITY",
      owner: "nemt_supervisor",
      status: "pending",
    },
    {
      id: "CHK-02",
      task: `Review ${atRisk.length} at-risk trip(s) against corridor status before dispatch release`,
      owner: "nemt_supervisor",
      status: "pending",
    },
  ];

  if (corridorStatus["CORR-02"] === "restricted") {
    items.push({
      id: "CHK-03",
      task: "Confirm CORR-02 Eastern Road restriction with drivers assigned to CORR-02 routes",
      owner: "nemt_supervisor",
      status: "pending",
    });
  }

  items.push({
    id: "CHK-04",
    task: "Stage COMMS-03 hospital bulletins for liaison HITL approval — all impacted partners (draft only — do not send)",
    owner: "nemt_supervisor",
    status: "pending",
  });

  items.push({
    id: "CHK-05",
    task: fusedCount
      ? `SMS pre-notify ${atRisk.length} P1 patient(s) — ${fusedCount} include fused flood/wind + alternate route advisories (HITL before send)`
      : `SMS pre-notify ${atRisk.length} P1 patient(s) in first 12h window`,
    owner: "dispatch",
    status: "pending",
  });

  if (level >= 2) {
    items.push({
      id: "CHK-06",
      task: "Hold P3/P4 non-critical trips unless supervisor approves exception",
      owner: "nemt_supervisor",
      status: "pending",
    });
  }

  items.push({
    id: "CHK-07",
    task: level >= 2
      ? "Route extended HITL approval: NEMT + hospital liaisons + shelter coordinator + fleet logistics"
      : "Route triple HITL approval: NEMT supervisor + PMH liaison + Doctor's Hospital liaison sign-off",
    owner: "all",
    status: "pending",
  });

  if (level >= 2) {
    items.push({
      id: "CHK-08",
      task: "Confirm shelter routing draft with National Gymnasium coordinator (extended HITL)",
      owner: "shelter_coordinator",
      status: "pending",
    });
    items.push({
      id: "CHK-09",
      task: "Confirm fleet asset allocation for CORR-02 restricted corridor (extended HITL)",
      owner: "fleet_logistics",
      status: "pending",
    });
  }

  return items;
}

function buildShelterFleetBriefs(level, signal, atRisk, corrLines, shelterFleet) {
  if (level < 2 || !shelterFleet?.ok) {
    return { shelterRoutingBrief: null, fleetAllocationBrief: null };
  }

  const nearCapacity = shelterFleet.nearCapacityShelters?.[0];
  const stagingFleet = shelterFleet.fleetSummary?.filter((f) => f.status !== "available") || [];

  const shelterRoutingBrief = {
    template: "SHELTER-ROUTE",
    subject: `Shelter routing coordination — Level ${level} ${signal.label}`,
    body: [
      `TO: Shelter Coordinator — National Gymnasium / parish overflow network`,
      `FROM: CCOC Action agent (DEMO)`,
      `RE: At-risk NEMT trip corridor sync · ${corrLines}`,
      ``,
      `Shelters online: ${shelterFleet.shelterCount} · accepting: ${shelterFleet.acceptingShelters}`,
      nearCapacity
        ? `Near capacity: ${nearCapacity.name} (${nearCapacity.availableBeds} beds) on ${nearCapacity.corridor}`
        : "No shelters at near-capacity threshold",
      ``,
      `At-risk trips requiring corridor review: ${atRisk.length}`,
      `Coordinate non-medical evacuee routing separately from NEMT dialysis/oncology manifest.`,
      ``,
      `--- DRAFT ONLY — Extended HITL — Shelter coordinator must approve before routing orders ---`,
    ].join("\n"),
    hitlRequired: true,
    draftOnly: true,
    role: "shelter_coordinator",
  };

  const fleetAllocationBrief = {
    template: "FLEET-ALLOC",
    subject: `Fleet asset allocation — Level ${level} corridor restrictions`,
    body: [
      `TO: Fleet Logistics Lead`,
      `FROM: CCOC Action agent (DEMO)`,
      `RE: Wheelchair vans + evacuation bus staging · ${corrLines}`,
      ``,
      `Fleet assets tracked: ${shelterFleet.fleetCount} · available: ${shelterFleet.availableFleetAssets}`,
      stagingFleet.length
        ? `Committed/staging: ${stagingFleet.map((f) => `${f.assetId} (${f.status}) on ${f.corridor}`).join("; ")}`
        : "All tracked assets available",
      ``,
      `Hold non-essential repositioning until hospital COMMS-03 cycle completes.`,
      ``,
      `--- DRAFT ONLY — Extended HITL — Fleet logistics must approve before asset orders ---`,
    ].join("\n"),
    hitlRequired: true,
    draftOnly: true,
    role: "fleet_logistics",
  };

  return { shelterRoutingBrief, fleetAllocationBrief };
}

function buildHospitalBulletins(level, signal, dispatch, atRisk, corrLines, commsSop, fusedByTrip = {}) {
  const { facilities } = loadGeoLayers();
  const allTrips = loadDispatch();
  const hospitals = facilities.features.filter((f) => isHospitalPartner(f.properties.role));

  return hospitals
    .map((h) => {
      const facilityId = h.properties.id;
      const facilityName = h.properties.name;
      const partnerType = h.properties.role === "hospital_partner_private" ? "private" : "public";
      const facilityTrips = allTrips.filter((t) => t.facilityId === facilityId);
      if (!facilityTrips.length) return null;

      const p1Trips = facilityTrips.filter((t) => t.priority === "P1");
      const atRiskToFacility = atRisk.filter((t) => t.facilityId === facilityId);
      const fusedLines = atRiskToFacility
        .map((t) => formatFusionForHospital(fusedByTrip[t.id]))
        .filter(Boolean);
      const tripList = p1Trips
        .map((t) => `  • ${t.id}: ${t.pickup} → ${t.facility} via ${t.corridor}`)
        .join("\n");

      const subject =
        level >= 3
          ? `URGENT Transport Restriction Notice - Level ${level} - ${facilityName}`
          : `Transport Advisory - Level ${level} ${signal.label} - ${facilityName}`;

      const partnerLabel = partnerType === "private" ? "Private hospital partner" : "Public hospital partner";

      const body = [
        `TO: Hospital Transport Liaison — ${facilityName}`,
        `PARTNER TYPE: ${partnerLabel}`,
        `FROM: Nassau Metro NEMT Dispatch (DEMO)`,
        `RE: ${subject}`,
        ``,
        `Storm escalation: ${signal.event}`,
        `Service area: ${signal.serviceArea}`,
        ``,
        `CORRIDOR STATUS: ${corrLines}`,
        ``,
        `PRIORITY TRANSPORT MANIFEST (${p1Trips.length} P1 trips of ${facilityTrips.length} scheduled to ${facilityName}):`,
        tripList || "  • No P1 trips in current window",
        atRiskToFacility.length
          ? `At-risk trips to this facility: ${atRiskToFacility.map((t) => t.id).join(", ")}`
          : "",
        fusedLines.length
          ? `FUSED HAZARD + ROUTING ADVISORIES (drivers receive matching SMS after HITL):\n${fusedLines.join("\n")}`
          : "",
        ``,
        `ESTIMATED IMPACT: Delays possible on restricted corridors. Dialysis and oncology patients flagged for priority routing review.`,
        ``,
        `ACTION REQUESTED: Review manifest excerpt for ${facilityName}. Confirm clinical liaison availability for P1 exceptions if CORR-02 remains restricted.`,
        ``,
        `--- DRAFT ONLY — COMMS-03 — Triple HITL approval required before send ---`,
        `NEMT Supervisor (Maria Clarke): [ pending ]  |  PMH Liaison (James Rolle): [ pending ]  |  Doctor's Liaison (Dr. Elaine Moss): [ pending ]`,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        template: "COMMS-03",
        facilityId,
        facilityName,
        partnerType,
        subject,
        body,
        distribution: [
          `Primary: hospital transport liaison (${facilityName} — ${partnerType})`,
          "CC: NEMT dispatch supervisor, on-call clinical coordinator",
        ],
        channel: "secure email or operator portal",
        hitlRequired: true,
        draftOnly: true,
        sopRef: commsSop.citations?.[0]?.ref || "COMMS-03-DEMO",
        p1Count: p1Trips.length,
        scheduledCount: facilityTrips.length,
      };
    })
    .filter(Boolean);
}

function buildCombinedHospitalBulletin(bulletins, level, commsSop) {
  if (!bulletins.length) {
    return {
      template: "COMMS-03",
      subject: "Transport Advisory — no hospital partners in manifest",
      body: "No hospital partner trips scheduled.",
      hitlRequired: true,
      draftOnly: true,
      sopRef: commsSop.citations?.[0]?.ref || "COMMS-03-DEMO",
    };
  }

  if (bulletins.length === 1) {
    return { ...bulletins[0], combined: false };
  }

  const subject =
    level >= 3
      ? `URGENT Transport Restriction Notice - Level ${level} - New Providence (Multi-Partner)`
      : `Transport Advisory - Level ${level} - New Providence (Multi-Partner)`;

  const body = bulletins
    .map((b, i) => `[${i + 1}/${bulletins.length}] ${b.facilityName} (${b.partnerType})\n\n${b.body}`)
    .join("\n\n" + "=".repeat(60) + "\n\n");

  return {
    template: "COMMS-03",
    subject,
    body,
    combined: true,
    distribution: bulletins.flatMap((b) => b.distribution),
    channel: "secure email or operator portal",
    hitlRequired: true,
    draftOnly: true,
    sopRef: commsSop.citations?.[0]?.ref || "COMMS-03-DEMO",
    partnerCount: bulletins.length,
  };
}

function buildDriverComms(atRisk, level, corridorStatus, fusedByTrip = {}) {
  return atRisk.map((trip) => {
    const fusion = fusedByTrip[trip.id];
    const fusionHeadline = formatFusionForDriver(fusion);
    const turnByTurn = formatTurnByTurnForDriver(fusion);
    const corrNote = corridorStatus[trip.corridor];
    let routeNote = "";
    if (fusionHeadline) {
      routeNote = fusionHeadline;
    } else if (corrNote === "restricted") {
      routeNote = `${trip.corridor} is RESTRICTED at Level ${level}. Confirm alternate routing with dispatch before departure.`;
    } else if (corrNote === "closed") {
      routeNote = `${trip.corridor} is CLOSED. Do not proceed — await supervisor callback.`;
    } else {
      routeNote = `Monitor ${trip.corridor} status; conditions may change.`;
    }

    const draft = [
      `Nassau Metro NEMT (DEMO): Storm Level ${level} advisory for trip ${trip.id}.`,
      `Pickup: ${trip.pickup}. Priority: ${trip.priority}.`,
      routeNote,
      turnByTurn,
      `Reply ACK to confirm receipt or CALL dispatch for routing update.`,
      `--- DRAFT SMS — Triple/Extended HITL approval required before send ---`,
    ].filter(Boolean).join(" ");

    return {
      tripId: trip.id,
      priority: trip.priority,
      pickup: trip.pickup,
      corridor: trip.corridor,
      channel: "SMS",
      draft,
      fusedBriefing: fusion
        ? {
            compositeRisk: fusion.compositeRisk,
            hazardTypes: fusion.hazardTypes,
            briefingLine: fusion.briefingLine,
            alternateRoute: fusion.routingAdvisory?.alternateName || null,
            turnByTurnSteps: fusion.avoidanceRoute?.stepCount || null,
            turnByTurn: fusion.avoidanceRoute?.turnByTurn || null,
          }
        : null,
      status: "draft_pending_hitl",
    };
  });
}
