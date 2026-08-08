/** Phase 2 Day 2 — EMS-adjacent transport desk (read-only hospital + handoff signals). */

import { getAtRiskTrips } from "../dispatch/index.js";
import { loadHandoffQueueFeed, loadHospitalDeskFeed } from "./adapters/json.js";

export const TRANSPORT_DESK_SCOPE_GUARD =
  "Read-only transport desk — scheduled inter-facility handoffs only; not 911 PSAP or EMS dispatch.";

export const PHASE2_HITL_PERSONAS_PLANNED = [
  { id: "shelter_coordinator", title: "Shelter Coordinator", status: "planned" },
  { id: "fleet_logistics", title: "Fleet Logistics", status: "planned" },
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

  return {
    ok: true,
    phase: "phase-2-day-2",
    mode: "read_only",
    scopeGuard: TRANSPORT_DESK_SCOPE_GUARD,
    adapter: process.env.TRANSPORT_DESK_URL ? "rest" : "json",
    ...cachedDesk,
    pendingHandoffs: pendingHandoffs.length,
    hitlPersonasPlanned: PHASE2_HITL_PERSONAS_PLANNED,
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
    phase: "phase-2-day-2",
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
    phase: "phase-2-day-2",
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
    phase: "phase-2-day-2",
    headline: "EMS-adjacent transport desk — bed pressure + handoff queue",
    level,
    hospitalCount: desk.hospitalCount,
    handoffQueueCount: desk.handoffCount,
    pendingHandoffs: desk.pendingHandoffs,
    atRiskTrips: crossRef.atRiskCount,
    handoffMatched: crossRef.matchedCount,
    bedPressureSummary: pressureSummary,
    scopeGuard: TRANSPORT_DESK_SCOPE_GUARD,
    adapter: desk.adapter,
    ingestedAt: desk.ingestedAt,
    hitlPersonasPlanned: PHASE2_HITL_PERSONAS_PLANNED,
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

/** Webhook stub — read-only ingest for pilot hospital desk + handoff feeds. */
export function ingestTransportDeskWebhook(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Transport desk webhook payload must be an object");
  }

  cachedDesk = {
    hospitals: payload.hospitals || [],
    handoffQueue: payload.queue || payload.handoffQueue || [],
    hospitalCount: (payload.hospitals || []).length,
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
