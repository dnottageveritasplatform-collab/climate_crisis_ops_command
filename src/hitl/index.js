import { appendAuditEntry } from "../audit/index.js";

/** Triple-role HITL: NEMT supervisor + PMH liaison + Doctor's Hospital liaison */
export const ROLES = {
  NEMT_SUPERVISOR: "nemt_supervisor",
  HOSPITAL_LIAISON_PMH: "hospital_liaison_pmh",
  HOSPITAL_LIAISON_DOCTORS: "hospital_liaison_doctors",
};

/** @deprecated Use role-specific keys above */
export const HOSPITAL_LIAISON = ROLES.HOSPITAL_LIAISON_PMH;

const ROLE_LABELS = {
  [ROLES.NEMT_SUPERVISOR]: "NEMT Supervisor",
  [ROLES.HOSPITAL_LIAISON_PMH]: "PMH Liaison",
  [ROLES.HOSPITAL_LIAISON_DOCTORS]: "Doctor's Liaison",
};

const ROLE_FACILITY = {
  [ROLES.HOSPITAL_LIAISON_PMH]: "FAC-01",
  [ROLES.HOSPITAL_LIAISON_DOCTORS]: "FAC-04",
};

const REQUIRED_ROLES = Object.values(ROLES);

/** Map legacy dual-HITL role ids to triple-role ids. */
const ROLE_ALIASES = {
  hospital_liaison: ROLES.HOSPITAL_LIAISON_PMH,
};

function normalizeRole(role) {
  return ROLE_ALIASES[role] || role;
}

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

function initRoleStates() {
  return Object.fromEntries(REQUIRED_ROLES.map((r) => [r, emptyRoleState()]));
}

function allRolesApproved(gate) {
  return REQUIRED_ROLES.every((r) => gate.roles[r]?.status === "approved");
}

function bulletinForRole(role, pack) {
  if (role === ROLES.NEMT_SUPERVISOR) return pack.hospitalBulletin;
  const facilityId = ROLE_FACILITY[role];
  if (facilityId && pack.hospitalBulletins?.length) {
    return pack.hospitalBulletins.find((b) => b.facilityId === facilityId) || pack.hospitalBulletin;
  }
  return pack.hospitalBulletin;
}

function gateSummary(gate) {
  if (!gate) {
    return {
      ok: true,
      active: false,
      state: "idle",
      message: "Awaiting action pack — run Action to stage COMMS-03 for triple approval",
      roles: Object.fromEntries(REQUIRED_ROLES.map((r) => [r, { ...emptyRoleState(), label: ROLE_LABELS[r] }])),
    };
  }

  const roleStates = Object.fromEntries(
    REQUIRED_ROLES.map((r) => [r, { ...gate.roles[r], label: ROLE_LABELS[r] }])
  );
  const allApproved = allRolesApproved(gate);

  let state = "staged";
  if (gate.released || allApproved) state = "released";
  else if (REQUIRED_ROLES.some((r) => gate.roles[r].status === "approved")) state = "partial";
  else if (REQUIRED_ROLES.some((r) => gate.roles[r].status === "in_review")) state = "in_review";

  return {
    ok: true,
    active: true,
    id: gate.id,
    auditId: gate.auditId,
    level: gate.level,
    state,
    released: gate.released || allApproved,
    releasedAt: gate.releasedAt,
    stagedAt: gate.stagedAt,
    hitlRequired: gate.pack.hitlRequired,
    bulletinCount: gate.pack.hospitalBulletins?.length ?? 1,
    hospitalPartners: gate.pack.hospitalPartners?.map((p) => p.name) ?? [],
    checklistCount: gate.pack.checklist?.length ?? 0,
    driverCommsCount: gate.pack.driverComms?.length ?? 0,
    roles: roleStates,
    message: gate.released || allApproved
      ? "Triple HITL complete — all approvers signed off (demo: send blocked)"
      : "COMMS-03 staged — NEMT + both hospital liaisons must review and approve",
  };
}

/** Stage action pack at the triple HITL gate. */
export function stageHitlPack(pack, { auditId, level } = {}) {
  activeGate = {
    id: `HITL-${Date.now().toString(36).toUpperCase()}`,
    stagedAt: new Date().toISOString(),
    auditId,
    level: level ?? pack.level ?? 2,
    pack: structuredClone(pack),
    roles: initRoleStates(),
    released: false,
  };

  appendAuditEntry({
    type: "hitl_staged",
    summary: `HITL staged: ${pack.hospitalBulletins?.length ?? 1} COMMS-03 bulletin(s) · triple approval required`,
    steps: [{ id: "hitl_staged", label: "HITL gate opened", gateId: activeGate.id, ts: activeGate.stagedAt }],
    citations: (pack.sopCitations || []).map((c) => ({ ref: c.ref || c.sopId, text: c.text?.slice(0, 80) })),
    hitl: {
      gateId: activeGate.id,
      level: activeGate.level,
      hospitalPartners: pack.hospitalPartners?.map((p) => p.name) ?? [],
      rolesRequired: REQUIRED_ROLES,
      actionAuditId: auditId,
    },
    mode: "demo",
  });

  return gateSummary(activeGate);
}

export function getHitlStatus() {
  return gateSummary(activeGate);
}

export function getHitlReviewContent(role) {
  role = normalizeRole(role);
  if (!activeGate) {
    return { ok: false, error: "No action pack staged for HITL review" };
  }
  if (!REQUIRED_ROLES.includes(role)) {
    return { ok: false, error: `Invalid role: ${role}` };
  }

  const p = activeGate.pack;
  const roleBulletin = bulletinForRole(role, p);

  return {
    ok: true,
    gateId: activeGate.id,
    role,
    roleLabel: ROLE_LABELS[role],
    facilityId: ROLE_FACILITY[role] || null,
    level: activeGate.level,
    summary: p.summary,
    checklist: p.checklist,
    hospitalBulletin: roleBulletin,
    hospitalBulletins: p.hospitalBulletins,
    hospitalPartners: p.hospitalPartners,
    driverComms: p.driverComms,
    roleStatus: activeGate.roles[role],
  };
}

export function startHitlReview(role) {
  role = normalizeRole(role);
  if (!activeGate) return { ok: false, error: "No action pack staged" };
  if (!REQUIRED_ROLES.includes(role)) return { ok: false, error: `Invalid role: ${role}` };
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

export function approveHitl(role, { approver, notes, bulletinSubject, bulletinBody } = {}) {
  role = normalizeRole(role);
  if (!activeGate) return { ok: false, error: "No action pack staged" };
  if (!REQUIRED_ROLES.includes(role)) return { ok: false, error: `Invalid role: ${role}` };

  const roleState = activeGate.roles[role];
  if (roleState.status === "approved") {
    return { ok: false, error: `${ROLE_LABELS[role]} has already approved` };
  }

  const roleBulletin = bulletinForRole(role, activeGate.pack);
  const edits = {};

  if (bulletinSubject && bulletinSubject !== roleBulletin?.subject) {
    edits.subject = bulletinSubject;
    roleBulletin.subject = bulletinSubject;
    if (activeGate.pack.hospitalBulletin) activeGate.pack.hospitalBulletin.subject = bulletinSubject;
  }
  if (bulletinBody && bulletinBody !== roleBulletin?.body) {
    edits.body = true;
    roleBulletin.body = bulletinBody;
    roleBulletin.edited = true;
    const facilityId = ROLE_FACILITY[role];
    if (facilityId && activeGate.pack.hospitalBulletins?.length) {
      const idx = activeGate.pack.hospitalBulletins.findIndex((b) => b.facilityId === facilityId);
      if (idx >= 0) {
        activeGate.pack.hospitalBulletins[idx].body = bulletinBody;
        activeGate.pack.hospitalBulletins[idx].edited = true;
      }
    }
  }

  roleState.status = "approved";
  roleState.approvedAt = new Date().toISOString();
  roleState.approver = approver || ROLE_LABELS[role];
  roleState.notes = notes || null;
  if (roleState.reviewedAt == null) roleState.reviewedAt = roleState.approvedAt;

  const audit = appendAuditEntry({
    type: "hitl_approval",
    summary: `${ROLE_LABELS[role]} approved COMMS-03${Object.keys(edits).length ? " (with edits)" : ""}`,
    steps: [{ id: "hitl_approval", label: `${ROLE_LABELS[role]} approved`, role, ts: roleState.approvedAt }],
    hitl: {
      gateId: activeGate.id,
      role,
      approver: roleState.approver,
      reviewedAt: roleState.reviewedAt,
      approvedAt: roleState.approvedAt,
      edits: Object.keys(edits).length ? edits : undefined,
      notes: notes || undefined,
    },
    mode: "demo",
  });

  let releaseAudit = null;

  if (allRolesApproved(activeGate) && !activeGate.released) {
    activeGate.released = true;
    activeGate.releasedAt = new Date().toISOString();
    activeGate.pack.hospitalBulletin.draftOnly = false;
    activeGate.pack.hospitalBulletin.approvedAt = activeGate.releasedAt;
    for (const b of activeGate.pack.hospitalBulletins || []) {
      b.draftOnly = false;
      b.approvedAt = activeGate.releasedAt;
    }

    releaseAudit = appendAuditEntry({
      type: "hitl_released",
      summary: "Triple HITL complete — NEMT + PMH liaison + Doctor's liaison approved action pack",
      steps: [
        { id: "hitl_staged", label: "HITL staged", ts: activeGate.stagedAt },
        ...REQUIRED_ROLES.map((r) => ({
          id: "hitl_approval",
          label: `${ROLE_LABELS[r]} approved`,
          role: r,
          ts: activeGate.roles[r].approvedAt,
        })),
        { id: "hitl_released", label: "Action pack released", ts: activeGate.releasedAt },
      ],
      citations: (activeGate.pack.sopCitations || []).map((c) => ({
        ref: c.ref || c.sopId,
        text: c.text?.slice(0, 80),
      })),
      approvers: REQUIRED_ROLES.map((r) => ({
        role: r,
        label: ROLE_LABELS[r],
        name: activeGate.roles[r].approver,
        reviewedAt: activeGate.roles[r].reviewedAt,
        approvedAt: activeGate.roles[r].approvedAt,
        notes: activeGate.roles[r].notes || undefined,
      })),
      hitl: {
        gateId: activeGate.id,
        releasedAt: activeGate.releasedAt,
        actionAuditId: activeGate.auditId,
        approvers: REQUIRED_ROLES.map((r) => ({
          role: r,
          label: ROLE_LABELS[r],
          name: activeGate.roles[r].approver,
          reviewedAt: activeGate.roles[r].reviewedAt,
          approvedAt: activeGate.roles[r].approvedAt,
        })),
      },
      mode: "demo",
    });
  }

  return {
    ok: true,
    status: gateSummary(activeGate),
    audit,
    releaseAudit,
    tripleComplete: activeGate.released,
  };
}

export function resetHitl() {
  activeGate = null;
  return gateSummary(null);
}
