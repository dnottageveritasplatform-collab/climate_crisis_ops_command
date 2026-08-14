import { getSignalStatus } from "../../signals/index.js";
import { buildCadCrossReference } from "../../cad/index.js";
import { buildEnrichedDispatchSummary } from "../../cad/enrichment.js";
import { getTransportDeskStatus } from "../../transport-desk/index.js";
import { getPublicSafetyStatus } from "../../public-safety/index.js";
import { getShelterFleetStatus } from "../../shelter-fleet/index.js";
import { buildEsriCorridorSummary } from "../../geo/esri.js";
import { buildEocAuditBriefing } from "../../audit/eoc-export.js";
import { getAuditPersistStatus } from "../../audit/index.js";
import { getMultiFeedStatus } from "../../signals/multi-feed.js";
import { getSopCorpusStatus } from "../../sops/corpus.js";
import { getRoutingPreviewStatus } from "../../geo/routing.js";
import { getFloodHazardStatus } from "../../geo/hazards.js";
import { getWindHazardStatus } from "../../geo/wind.js";
import { getMultiHazardStatus } from "../../geo/multi-hazard.js";
import { getSovereignDeployStatus } from "../../deploy/sovereign.js";
import { getRoadNetworkStatus } from "../../geo/road-network.js";
import { getDemoRehearsalStatus } from "../../demo/rehearsal.js";
import { getDefensibilityStatus } from "../../defensibility/index.js";
import { querySopCorpus } from "../../sops/index.js";

const registry = {
  get_signal_status: {
    description: "Current weather escalation level and institutional signal summary",
    parameters: { type: "object", properties: {} },
    execute: async () => getSignalStatus(),
  },
  query_sop: {
    description:
      "RAG search over expanded operator SOP corpus — hybrid keyword + TF-IDF semantic (Level 2, CORR, COMMS-03, SHELTER, FLEET)",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "SOP section keyword or phrase" },
        mode: { type: "string", description: "keyword | semantic | hybrid (default hybrid when enabled)" },
      },
      required: ["query"],
    },
    execute: async ({ query, mode }) => querySopCorpus(query, mode ? { mode } : {}),
  },
  summarize_dispatch: {
    description:
      "Summarize NEMT trips at risk with live CAD run status + handoff assignment (Phase 2 Day 5 enrichment)",
    parameters: {
      type: "object",
      properties: {
        level: { type: "number", description: "Escalation level 1-4" },
      },
    },
    execute: async ({ level = 2 } = {}) => buildEnrichedDispatchSummary(level),
  },
  get_cad_cross_ref: {
    description:
      "Cross-reference at-risk CCOC trips with read-only CAD run/incident IDs (Phase 2 adapter)",
    parameters: {
      type: "object",
      properties: {
        level: { type: "number", description: "Escalation level 1-4" },
      },
    },
    execute: async ({ level = 2 } = {}) => buildCadCrossReference(level),
  },
  get_transport_desk_status: {
    description:
      "Hospital transport desk signals — bed pressure, diversion, elective hold, EMS-to-NEMT handoff queue (read-only)",
    parameters: { type: "object", properties: {} },
    execute: async () => getTransportDeskStatus(),
  },
  get_public_safety_status: {
    description:
      "Fire / police read-only unit status from EOC feed — corridor assignments, no dispatch authority",
    parameters: { type: "object", properties: {} },
    execute: async () => getPublicSafetyStatus(),
  },
  get_corridor_layers: {
    description:
      "ESRI / agency GIS corridor closure layer — replaces static GeoJSON when pilot provides feature service (read-only)",
    parameters: {
      type: "object",
      properties: {
        level: { type: "number", description: "Escalation level 1-4" },
      },
    },
    execute: async ({ level = 2 } = {}) => buildEsriCorridorSummary(level),
  },
  get_shelter_fleet_status: {
    description:
      "Shelter capacity + fleet logistics coordination feed — extended HITL personas (Phase 2 Day 7)",
    parameters: { type: "object", properties: {} },
    execute: async () => getShelterFleetStatus(),
  },
  get_audit_persist_status: {
    description:
      "Persistent audit store status — JSONL append-only trail for EOC export (Phase 2 Day 8)",
    parameters: { type: "object", properties: {} },
    execute: async () => getAuditPersistStatus(),
  },
  get_eoc_audit_briefing: {
    description:
      "EOC audit briefing bundle — persisted audit trail + common operating picture snapshot (read-only)",
    parameters: {
      type: "object",
      properties: {
        level: { type: "number", description: "Escalation level 1-4" },
      },
    },
    execute: async ({ level = 2 } = {}) => buildEocAuditBriefing({ level }),
  },
  get_multi_feed_status: {
    description:
      "Multi-feed signal ingest status — NHC live + institutional overlays (OCHA/GFDRR) with corridor cross-ref (Phase 2 Day 9)",
    parameters: { type: "object", properties: {} },
    execute: async () => getMultiFeedStatus(),
  },
  get_sop_corpus_status: {
    description:
      "Expanded operator SOP corpus status — file count, hybrid semantic RAG mode, scenario-matched SOPs (Phase 2 Day 10)",
    parameters: { type: "object", properties: {} },
    execute: async () => getSopCorpusStatus(),
  },
  get_routing_preview_status: {
    description:
      "Corridor-aware routing preview — alternate route advisories for at-risk trips on restricted corridors (Phase 2 Day 11)",
    parameters: { type: "object", properties: {} },
    execute: async () => getRoutingPreviewStatus(),
  },
  get_flood_hazard_status: {
    description:
      "Flood-depth hazard GIS overlay — active zones, corridor-linked exposure, and at-risk trip count (Phase 2 Day 12)",
    parameters: { type: "object", properties: {} },
    execute: async () => getFloodHazardStatus(),
  },
  get_wind_hazard_status: {
    description:
      "Wind-exposure hazard GIS overlay — active gust zones, corridor-linked exposure, and at-risk trip count (Phase 2 Day 13)",
    parameters: { type: "object", properties: {} },
    execute: async () => getWindHazardStatus(),
  },
  get_multi_hazard_status: {
    description:
      "Combined hazard + routing fusion — per-trip flood/wind exposure with alternate route advisories for EOC briefing (Phase 2 Day 14)",
    parameters: { type: "object", properties: {} },
    execute: async () => getMultiHazardStatus(),
  },
  get_sovereign_deploy_status: {
    description:
      "Sovereign on-prem deploy readiness — data residency checks, local audit persist, air-gapped demo profile (Phase 2 Day 15)",
    parameters: { type: "object", properties: {} },
    execute: async () => getSovereignDeployStatus(),
  },
  get_road_network_status: {
    description:
      "Pilot road network graph — turn-by-turn corridor avoidance routes for at-risk trips on restricted corridors (Phase 2 Day 16)",
    parameters: { type: "object", properties: {} },
    execute: async () => getRoadNetworkStatus(),
  },
  get_demo_rehearsal_status: {
    description:
      "5-minute demo rehearsal beat sheet — live eval pass count, pipeline efficiency stats, pitch script API (Phase 2 Day 17)",
    parameters: { type: "object", properties: {} },
    execute: async () => getDemoRehearsalStatus(),
  },
  get_defensibility_status: {
    description:
      "Defensibility pitch — Broward founder credibility, five pillars, Phase 2 complete stats, paste-ready slide API (Phase 2 Day 18)",
    parameters: { type: "object", properties: {} },
    execute: async () => getDefensibilityStatus(),
  },
};

export function listTools() {
  return Object.entries(registry).map(([name, def]) => ({
    name,
    description: def.description,
    parameters: def.parameters,
  }));
}

export async function runTool(name, args = {}) {
  const tool = registry[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.execute(args);
}
