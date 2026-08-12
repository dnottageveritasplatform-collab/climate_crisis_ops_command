/** Phase 2 Day 2 — EMS-adjacent transport desk (read-only hospital + handoff signals). */

import { getAtRiskTrips } from "../dispatch/index.js";
import { getCadOverlay } from "../cad/index.js";
import { loadHandoffQueueFeed, loadHospitalDeskFeed } from "./adapters/json.js";
import { acceptNemtHandoffs, getLastHandoffWriteBack, NEMT_WRITEBACK_SCOPE_GUARD } from "./writeback.js";

export const TRANSPORT_DESK_SCOPE_GUARD =
  "Transport desk — scheduled inter-facility handoffs; pilot NEMT accept write-back (Day 4). Not 911 PSAP.";

export const PHASE2_HITL_PERSONAS_ACTIVE = [
  { id: "shelter_coordinator", title: "Shelter Coordinator", status: "active", phase: "phase-2-day-7" },
  { id: "fleet_logistics", title: "Fleet Logistics", status: "active", phase: "phase-2-day-7" },
];

let cachedDesk = null;

function bedPressureColor(level) {
  if (level === "critical" || level === "high") return "#ff6b6b";
  if (level === "elevated") return "#ffb347";
  return "#5fd4a4";
}

function diversionLabel(status) {
  const labels = {
    open: "Open",
    watch: "Diversion watch",
    partial: "Partial diversion",
    closed: "Diversion active",
  };
  return labels[status] || status;
}

export function ingestTransportDeskFeed(source = "json") {
  const hospitalFeed = loadHospitalDeskFeed();
  const handoffFeed = loadHandoffQueueFeed();

  cachedDesk = {
    hospitals: hospitalFeed.hospitals || [],
    handoffQueue: handoffFeed.queue || [],
    hospitalCount: (hospitalFeed.hospitals || []).length,
    handoffCount: (handoffFeed.queue || []).length,
    source,
    ingestedAt: new Date().toISOString(),
    scopeGuard: TRANSPORT_DESK_SCOPE_GUARD,
  };
  return cachedDesk;
}

export function getTransportDeskOverlay({ refresh = false } = {}) {
  if (!cachedDesk || refresh) ingestTransportDeskFeed("json");
  const pendingHandoffs = cachedDesk.handoffQueue.filter((h) =>
    ["pending_nemt_accept", "pending_ems_release"].includes(h.status)
  );
  const assignedHandoffs = cachedDesk.handoffQueue.filter((h) => h.status === "nemt_assigned");

  return {
    ok: true,
    phase: "phase-2-day-4",
    mode: pendingHandoffs.length > 0 ? "read_with_writeback" : "writeback_pilot",
    scopeGuard: TRANSPORT_DESK_SCOPE_GUARD,
    writeBackScopeGuard: NEMT_WRITEBACK_SCOPE_GUARD,
    writeBackEnabled: true,
    adapter: process.env.TRANSPORT_DESK_URL ? "rest" : "json",
    ...cachedDesk,
    pendingHandoffs: pendingHandoffs.length,
    assignedHandoffs: assignedHandoffs.length,
    hitlPersonasActive: PHASE2_HITL_PERSONAS_ACTIVE,
  };
}

/** Compact hospital desk status for Monitor agent tool. */
export function getTransportDeskStatus() {
  const desk = getTransportDeskOverlay();
  const highPressure = desk.hospitals.filter((h) =>
    ["high", "critical"].includes(h.bedPressureLevel)
  );
  const electiveHolds = desk.hospitals.filter((h) => h.electiveHold);
  const diversions = desk.hospitals.filter((h) => h.diversionStatus !== "open");

  return {
    ok: true,
    phase: "phase-2-day-4",
    hospitalCount: desk.hospitalCount,
    handoffQueueCount: desk.handoffCount,
    pendingHandoffs: desk.pendingHandoffs,
    highPressureHospitals: highPressure.map((h) => ({
      facilityId: h.facilityId,
      name: h.name,
      bedPressurePct: h.bedPressurePct,
      bedPressureLevel: h.bedPressureLevel,
    })),
    electiveHolds: electiveHolds.map((h) => ({
      facilityId: h.facilityId,
      name: h.name,
      reason: h.electiveHoldReason || h.notes,
    })),
    diversionAlerts: diversions.map((h) => ({
      facilityId: h.facilityId,
      name: h.name,
      diversionStatus: h.diversionStatus,
      label: diversionLabel(h.diversionStatus),
    })),
    writeBackEnabled: true,
    scopeGuard: TRANSPORT_DESK_SCOPE_GUARD,
    ingestedAt: desk.ingestedAt,
  };
}

export function buildHandoffCrossReference(level = 2) {
  const desk = getTransportDeskOverlay();
  const atRisk = getAtRiskTrips(level);
  const atRiskIds = new Set(atRisk.map((t) => t.id));
  const tripById = Object.fromEntries(atRisk.map((t) => [t.id, t]));

  const matches = [];
  const queueOnly = [];

  for (const handoff of desk.handoffQueue) {
    const linked = handoff.linkedTripId;
    if (linked && atRiskIds.has(linked)) {
      const trip = tripById[linked];
      matches.push({
        handoffId: handoff.handoffId,
        linkedTripId: linked,
        tripPriority: trip.priority,
        pickup: trip.pickup,
        facility: trip.facility,
        emsRunId: handoff.emsRunId,
        nemtRunId: handoff.nemtRunId,
        acceptedAt: handoff.acceptedAt,
        writeBackSource: handoff.writeBackSource,
        status: handoff.status,
        patientClass: handoff.patientClass,
        origin: handoff.origin,
        destination: handoff.destination,
      });
    } else if (["pending_nemt_accept", "pending_ems_release"].includes(handoff.status)) {
      queueOnly.push({
        handoffId: handoff.handoffId,
        linkedTripId: linked,
        status: handoff.status,
        priority: handoff.priority,
      });
    }
  }

  return {
    ok: true,
    phase: "phase-2-day-4",
    level,
    atRiskCount: atRisk.length,
    matchedCount: matches.length,
    pendingQueueCount: queueOnly.length,
    matches,
    pendingQueue: queueOnly,
    scopeGuard: TRANSPORT_DESK_SCOPE_GUARD,
    ingestedAt: desk.ingestedAt,
  };
}

export function buildTransportDeskSummary(level = 2) {
  const desk = getTransportDeskOverlay();
  const crossRef = buildHandoffCrossReference(level);
  const pressureSummary = desk.hospitals.map((h) => ({
    facilityId: h.facilityId,
    name: h.name,
    bedPressurePct: h.bedPressurePct,
    bedPressureLevel: h.bedPressureLevel,
    diversionStatus: h.diversionStatus,
    diversionLabel: diversionLabel(h.diversionStatus),
    electiveHold: h.electiveHold,
  }));

  return {
    ok: true,
    phase: "phase-2-day-4",
    headline: "EMS-adjacent transport desk — bed pressure + handoff queue",
    level,
    hospitalCount: desk.hospitalCount,
    handoffQueueCount: desk.handoffCount,
    pendingHandoffs: desk.pendingHandoffs,
    assignedHandoffs: desk.assignedHandoffs ?? 0,
    atRiskTrips: crossRef.atRiskCount,
    handoffMatched: crossRef.matchedCount,
    pendingAccepts: buildPendingHandoffAccepts(level),
    bedPressureSummary: pressureSummary,
    scopeGuard: TRANSPORT_DESK_SCOPE_GUARD,
    writeBackEnabled: true,
    adapter: desk.adapter,
    ingestedAt: desk.ingestedAt,
    hitlPersonasActive: PHASE2_HITL_PERSONAS_ACTIVE,
  };
}

/** Enrich map facility pins with transport desk bed pressure badges. */
export function attachTransportDeskToFacilities(facilities = []) {
  const desk = getTransportDeskOverlay();
  const byId = Object.fromEntries(desk.hospitals.map((h) => [h.facilityId, h]));

  return facilities.map((f) => {
    const status = byId[f.id];
    if (!status) return f;
    return {
      ...f,
      bedPressurePct: status.bedPressurePct,
      bedPressureLevel: status.bedPressureLevel,
      bedPressureColor: bedPressureColor(status.bedPressureLevel),
      diversionStatus: status.diversionStatus,
      diversionLabel: diversionLabel(status.diversionStatus),
      electiveHold: status.electiveHold,
      transportDeskContact: status.transportDeskContact,
    };
  });
}

/** Pending handoffs with CAD-suggested nemtRunId for pilot write-back UI / API. */
export function buildPendingHandoffAccepts(level = 2) {
  const desk = getTransportDeskOverlay();
  const overlay = getCadOverlay();
  const runByTrip = Object.fromEntries(overlay.runs.map((r) => [r.tripId, r.runId]));

  return desk.handoffQueue
    .filter((h) => ["pending_nemt_accept", "pending_ems_release"].includes(h.status))
    .map((h) => ({
      handoffId: h.handoffId,
      linkedTripId: h.linkedTripId,
      emsRunId: h.emsRunId,
      priority: h.priority,
      origin: h.origin,
      destination: h.destination,
      suggestedNemtRunId: h.linkedTripId ? runByTrip[h.linkedTripId] || null : null,
      cadLinkReady: !!(h.linkedTripId && runByTrip[h.linkedTripId]),
    }));
}

/** Webhook ingest — full replace or patch handoff accept write-back. */
export function ingestTransportDeskWebhook(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Transport desk webhook payload must be an object");
  }

  if (payload.mode === "patch" || payload.patch === true) {
    if (!cachedDesk) ingestTransportDeskFeed("json");
    const queue = payload.queue || payload.handoffQueue || payload.handoffs || [];
    return acceptNemtHandoffs(queue, {
      source: payload.source || "webhook",
      acceptedBy: payload.acceptedBy || "nemt_dispatch",
    }, cachedDesk);
  }

  cachedDesk = {
    hospitals: payload.hospitals || cachedDesk?.hospitals || [],
    handoffQueue: payload.queue || payload.handoffQueue || [],
    hospitalCount: (payload.hospitals || cachedDesk?.hospitals || []).length,
    handoffCount: (payload.queue || payload.handoffQueue || []).length,
    source: "webhook",
    ingestedAt: new Date().toISOString(),
    scopeGuard: TRANSPORT_DESK_SCOPE_GUARD,
  };

  return {
    ok: true,
    ingested: {
      hospitals: cachedDesk.hospitalCount,
      handoffs: cachedDesk.handoffCount,
    },
    source: "webhook",
    ingestedAt: cachedDesk.ingestedAt,
  };
}

/** Pilot NEMT CAD handoff accept — primary Day 4 write-back entry point. */
export function acceptNemtHandoffWriteBack(updates, options = {}) {
  if (!cachedDesk) ingestTransportDeskFeed("json");
  return acceptNemtHandoffs(updates, options, cachedDesk);
}

export function getHandoffWriteBackStatus() {
  const last = getLastHandoffWriteBack();
  const desk = getTransportDeskOverlay();
  return {
    ok: true,
    phase: "phase-2-day-4",
    writeBackEnabled: true,
    scopeGuard: NEMT_WRITEBACK_SCOPE_GUARD,
    pendingHandoffs: desk.pendingHandoffs,
    assignedHandoffs: desk.assignedHandoffs,
    lastWriteBack: last
      ? {
          acceptedCount: last.acceptedCount,
          transitions: last.transitions,
          source: last.source,
          acceptedAt: last.transitions[0]?.acceptedAt,
        }
      : null,
  };
}

export { NEMT_WRITEBACK_SCOPE_GUARD, getLastHandoffWriteBack };
