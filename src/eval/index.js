import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runMonitorBrief } from "../agents/monitor/brief.js";
import { runTriageRank } from "../agents/triage/rank.js";
import { runActionPack } from "../agents/action/pack.js";
import { runPipeline } from "../orchestrator/index.js";
import { resetHitl } from "../hitl/index.js";
import { summarizeDispatch } from "../dispatch/index.js";
import { clearSignalCache, setEvalSignalMode } from "../signals/index.js";

const evalRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/eval");
const scenariosPath = path.join(evalRoot, "scenarios.json");

/** @type {null | object} */
let lastRun = null;

export function loadScenarios() {
  const raw = fs.readFileSync(scenariosPath, "utf8");
  const data = JSON.parse(raw);
  return data.scenarios || [];
}

function get(obj, dottedPath) {
  return dottedPath.split(".").reduce((acc, key) => acc?.[key], obj);
}

function assertExpect(result, expect) {
  const failures = [];
  const checks = [];

  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail });
    if (!ok) failures.push({ name, detail });
  };

  if (expect.threshold != null) {
    check("threshold", result.threshold === expect.threshold, `expected ${expect.threshold}, got ${result.threshold}`);
  }

  if (expect.atRiskTrips != null) {
    const actual = result.dispatch?.atRiskTrips ?? getAtRiskFromPipeline(result);
    check("atRiskTrips", actual === expect.atRiskTrips, `expected ${expect.atRiskTrips}, got ${actual}`);
  }

  if (expect.corridorStatus) {
    const status = result.dispatch?.corridorStatus ?? summarizeDispatch(result.threshold ?? 2).corridorStatus;
    for (const [corr, want] of Object.entries(expect.corridorStatus)) {
      check(
        `corridorStatus.${corr}`,
        status[corr] === want,
        `expected ${want}, got ${status[corr]}`
      );
    }
  }

  if (expect.minRankedTrips != null) {
    const n = result.triage?.ranking?.rankedTrips?.length ?? 0;
    check("minRankedTrips", n >= expect.minRankedTrips, `expected >= ${expect.minRankedTrips}, got ${n}`);
  }

  if (expect.topTripId) {
    const top = result.triage?.ranking?.rankedTrips?.[0]?.id;
    check("topTripId", top === expect.topTripId, `expected ${expect.topTripId}, got ${top}`);
  }

  if (expect.corridorConflictsMin != null) {
    const n = result.triage?.ranking?.corridorConflicts?.length ?? 0;
    check("corridorConflictsMin", n >= expect.corridorConflictsMin, `expected >= ${expect.corridorConflictsMin}, got ${n}`);
  }

  if (expect.checklistMin != null) {
    const n = result.action?.pack?.checklist?.length ?? 0;
    check("checklistMin", n >= expect.checklistMin, `expected >= ${expect.checklistMin}, got ${n}`);
  }

  if (expect.hospitalBulletins != null) {
    const n = result.action?.pack?.hospitalBulletins?.length ?? 0;
    check("hospitalBulletins", n === expect.hospitalBulletins, `expected ${expect.hospitalBulletins}, got ${n}`);
  }

  if (expect.driverCommsMin != null) {
    const n = result.action?.pack?.driverComms?.length ?? 0;
    check("driverCommsMin", n >= expect.driverCommsMin, `expected >= ${expect.driverCommsMin}, got ${n}`);
  }

  if (expect.hitlStaged != null) {
    const staged = Boolean(result.hitl?.active ?? result.action?.hitl?.active);
    check("hitlStaged", staged === expect.hitlStaged, `expected ${expect.hitlStaged}, got ${staged}`);
  }

  if (expect.packHitlRequired != null) {
    check(
      "packHitlRequired",
      result.action?.pack?.hitlRequired === expect.packHitlRequired,
      `expected ${expect.packHitlRequired}`
    );
  }

  if (expect.sopCitationsMin != null) {
    const briefN = result.monitor?.brief?.sopCitations?.length ?? 0;
    const packN = result.action?.pack?.sopCitations?.length ?? 0;
    const n = Math.max(briefN, packN);
    check("sopCitationsMin", n >= expect.sopCitationsMin, `expected >= ${expect.sopCitationsMin}, got ${n}`);
  }

  if (expect.mapSyncSource) {
    const src = result.triage?.map?.syncSource;
    check("mapSyncSource", src === expect.mapSyncSource, `expected ${expect.mapSyncSource}, got ${src}`);
  }

  if (expect.hitlHospitalPartnersMin != null) {
    const n = result.triage?.ranking?.rankedFacilities?.filter((f) => f.hitlRequired).length ?? 0;
    check(
      "hitlHospitalPartnersMin",
      n >= expect.hitlHospitalPartnersMin,
      `expected >= ${expect.hitlHospitalPartnersMin}, got ${n}`
    );
  }

  if (expect.bulletinSubjectContains) {
    const subjects = (result.action?.pack?.hospitalBulletins || []).map((b) => b.subject || "");
    const match = subjects.some((s) => s.includes(expect.bulletinSubjectContains));
    check(
      "bulletinSubjectContains",
      match,
      `expected subject containing "${expect.bulletinSubjectContains}" in ${JSON.stringify(subjects)}`
    );
  }

  if (expect.pipelineSteps) {
    const steps = result.pipeline?.steps ?? result.steps;
    check(
      "pipelineSteps",
      JSON.stringify(steps) === JSON.stringify(expect.pipelineSteps),
      `expected ${JSON.stringify(expect.pipelineSteps)}, got ${JSON.stringify(steps)}`
    );
  }

  if (expect.auditType) {
    const type = result.pipeline?.audit?.type ?? result.audit?.type;
    check("auditType", type === expect.auditType, `expected ${expect.auditType}, got ${type}`);
  }

  return { ok: failures.length === 0, checks, failures };
}

function getAtRiskFromPipeline(result) {
  const level = result.threshold ?? 2;
  return summarizeDispatch(level).atRiskTrips;
}

async function runScenarioAgents(scenario) {
  const level = scenario.level;
  resetHitl();

  const t0 = Date.now();
  const monitor = await runMonitorBrief();
  const triage = await runTriageRank({ level });
  const action = await runActionPack({ level });
  const dispatch = summarizeDispatch(level);
  const latencyMs = Date.now() - t0;

  return {
    threshold: level,
    monitor,
    triage,
    action,
    hitl: action.hitl,
    dispatch,
    latencyMs,
    modes: {
      monitor: monitor.mode,
      triage: triage.mode,
      action: action.mode,
    },
  };
}

async function runScenarioPipeline(scenario) {
  resetHitl();
  const t0 = Date.now();
  const pipeline = await runPipeline({ level: scenario.level, refreshSignals: false });
  const latencyMs = Date.now() - t0;

  return {
    threshold: pipeline.threshold,
    pipeline,
    monitor: pipeline.monitor,
    triage: pipeline.triage,
    action: pipeline.action,
    hitl: pipeline.hitl,
    dispatch: summarizeDispatch(scenario.level),
    latencyMs,
    steps: pipeline.steps,
    audit: pipeline.audit,
    modes: {
      monitor: pipeline.monitor?.mode,
      triage: pipeline.triage?.mode,
      action: pipeline.action?.mode,
    },
  };
}

export async function runEvalScenario(scenarioId) {
  const scenarios = loadScenarios();
  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) {
    return { ok: false, error: `Unknown scenario: ${scenarioId}` };
  }

  const usePipeline = scenario.id.includes("pipeline");
  const result = usePipeline
    ? await runScenarioPipeline(scenario)
    : await runScenarioAgents(scenario);

  const assertion = assertExpect(result, scenario.expect);

  return {
    ok: assertion.ok,
    scenarioId: scenario.id,
    name: scenario.name,
    level: scenario.level,
    passed: assertion.ok,
    latencyMs: result.latencyMs,
    modes: result.modes,
    checks: assertion.checks,
    failures: assertion.failures,
    ranAt: new Date().toISOString(),
  };
}

export async function runEvalSuite({ ids, skipLlm } = {}) {
  if (skipLlm && process.env.DEMO_MODE !== "true") {
    process.env.DEMO_MODE = "true";
  }

  setEvalSignalMode(true);
  clearSignalCache();

  const scenarios = loadScenarios().filter((s) => !ids?.length || ids.includes(s.id));
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const results = [];

  for (const scenario of scenarios) {
    resetHitl();
    results.push(await runEvalScenario(scenario.id));
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  lastRun = {
    ok: failed === 0,
    phase: "week-3-day-15",
    startedAt,
    completedAt: new Date().toISOString(),
    totalLatencyMs: Date.now() - t0,
    summary: { total: results.length, passed, failed },
    demoMode: process.env.DEMO_MODE !== "false",
    results,
  };

  setEvalSignalMode(false);
  clearSignalCache();

  return lastRun;
}

export function getLastEvalRun() {
  return lastRun;
}

export function buildEvalReport(run = lastRun) {
  if (!run) return { ok: false, error: "No eval run yet" };
  return run;
}
