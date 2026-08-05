import { appendAuditEntry } from "../audit/index.js";

/** Dual-role HITL (NEMT supervisor + hospital liaison) — Week 2 Day 10+ */
export const ROLES = {
  NEMT_SUPERVISOR: "nemt_supervisor",
  HOSPITAL_LIAISON: "hospital_liaison",
};

const ROLE_LABELS = {
  [ROLES.NEMT_SUPERVISOR]: "NEMT Supervisor",
  [ROLES.HOSPITAL_LIAISON]: "Hospital Liaison",
};

/** @type {null | {
 *   id: string;
 *   stagedAt: string;
 *   auditId?: string;
 *   level: number;
 *   pack: object;
 *   roles: Record<string, { status: string; reviewedAt?: string; approvedAt?: string; approver?: string; notes?: string }>;
 *   released: boolean;
 *   releasedAt?: string;
 * }} */
let activeGate = null;

function emptyRoleState() {
  return { status: "awaiting", reviewedAt: null, approvedAt: null, approver: null, notes: null };
}

function gateSummary(gate) {
  if (!gate) {
    return {
      ok: true,
      active: false,
      state: "idle",
      message: "Awaiting action pack — run Action to stage COMMS-03 for dual approval",
      roles: {
        [ROLES.NEMT_SUPERVISOR]: emptyRoleState(),
        [ROLES.HOSPITAL_LIAISON]: emptyRoleState(),
      },
    };
  }

  const nemt = gate.roles[ROLES.NEMT_SUPERVISOR];
  const hospital = gate.roles[ROLES.HOSPITAL_LIAISON];
  const bothApproved = nemt.status === "approved" && hospital.status === "approved";

  let state = "staged";
  if (gate.released || bothApproved) state = "released";
  else if (nemt.status === "approved" || hospital.status === "approved") state = "partial";
  else if (nemt.status === "in_review" || hospital.status === "in_review") state = "in_review";

  return {
    ok: true,
    active: true,
    id: gate.id,
    auditId: gate.auditId,
    level: gate.level,
    state,
    released: gate.released || bothApproved,
    releasedAt: gate.releasedAt,
    stagedAt: gate.stagedAt,
    hitlRequired: gate.pack.hitlRequired,
    bulletinSubject: gate.pack.hospitalBulletin?.subject,
    checklistCount: gate.pack.checklist?.length ?? 0,
    driverCommsCount: gate.pack.driverComms?.length ?? 0,
    roles: {
      [ROLES.NEMT_SUPERVISOR]: { ...nemt, label: ROLE_LABELS[ROLES.NEMT_SUPERVISOR] },
      [ROLES.HOSPITAL_LIAISON]: { ...hospital, label: ROLE_LABELS[ROLES.HOSPITAL_LIAISON] },
    },
    message: gate.released || bothApproved
      ? "Dual HITL complete — action pack approved by both roles (demo: send blocked)"
      : "COMMS-03 staged — both roles must review and approve before send",
  };
}

/** Stage action pack at the dual HITL gate. */
export function stageHitlPack(pack, { auditId, level } = {}) {
  activeGate = {
    id: `HITL-${Date.now().toString(36).toUpperCase()}`,
    stagedAt: new Date().toISOString(),
    auditId,
    level: level ?? pack.level ?? 2,
    pack: structuredClone(pack),
    roles: {
      [ROLES.NEMT_SUPERVISOR]: emptyRoleState(),
      [ROLES.HOSPITAL_LIAISON]: emptyRoleState(),
    },
    released: false,
  };

  appendAuditEntry({
    type: "hitl_staged",
    summary: `HITL staged: COMMS-03 bulletin + ${pack.checklist?.length ?? 0} checklist items`,
    hitl: {
      gateId: activeGate.id,
      level: activeGate.level,
      bulletinSubject: pack.hospitalBulletin?.subject,
      rolesRequired: [ROLES.NEMT_SUPERVISOR, ROLES.HOSPITAL_LIAISON],
    },
    mode: "demo",
  });

  return gateSummary(activeGate);
}

export function getHitlStatus() {
  return gateSummary(activeGate);
}

export function getHitlReviewContent(role) {
  if (!activeGate) {
    return { ok: false, error: "No action pack staged for HITL review" };
  }
  if (!Object.values(ROLES).includes(role)) {
    return { ok: false, error: `Invalid role: ${role}` };
  }

  const p = activeGate.pack;
  return {
    ok: true,
    gateId: activeGate.id,
    role,
    roleLabel: ROLE_LABELS[role],
    level: activeGate.level,
    summary: p.summary,
    checklist: p.checklist,
    hospitalBulletin: p.hospitalBulletin,
    driverComms: p.driverComms,
    roleStatus: activeGate.roles[role],
  };
}

/** Mark a role as actively reviewing. */
export function startHitlReview(role) {
  if (!activeGate) return { ok: false, error: "No action pack staged" };
  if (!Object.values(ROLES).includes(role)) return { ok: false, error: `Invalid role: ${role}` };
  if (activeGate.roles[role].status === "approved") {
    return { ok: false, error: `${ROLE_LABELS[role]} has already approved` };
  }

  activeGate.roles[role].status = "in_review";
  activeGate.roles[role].reviewedAt = new Date().toISOString();

  appendAuditEntry({
    type: "hitl_review",
    summary: `${ROLE_LABELS[role]} opened COMMS-03 for review`,
    hitl: { gateId: activeGate.id, role, action: "review" },
    mode: "demo",
  });

  return { ok: true, status: gateSummary(activeGate) };
}

/** Approve with optional bulletin edits and notes. */
export function approveHitl(role, { approver, notes, bulletinSubject, bulletinBody } = {}) {
  if (!activeGate) return { ok: false, error: "No action pack staged" };
  if (!Object.values(ROLES).includes(role)) return { ok: false, error: `Invalid role: ${role}` };

  const roleState = activeGate.roles[role];
  if (roleState.status === "approved") {
    return { ok: false, error: `${ROLE_LABELS[role]} has already approved` };
  }

  const edits = {};
  if (bulletinSubject && bulletinSubject !== activeGate.pack.hospitalBulletin.subject) {
    edits.subject = bulletinSubject;
    activeGate.pack.hospitalBulletin.subject = bulletinSubject;
  }
  if (bulletinBody && bulletinBody !== activeGate.pack.hospitalBulletin.body) {
    edits.body = true;
    activeGate.pack.hospitalBulletin.body = bulletinBody;
    activeGate.pack.hospitalBulletin.edited = true;
  }

  roleState.status = "approved";
  roleState.approvedAt = new Date().toISOString();
  roleState.approver = approver || ROLE_LABELS[role];
  roleState.notes = notes || null;
  if (roleState.reviewedAt == null) roleState.reviewedAt = roleState.approvedAt;

  const audit = appendAuditEntry({
    type: "hitl_approval",
    summary: `${ROLE_LABELS[role]} approved COMMS-03${Object.keys(edits).length ? " (with edits)" : ""}`,
    hitl: {
      gateId: activeGate.id,
      role,
      approver: roleState.approver,
      approvedAt: roleState.approvedAt,
      edits: Object.keys(edits).length ? edits : undefined,
      notes: notes || undefined,
    },
    mode: "demo",
  });

  const nemtOk = activeGate.roles[ROLES.NEMT_SUPERVISOR].status === "approved";
  const hospitalOk = activeGate.roles[ROLES.HOSPITAL_LIAISON].status === "approved";
  let releaseAudit = null;

  if (nemtOk && hospitalOk && !activeGate.released) {
    activeGate.released = true;
    activeGate.releasedAt = new Date().toISOString();
    activeGate.pack.hospitalBulletin.draftOnly = false;
    activeGate.pack.hospitalBulletin.approvedAt = activeGate.releasedAt;

    releaseAudit = appendAuditEntry({
      type: "hitl_released",
      summary: "Dual HITL complete — NEMT supervisor + hospital liaison approved action pack",
      hitl: {
        gateId: activeGate.id,
        releasedAt: activeGate.releasedAt,
        approvers: {
          [ROLES.NEMT_SUPERVISOR]: activeGate.roles[ROLES.NEMT_SUPERVISOR].approver,
          [ROLES.HOSPITAL_LIAISON]: activeGate.roles[ROLES.HOSPITAL_LIAISON].approver,
        },
      },
      mode: "demo",
    });
  }

  return {
    ok: true,
    status: gateSummary(activeGate),
    audit,
    releaseAudit,
    dualComplete: activeGate.released,
  };
}

/** Reset gate (demo/testing). */
export function resetHitl() {
  activeGate = null;
  return gateSummary(null);
}
