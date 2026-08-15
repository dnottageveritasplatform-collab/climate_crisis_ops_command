import { runMonitorBrief } from "../agents/monitor/brief.js";
import { runTriageRank } from "../agents/triage/rank.js";
import { runActionPack } from "../agents/action/pack.js";
import { recordPipelineRun, getAuditPersistStatus, getLastAuditPersistResult } from "../audit/index.js";
import { recordPipelineRun as recordPipelineEfficiency } from "../efficiency/index.js";
import { getHitlStatus } from "../hitl/index.js";
import { fetchSignals } from "../signals/index.js";
import { buildCadCrossReference } from "../cad/index.js";
import { buildEnrichedDispatchSummary } from "../cad/enrichment.js";
import { buildHandoffCrossReference } from "../transport-desk/index.js";
import { buildPublicSafetyCorridorCrossRef } from "../public-safety/index.js";
import { buildEsriCorridorSummary } from "../geo/esri.js";
import { buildShelterFleetCrossRef } from "../shelter-fleet/index.js";
import { buildMultiFeedCrossRef } from "../signals/multi-feed.js";
import { buildSopCorpusCrossRef } from "../sops/corpus.js";
import { buildRoutingPreviewCrossRef } from "../geo/routing.js";
import { buildFloodHazardCrossRef } from "../geo/hazards.js";
import { buildGlofasPipelineSyncStep } from "../geo/glofas.js";
import { buildUrbanFloodPipelineSyncStep } from "../geo/urban-flood.js";
import { buildUrbanFloodValidationPipelineStep } from "../geo/urban-flood-validation.js";
import { buildGlofasValidationPipelineStep } from "../geo/glofas-validation.js";
import { buildUrbanFloodAirGapPipelineStep } from "../geo/urban-flood-sovereign.js";
import { buildGlofasAirGapPipelineStep } from "../geo/glofas-sovereign.js";
import { buildFloodStackRunbookPipelineStep } from "../geo/flood-stack-runbook.js";
import { buildGlofasRunbookPipelineStep } from "../geo/glofas-runbook.js";
import { buildWindHazardCrossRef } from "../geo/wind.js";
import { buildMultiHazardCrossRef } from "../geo/multi-hazard.js";
import { getSovereignDeployStatus } from "../deploy/sovereign.js";
import { buildRoadNetworkCrossRef } from "../geo/road-network.js";
import { getDemoRehearsalStatus } from "../demo/rehearsal.js";
import { getDefensibilityStatus } from "../defensibility/index.js";

/**
 * Monitor → Triage → Action with triple HITL gate staged at end.
 */
export async function runPipeline({ level, refreshSignals = true } = {}) {
  const pipeStart = Date.now();
  const signals = await fetchSignals({ refresh: refreshSignals });

  const monitor = await runMonitorBrief();
  const threshold = level ?? signals.level ?? monitor.threshold ?? monitor.brief?.level ?? 2;

  const triage = await runTriageRank({ level: threshold });
  const action = await runActionPack({ level: threshold });

  const hitl = action.hitl ?? getHitlStatus();
  const cadCrossRef = buildCadCrossReference(threshold);
  const handoffCrossRef = buildHandoffCrossReference(threshold);
  const publicSafetyCrossRef = buildPublicSafetyCorridorCrossRef(threshold);
  const enrichedDispatch = buildEnrichedDispatchSummary(threshold);
  const esriCorridorSync = buildEsriCorridorSummary(threshold);
  const shelterFleetCrossRef = buildShelterFleetCrossRef(threshold);
  const signalMultiFeedSync = buildMultiFeedCrossRef(threshold);
  const sopCorpusSync = buildSopCorpusCrossRef(threshold);
  const routingPreviewSync = buildRoutingPreviewCrossRef(threshold);
  const floodHazardSync = buildFloodHazardCrossRef(threshold);
  const glofasFloodSync = await buildGlofasPipelineSyncStep(threshold, { floodHazardSync });
  const urbanFloodSync = await buildUrbanFloodPipelineSyncStep(threshold, { floodHazardSync });
  const urbanFloodValidationSync = buildUrbanFloodValidationPipelineStep();
  const urbanFloodAirGapSync = buildUrbanFloodAirGapPipelineStep();
  const glofasValidationSync = buildGlofasValidationPipelineStep();
  const glofasAirGapSync = buildGlofasAirGapPipelineStep();
  const glofasRunbookSync = buildGlofasRunbookPipelineStep(threshold);
  const floodStackRunbookSync = buildFloodStackRunbookPipelineStep(threshold);
  const windHazardSync = buildWindHazardCrossRef(threshold);
  const multiHazardSync = buildMultiHazardCrossRef(threshold);
  const sovereignDeploySync = getSovereignDeployStatus();
  const roadNetworkSync = buildRoadNetworkCrossRef(threshold);
  const demoRehearsalSync = getDemoRehearsalStatus();
  const defensibilitySync = getDefensibilityStatus();
  const audit = recordPipelineRun({
    signals,
    monitor,
    triage,
    action,
    hitl,
    threshold,
    mode: monitor.mode || "demo",
    cadCrossRef,
    handoffCrossRef,
    publicSafetyCrossRef,
    enrichedDispatch,
    esriCorridorSync,
    shelterFleetCrossRef,
    signalMultiFeedSync,
    sopCorpusSync,
    routingPreviewSync,
    floodHazardSync,
    glofasFloodSync,
    urbanFloodSync,
    urbanFloodValidationSync,
    urbanFloodAirGapSync,
    glofasValidationSync,
    glofasAirGapSync,
    glofasRunbookSync,
    floodStackRunbookSync,
    windHazardSync,
    multiHazardSync,
    sovereignDeploySync,
    roadNetworkSync,
    demoRehearsalSync,
    defensibilitySync,
  });
  const auditPersist = {
    ...getAuditPersistStatus(),
    lastWrite: getLastAuditPersistResult(),
    pipelineAuditId: audit.id,
  };

  const totalLatencyMs = Date.now() - pipeStart;
  const agents = {
    monitor: monitor.efficiency,
    triage: triage.efficiency,
    action: action.efficiency,
  };
  const modes = {
    monitor: monitor.mode,
    triage: triage.mode,
    action: action.mode,
  };
  const totalTokens =
    (monitor.efficiency?.tokens || 0) +
    (triage.efficiency?.tokens || 0) +
    (action.efficiency?.tokens || 0);

  const efficiency = recordPipelineEfficiency({
    pipelineId: audit.id,
    threshold,
    totalLatencyMs,
    totalTokens,
    agents,
    modes,
  });

  return {
    ok: true,
    phase: "phase-3b-day-10",
    pipelineId: audit.id,
    threshold,
    steps: ["monitor", "triage", "action", "cad_cross_ref", "handoff_cross_ref", "public_safety_cross_ref", "cad_dispatch_enrich", "esri_corridor_sync", "shelter_fleet_cross_ref", "signal_multi_feed_sync", "sop_corpus_sync", "routing_preview_sync", "flood_hazard_sync", "glofas_flood_sync", "urban_flood_sync", "urban_flood_validation_sync", "urban_flood_airgap_sync", "glofas_validation_sync", "glofas_airgap_sync", "glofas_runbook_sync", "flood_stack_runbook_sync", "wind_hazard_sync", "multi_hazard_sync", "sovereign_deploy_sync", "road_network_sync", "demo_rehearsal_sync", "defensibility_sync", "audit_persist"],
    signals,
    monitor,
    triage,
    action,
    map: triage.map,
    cadCrossRef,
    handoffCrossRef,
    publicSafetyCrossRef,
    enrichedDispatch,
    esriCorridorSync,
    shelterFleetCrossRef,
    signalMultiFeedSync,
    sopCorpusSync,
    routingPreviewSync,
    floodHazardSync,
    glofasFloodSync,
    urbanFloodSync,
    urbanFloodValidationSync,
    urbanFloodAirGapSync,
    glofasValidationSync,
    glofasAirGapSync,
    glofasRunbookSync,
    floodStackRunbookSync,
    windHazardSync,
    multiHazardSync,
    sovereignDeploySync,
    roadNetworkSync,
    demoRehearsalSync,
    defensibilitySync,
    auditPersist,
    hitl,
    audit,
    efficiency,
    hitlGate: hitl.active ? hitl.state : "idle",
    message:
      "Pipeline complete — Phase 3b Day 10: three-layer flood stack runbook (8-rule agency · GloFAS · commercial trust matrix), flood_stack_runbook_sync audit chip, and defensibility three-layer honest stack narrative — Phase 3b close-out.",
  };
}
