import { getAtRiskTrips, corridorStatusForLevel, loadDispatch } from "../../dispatch/index.js";
import { loadGeoLayers, isHospitalPartner } from "../../geo/index.js";
import { recordActionPack } from "../../audit/index.js";
import { stageHitlPack } from "../../hitl/index.js";
import { logAgentEvent } from "../runtime/logger.js";
import { runTool } from "../runtime/tools.js";

/**
 * Day 9 Action agent: operational checklist, COMMS-03 hospital bulletin draft,
 * and driver SMS drafts. Demo mode — template-driven, no LLM required.
 */
export async function runActionPack({ level } = {}) {
  const agent = "action";
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

  const pack = buildActionPack(threshold, signal, dispatch, commsSop, levelSop);

  logAgentEvent("agent_complete", { agent, mode: "demo", message: "Action pack ready" });

  const audit = recordActionPack({ signal, pack, threshold, mode: "demo" });
  const hitl = stageHitlPack(pack, { auditId: audit.id, level: threshold });

  return {
    agent,
    mode: "demo",
    framework: "openclaw-compatible-loop",
    threshold,
    toolResults: [
      { tool: "get_signal_status", result: signal },
      { tool: "summarize_dispatch", args: { level: threshold }, result: dispatch },
      { tool: "query_sop", args: { query: "COMMS-03" }, result: commsSop },
      { tool: "query_sop", args: { query: `Level ${threshold}` }, result: levelSop },
    ],
    pack,
    audit,
    hitl,
  };
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
    summary: `Action pack for Level ${level} ${signal.label}: ${checklist.length} checklist items, ${partnerCount} COMMS-03 bulletin draft(s), ${driverComms.length} driver SMS draft(s). HITL required before send.`,
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
        `--- DRAFT ONLY — COMMS-03 — Dual HITL approval required before send ---`,
        `NEMT Supervisor: [ pending ]  |  Hospital Liaison: [ pending ]`,
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
