/** Phase 2 Day 4 — pilot NEMT CAD handoff accept write-back (not COMMS HITL). */

import { verifyHandoffCadLink } from "../cad/index.js";
import { recordHandoffWriteBack } from "../audit/index.js";

export const NEMT_WRITEBACK_SCOPE_GUARD =
  "Pilot handoff accept + run ID assignment only — not trip dispatch authority, not 911 PSAP, not auto-send COMMS.";

const ALLOWED_TRANSITIONS = {
  pending_nemt_accept: ["nemt_assigned"],
  pending_ems_release: ["nemt_assigned"],
};

let lastWriteBack = null;

export function getLastHandoffWriteBack() {
  return lastWriteBack;
}

/**
 * Apply NEMT dispatch accept for one or more handoffs (merge by handoffId).
 * Validates status transition and CAD run ↔ trip linkage.
 */
export function acceptNemtHandoffs(updates, { source = "pilot", acceptedBy = "nemt_dispatch" } = {}, desk) {
  if (!desk?.handoffQueue) {
    throw new Error("Transport desk not loaded — call ingestTransportDeskFeed first");
  }
  if (!Array.isArray(updates) || !updates.length) {
    throw new Error("At least one handoff update is required");
  }

  const transitions = [];
  const errors = [];

  for (const update of updates) {
    const handoffId = update.handoffId;
    if (!handoffId) {
      errors.push({ error: "handoffId_required" });
      continue;
    }

    const idx = desk.handoffQueue.findIndex((h) => h.handoffId === handoffId);
    if (idx === -1) {
      errors.push({ handoffId, error: "not_found" });
      continue;
    }

    const handoff = desk.handoffQueue[idx];
    const newStatus = update.status || "nemt_assigned";
    const allowed = ALLOWED_TRANSITIONS[handoff.status];

    if (!allowed?.includes(newStatus)) {
      errors.push({
        handoffId,
        error: "invalid_transition",
        from: handoff.status,
        to: newStatus,
      });
      continue;
    }

    const nemtRunId = update.nemtRunId;
    if (!nemtRunId) {
      errors.push({ handoffId, error: "nemtRunId_required" });
      continue;
    }

    const linkedTripId = update.linkedTripId || handoff.linkedTripId;
    const cadLink = verifyHandoffCadLink(nemtRunId, linkedTripId);

    if (!cadLink.ok) {
      errors.push({ handoffId, nemtRunId, linkedTripId, error: "cad_link_failed", reason: cadLink.reason });
      continue;
    }

    const acceptedAt = new Date().toISOString();
    desk.handoffQueue[idx] = {
      ...handoff,
      status: newStatus,
      nemtRunId,
      linkedTripId,
      acceptedAt,
      acceptedBy: update.acceptedBy || acceptedBy,
      writeBackSource: source,
    };

    transitions.push({
      handoffId,
      from: handoff.status,
      to: newStatus,
      linkedTripId,
      nemtRunId,
      emsRunId: handoff.emsRunId,
      incidentId: cadLink.incidentId,
      cadLinked: true,
      acceptedAt,
      acceptedBy: update.acceptedBy || acceptedBy,
    });
  }

  const result = {
    ok: transitions.length > 0 && errors.length === 0,
    partial: transitions.length > 0 && errors.length > 0,
    phase: "phase-2-day-4",
    mode: "write_back_pilot",
    scopeGuard: NEMT_WRITEBACK_SCOPE_GUARD,
    source,
    acceptedBy,
    transitions,
    errors,
    acceptedCount: transitions.length,
    errorCount: errors.length,
  };

  if (transitions.length) {
    lastWriteBack = result;
    recordHandoffWriteBack({
      transitions,
      source,
      acceptedBy,
      scopeGuard: NEMT_WRITEBACK_SCOPE_GUARD,
    });
  }

  return result;
}
