import { config } from "../../config.js";
import { beginAgentRun, endAgentRun } from "../../efficiency/index.js";
import { getAtRiskTrips, corridorStatusForLevel, loadDispatch } from "../../dispatch/index.js";
import { getLastTriageRanking, loadGeoLayers, isHospitalPartner } from "../../geo/index.js";
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

  const toolResults = [
    { tool: "get_signal_status", result: signal },
    { tool: "summarize_dispatch", args: { level: threshold }, result: dispatch },
    { tool: "query_sop", args: { query: "COMMS-03" }, result: commsSop },
    { tool: "query_sop", args: { query: `Level ${threshold}` }, result: levelSop },
  ];

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
      return { ...d, draft: String(llmSms.draft) };
    });
  }

  pack.hospitalBulletin = buildCombinedHospitalBulletin(pack.hospitalBulletins, pack.level, commsSop);
  return pack;
}

function buildActionPack(level, signal, dispatch, commsSop, levelSop) {
  const atRisk = getAtRiskTrips(level);
  const corridorStatus = dispatch.corridorStatus || corridorStatusForLevel(level);
  const corrLines = Object.entries(corridorStatus)
    .map(([id, st]) => `${id}: ${st.toUpperCase()}`)
    .join("; ");

  const checklist = buildChecklist(level, dispatch, atRisk, corridorStatus);
  const hospitalBulletins = buildHospitalBulletins(level, signal, dispatch, atRisk, corrLines, commsSop);
  const hospitalBulletin = buildCombinedHospitalBulletin(hospitalBulletins, level, commsSop);
  const driverComms = buildDriverComms(atRisk, level, corridorStatus);

  const partnerCount = hospitalBulletins.length;

  return {
    level,
    geography: signal.serviceArea,
    summary: `Level ${level} ${signal.label} action pack — ${checklist.length} dispatch checklist items, ${partnerCount} hospital COMMS-03 draft(s) (PMH + Doctor's), ${driverComms.length} driver SMS draft(s). Triple HITL: NEMT supervisor + both hospital liaisons must approve before send.`,
    checklist,
    hospitalBulletins,
    hospitalBulletin,
    driverComms,
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

function buildChecklist(level, dispatch, atRisk, corridorStatus) {
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
    task: `SMS pre-notify ${atRisk.length} P1 patient(s) in first 12h window`,
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
    task: "Route triple HITL approval: NEMT supervisor + PMH liaison + Doctor's Hospital liaison sign-off",
    owner: "all",
    status: "pending",
  });

  return items;
}

function buildHospitalBulletins(level, signal, dispatch, atRisk, corrLines, commsSop) {
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

function buildDriverComms(atRisk, level, corridorStatus) {
  return atRisk.map((trip) => {
    const corrNote = corridorStatus[trip.corridor];
    let routeNote = "";
    if (corrNote === "restricted") {
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
      `Reply ACK to confirm receipt or CALL dispatch for routing update.`,
    ].join(" ");

    return {
      tripId: trip.id,
      priority: trip.priority,
      pickup: trip.pickup,
      corridor: trip.corridor,
      channel: "SMS",
      draft,
      status: "draft_pending_hitl",
    };
  });
}
