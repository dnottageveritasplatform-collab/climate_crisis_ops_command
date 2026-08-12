import { appendAuditEntry } from "../audit/index.js";
import { hitlApproverName } from "../scenario/index.js";

/** Core triple-role HITL: NEMT supervisor + PMH liaison + Doctor's Hospital liaison */
export const ROLES = {
  NEMT_SUPERVISOR: "nemt_supervisor",
  HOSPITAL_LIAISON_PMH: "hospital_liaison_pmh",
  HOSPITAL_LIAISON_DOCTORS: "hospital_liaison_doctors",
  SHELTER_COORDINATOR: "shelter_coordinator",
  FLEET_LOGISTICS: "fleet_logistics",
};

/** @deprecated Use role-specific keys above */
export const HOSPITAL_LIAISON = ROLES.HOSPITAL_LIAISON_PMH;

export const CORE_HITL_ROLES = [
  ROLES.NEMT_SUPERVISOR,
  ROLES.HOSPITAL_LIAISON_PMH,
  ROLES.HOSPITAL_LIAISON_DOCTORS,
];

export const EXTENDED_HITL_ROLES = [ROLES.SHELTER_COORDINATOR, ROLES.FLEET_LOGISTICS];

const ROLE_LABELS = {
  [ROLES.NEMT_SUPERVISOR]: "NEMT Supervisor · Nassau Metro",
  [ROLES.HOSPITAL_LIAISON_PMH]: "PMH Liaison · Princess Margaret",
  [ROLES.HOSPITAL_LIAISON_DOCTORS]: "Doctor's Liaison · Private partner",
  [ROLES.SHELTER_COORDINATOR]: "Shelter Coordinator · National Gymnasium",
  [ROLES.FLEET_LOGISTICS]: "Fleet Logistics · Evacuation assets",
};

const ROLE_FACILITY = {
  [ROLES.HOSPITAL_LIAISON_PMH]: "FAC-01",
  [ROLES.HOSPITAL_LIAISON_DOCTORS]: "FAC-04",
};

/** Map legacy dual-HITL role ids to triple-role ids. */
const ROLE_ALIASES = {
  hospital_liaison: ROLES.HOSPITAL_LIAISON_PMH,
};

function normalizeRole(role) {
  return ROLE_ALIASES[role] || role;
}

export function requiredRolesForPack(pack) {
  if (pack?.extendedHitlRequired) return [...CORE_HITL_ROLES, ...EXTENDED_HITL_ROLES];
  return [...CORE_HITL_ROLES];
}

function hitlModeLabel(requiredRoles) {
  return requiredRoles.length > CORE_HITL_ROLES.length ? "extended_quintuple" : "triple";
}

/** @type {null | object} */
let activeGate = null;

function emptyRoleState() {
  return { status: "awaiting", reviewedAt: null, approvedAt: null, approver: null, notes: null };
}

function initRoleStates(requiredRoles) {
  return Object.fromEntries(requiredRoles.map((r) => [r, emptyRoleState()]));
}

function allRolesApproved(gate) {
  return gate.requiredRoles.every((r) => gate.roles[r]?.status === "approved");
}

function bulletinForRole(role, pack) {
  if (role === ROLES.SHELTER_COORDINATOR && pack.shelterRoutingBrief) {
    return pack.shelterRoutingBrief;
  }
  if (role === ROLES.FLEET_LOGISTICS && pack.fleetAllocationBrief) {
    return pack.fleetAllocationBrief;
  }
  if (role === ROLES.NEMT_SUPERVISOR) return pack.hospitalBulletin;
  const facilityId = ROLE_FACILITY[role];
  if (facilityId && pack.hospitalBulletins?.length) {
    return pack.hospitalBulletins.find((b) => b.facilityId === facilityId) || pack.hospitalBulletin;
  }
  return pack.hospitalBulletin;
}

function gateSummary(gate) {
  const allRoleKeys = [...CORE_HITL_ROLES, ...EXTENDED_HITL_ROLES];

  if (!gate) {
    return {
      ok: true,
      active: false,
      state: "idle",
      hitlMode: "triple",
      extendedHitl: false,
      message:
        "Awaiting action pack — run Pipeline or Action to stage COMMS-03 (+ shelter/fleet at L2+) for multi-agency approval",
      roles: Object.fromEntries(allRoleKeys.map((r) => [r, { ...emptyRoleState(), label: ROLE_LABELS[r] }])),
    };
  }

  const roleStates = Object.fromEntries(
    gate.requiredRoles.map((r) => [r, { ...gate.roles[r], label: ROLE_LABELS[r] }])
  );
  for (const r of allRoleKeys) {
    if (!roleStates[r]) {
      roleStates[r] = { ...emptyRoleState(), label: ROLE_LABELS[r], status: "not_required" };
    }
  }

  const allApproved = allRolesApproved(gate);
  const extended = gate.requiredRoles.length > CORE_HITL_ROLES.length;

  let state = "staged";
  if (gate.released || allApproved) state = "released";
  else if (gate.requiredRoles.some((r) => gate.roles[r].status === "approved")) state = "partial";
  else if (gate.requiredRoles.some((r) => gate.roles[r].status === "in_review")) state = "in_review";

  const releaseMessage = extended
    ? "Extended HITL complete — NEMT + hospital liaisons + shelter + fleet signed off (demo: send blocked)"
    : "Triple HITL complete — all approvers signed off (demo: send blocked)";

  const stagedMessage = extended
    ? "COMMS-03 + shelter/fleet drafts staged — 5-role extended HITL required before send"
    : "COMMS-03 staged — NEMT supervisor + PMH liaison + Doctor's liaison must each review and approve";

  return {
    ok: true,
    active: true,
    id: gate.id,
    auditId: gate.auditId,
    level: gate.level,
    state,
    hitlMode: hitlModeLabel(gate.requiredRoles),
    extendedHitl: extended,
    requiredRoleCount: gate.requiredRoles.length,
    released: gate.released || allApproved,
    releasedAt: gate.releasedAt,
    stagedAt: gate.stagedAt,
    hitlRequired: gate.pack.hitlRequired,
    bulletinCount: gate.pack.hospitalBulletins?.length ?? 1,
    hospitalPartners: gate.pack.hospitalPartners?.map((p) => p.name) ?? [],
    checklistCount: gate.pack.checklist?.length ?? 0,
    driverCommsCount: gate.pack.driverComms?.length ?? 0,
    roles: roleStates,
    message: gate.released || allApproved ? releaseMessage : stagedMessage,
  };
}

/** Stage action pack at the HITL gate (triple or extended quintuple). */
export function stageHitlPack(pack, { auditId, level } = {}) {
  const requiredRoles = requiredRolesForPack(pack);
  const extended = requiredRoles.length > CORE_HITL_ROLES.length;

  activeGate = {
    id: `HITL-${Date.now().toString(36).toUpperCase()}`,
    stagedAt: new Date().toISOString(),
    auditId,
    level: level ?? pack.level ?? 2,
    pack: structuredClone(pack),
    requiredRoles,
    roles: initRoleStates(requiredRoles),
    released: false,
  };

  appendAuditEntry({
    type: "hitl_staged",
    summary: extended
      ? `Extended HITL staged: ${pack.hospitalBulletins?.length ?? 1} COMMS-03 + shelter/fleet drafts · 5-role approval`
      : `HITL staged: ${pack.hospitalBulletins?.length ?? 1} COMMS-03 bulletin(s) · triple approval required`,
    steps: [{ id: "hitl_staged", label: extended ? "Extended HITL gate opened" : "HITL gate opened", gateId: activeGate.id, ts: activeGate.stagedAt }],
    citations: (pack.sopCitations || []).map((c) => ({ ref: c.ref || c.sopId, text: c.text?.slice(0, 80) })),
    hitl: {
      gateId: activeGate.id,
      level: activeGate.level,
      hitlMode: hitlModeLabel(requiredRoles),
      extendedHitl: extended,
      hospitalPartners: pack.hospitalPartners?.map((p) => p.name) ?? [],
      rolesRequired: requiredRoles,
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
  if (!activeGate.requiredRoles.includes(role)) {
    return { ok: false, error: `Role not required for this gate: ${role}` };
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
    extendedHitl: activeGate.requiredRoles.length > CORE_HITL_ROLES.length,
    summary: p.summary,
    checklist: p.checklist,
    hospitalBulletin: roleBulletin,
    hospitalBulletins: p.hospitalBulletins,
    shelterRoutingBrief: p.shelterRoutingBrief,
    fleetAllocationBrief: p.fleetAllocationBrief,
    hospitalPartners: p.hospitalPartners,
    driverComms: p.driverComms,
    roleStatus: activeGate.roles[role],
  };
}

export function startHitlReview(role) {
  role = normalizeRole(role);
  if (!activeGate) return { ok: false, error: "No action pack staged" };
  if (!activeGate.requiredRoles.includes(role)) return { ok: false, error: `Invalid role: ${role}` };
  if (activeGate.roles[role].status === "approved") {
    return { ok: false, error: `${ROLE_LABELS[role]} has already approved` };
  }

  activeGate.roles[role].status = "in_review";
  activeGate.roles[role].reviewedAt = new Date().toISOString();

  appendAuditEntry({
    type: "hitl_review",
    summary: `${ROLE_LABELS[role]} opened draft for review`,
    hitl: { gateId: activeGate.id, role, action: "review" },
    mode: "demo",
  });

  return { ok: true, status: gateSummary(activeGate) };
}

export function approveHitl(role, { approver, notes, bulletinSubject, bulletinBody } = {}) {
  role = normalizeRole(role);
  if (!activeGate) return { ok: false, error: "No action pack staged" };
  if (!activeGate.requiredRoles.includes(role)) return { ok: false, error: `Invalid role: ${role}` };

  const roleState = activeGate.roles[role];
  if (roleState.status === "approved") {
    return { ok: false, error: `${ROLE_LABELS[role]} has already approved` };
  }

  const roleBulletin = bulletinForRole(role, activeGate.pack);
  const edits = {};

  if (bulletinSubject && bulletinSubject !== roleBulletin?.subject) {
    edits.subject = bulletinSubject;
    roleBulletin.subject = bulletinSubject;
    if (activeGate.pack.hospitalBulletin && CORE_HITL_ROLES.includes(role)) {
      activeGate.pack.hospitalBulletin.subject = bulletinSubject;
    }
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
  roleState.approver = approver || hitlApproverName(role);
  roleState.notes = notes || null;
  if (roleState.reviewedAt == null) roleState.reviewedAt = roleState.approvedAt;

  const audit = appendAuditEntry({
    type: "hitl_approval",
    summary: `${ROLE_LABELS[role]} approved draft${Object.keys(edits).length ? " (with edits)" : ""}`,
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
    if (activeGate.pack.hospitalBulletin) {
      activeGate.pack.hospitalBulletin.draftOnly = false;
      activeGate.pack.hospitalBulletin.approvedAt = activeGate.releasedAt;
    }
    for (const b of activeGate.pack.hospitalBulletins || []) {
      b.draftOnly = false;
      b.approvedAt = activeGate.releasedAt;
    }
    if (activeGate.pack.shelterRoutingBrief) {
      activeGate.pack.shelterRoutingBrief.draftOnly = false;
      activeGate.pack.shelterRoutingBrief.approvedAt = activeGate.releasedAt;
    }
    if (activeGate.pack.fleetAllocationBrief) {
      activeGate.pack.fleetAllocationBrief.draftOnly = false;
      activeGate.pack.fleetAllocationBrief.approvedAt = activeGate.releasedAt;
    }

    const extended = activeGate.requiredRoles.length > CORE_HITL_ROLES.length;
    releaseAudit = appendAuditEntry({
      type: "hitl_released",
      summary: extended
        ? "Extended HITL complete — 5-role multi-agency approval on action pack"
        : "Triple HITL complete — NEMT + PMH liaison + Doctor's liaison approved action pack",
      steps: [
        { id: "hitl_staged", label: "HITL staged", ts: activeGate.stagedAt },
        ...activeGate.requiredRoles.map((r) => ({
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
      approvers: activeGate.requiredRoles.map((r) => ({
        role: r,
        label: ROLE_LABELS[r],
        name: activeGate.roles[r].approver,
        reviewedAt: activeGate.roles[r].reviewedAt,
        approvedAt: activeGate.roles[r].approvedAt,
        notes: activeGate.roles[r].notes || undefined,
      })),
      hitl: {
        gateId: activeGate.id,
        hitlMode: hitlModeLabel(activeGate.requiredRoles),
        extendedHitl: extended,
        releasedAt: activeGate.releasedAt,
        actionAuditId: activeGate.auditId,
        approvers: activeGate.requiredRoles.map((r) => ({
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
