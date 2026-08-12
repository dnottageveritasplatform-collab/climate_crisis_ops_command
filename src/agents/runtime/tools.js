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
import { querySopCorpus } from "../../sops/index.js";

const registry = {
  get_signal_status: {
    description: "Current weather escalation level and institutional signal summary",
    parameters: { type: "object", properties: {} },
    execute: async () => getSignalStatus(),
  },
  query_sop: {
    description: "RAG search over crisis SOP corpus by keyword (Level 2, CORR, COMMS-03, etc.)",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "SOP section keyword" },
      },
      required: ["query"],
    },
    execute: async ({ query }) => querySopCorpus(query),
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
