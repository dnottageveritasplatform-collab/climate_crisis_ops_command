import { getAtRiskTrips, corridorStatusForLevel } from "../../dispatch/index.js";
import { recordActionPack } from "../../audit/index.js";
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
  };
}

function buildActionPack(level, signal, dispatch, commsSop, levelSop) {
  const atRisk = getAtRiskTrips(level);
  const corridorStatus = dispatch.corridorStatus || corridorStatusForLevel(level);
  const corrLines = Object.entries(corridorStatus)
    .map(([id, st]) => `${id}: ${st.toUpperCase()}`)
    .join("; ");

  const checklist = buildChecklist(level, dispatch, atRisk, corridorStatus);
  const hospitalBulletin = buildHospitalBulletin(level, signal, dispatch, atRisk, corrLines, commsSop);
  const driverComms = buildDriverComms(atRisk, level, corridorStatus);

  return {
    level,
    geography: signal.serviceArea,
    summary: `Action pack for Level ${level} ${signal.label}: ${checklist.length} checklist items, COMMS-03 bulletin draft, ${driverComms.length} driver SMS draft(s). HITL required before send.`,
    checklist,
    hospitalBulletin,
    driverComms,
    hitlRequired: true,
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
    task: "Stage COMMS-03 hospital bulletin for liaison HITL approval (draft only — do not send)",
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
    task: "Route dual HITL approval: NEMT supervisor + hospital liaison sign-off",
    owner: "both",
    status: "pending",
  });

  return items;
}

function buildHospitalBulletin(level, signal, dispatch, atRisk, corrLines, commsSop) {
  const subject =
    level >= 3
      ? `URGENT Transport Restriction Notice - Level ${level} - New Providence`
      : `Transport Advisory - Level ${level} ${signal.label} - New Providence`;

  const p1Trips = atRisk.filter((t) => t.priority === "P1");
  const tripList = p1Trips.map((t) => `  • ${t.id}: ${t.pickup} → ${t.facility} via ${t.corridor}`).join("\n");

  const body = [
    `TO: Hospital Transport Liaison — Princess Margaret Hospital`,
    `FROM: Nassau Metro NEMT Dispatch (DEMO)`,
    `RE: ${subject}`,
    ``,
    `Storm escalation: ${signal.event}`,
    `Service area: ${signal.serviceArea}`,
    ``,
    `CORRIDOR STATUS: ${corrLines}`,
    ``,
    `PRIORITY TRANSPORT MANIFEST (${p1Trips.length} P1 trips of ${dispatch.totalTrips} scheduled):`,
    tripList || "  • No P1 trips in current window",
    ``,
    `ESTIMATED IMPACT: Delays possible on restricted corridors. Dialysis and oncology patients flagged for priority routing review.`,
    ``,
    `ACTION REQUESTED: Review attached manifest excerpt. Confirm clinical liaison availability for P1 exceptions if CORR-02 remains restricted.`,
    ``,
    `--- DRAFT ONLY — COMMS-03 — Dual HITL approval required before send ---`,
    `NEMT Supervisor: [ pending ]  |  Hospital Liaison: [ pending ]`,
  ].join("\n");

  return {
    template: "COMMS-03",
    subject,
    body,
    distribution: [
      "Primary: hospital transport liaison (Princess Margaret Hospital)",
      "CC: NEMT dispatch supervisor, on-call clinical coordinator",
    ],
    channel: level >= 3 ? "secure email or operator portal" : "secure email or operator portal",
    hitlRequired: true,
    draftOnly: true,
    sopRef: commsSop.citations?.[0]?.ref || "COMMS-03-DEMO",
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
