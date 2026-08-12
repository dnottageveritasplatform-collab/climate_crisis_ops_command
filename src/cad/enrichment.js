/** Phase 2 Day 5 — bidirectional CAD enrichment (live run + handoff status on dispatch). */

import { getAtRiskTrips, summarizeDispatch } from "../dispatch/index.js";
import { getCadOverlay } from "./index.js";
import { getTransportDeskOverlay } from "../transport-desk/index.js";

export const CAD_ENRICHMENT_SCOPE_GUARD =
  "Bidirectional CAD enrichment — live run status on dispatch manifest; not dispatch authority.";

function handoffByTrip(desk) {
  const map = {};
  for (const h of desk.handoffQueue || []) {
    if (h.linkedTripId) map[h.linkedTripId] = h;
  }
  return map;
}

/** Enrich at-risk trips with live CAD run + transport desk handoff assignment. */
export function enrichAtRiskTrips(level = 2) {
  const overlay = getCadOverlay();
  const desk = getTransportDeskOverlay();
  const runByTrip = Object.fromEntries(overlay.runs.map((r) => [r.tripId, r]));
  const handoffs = handoffByTrip(desk);

  return getAtRiskTrips(level).map((trip) => {
    const run = runByTrip[trip.id];
    const handoff = handoffs[trip.id];
    return {
      tripId: trip.id,
      priority: trip.priority,
      pickup: trip.pickup,
      facility: trip.facility,
      corridor: trip.corridor,
      cadRunId: run?.runId || null,
      incidentId: run?.incidentId || null,
      unitId: run?.unitId || null,
      unitStatus: run?.unitStatus || null,
      cadLinked: !!run,
      handoffId: handoff?.handoffId || null,
      handoffStatus: handoff?.status || null,
      nemtRunId: handoff?.nemtRunId || null,
      handoffLinked: !!handoff,
    };
  });
}

/** Dispatch summary enriched with live CAD + handoff write-back state. */
export function buildEnrichedDispatchSummary(level = 2) {
  const base = summarizeDispatch(level);
  const atRiskDetails = enrichAtRiskTrips(level);
  const cadLinkedAtRisk = atRiskDetails.filter((t) => t.cadLinked).length;
  const handoffLinkedAtRisk = atRiskDetails.filter((t) => t.handoffLinked).length;
  const nemtAssignedAtRisk = atRiskDetails.filter((t) => t.handoffStatus === "nemt_assigned").length;

  const unitStatusCounts = atRiskDetails.reduce((acc, t) => {
    if (t.unitStatus) acc[t.unitStatus] = (acc[t.unitStatus] || 0) + 1;
    return acc;
  }, {});

  return {
    ...base,
    ok: true,
    phase: "phase-2-day-5",
    enriched: true,
    scopeGuard: CAD_ENRICHMENT_SCOPE_GUARD,
    cadLinkedAtRisk,
    handoffLinkedAtRisk,
    nemtAssignedAtRisk,
    liveUnitStatusCounts: unitStatusCounts,
    atRiskDetails,
    sample: atRiskDetails.slice(0, 3).map((t) => ({
      id: t.tripId,
      priority: t.priority,
      pickup: t.pickup,
      facility: t.facility,
      corridor: t.corridor,
      cadRunId: t.cadRunId,
      unitStatus: t.unitStatus,
      handoffStatus: t.handoffStatus,
      nemtRunId: t.nemtRunId,
    })),
  };
}

/** Map layer helper — attach live CAD/handoff fields to projected trips. */
export function attachLiveCadToTrips(trips = []) {
  const overlay = getCadOverlay();
  const desk = getTransportDeskOverlay();
  const runByTrip = Object.fromEntries(overlay.runs.map((r) => [r.tripId, r]));
  const handoffs = handoffByTrip(desk);

  return trips.map((t) => {
    const run = runByTrip[t.id];
    const handoff = handoffs[t.id];
    if (!run && !handoff) return t;
    return {
      ...t,
      cadRunId: run?.runId,
      unitId: run?.unitId,
      unitStatus: run?.unitStatus,
      handoffId: handoff?.handoffId,
      handoffStatus: handoff?.status,
      nemtRunId: handoff?.nemtRunId,
      liveEnriched: true,
    };
  });
}
