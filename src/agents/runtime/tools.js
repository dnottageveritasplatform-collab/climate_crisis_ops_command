import { getSignalStatus } from "../../signals/index.js";
import { summarizeDispatch } from "../../dispatch/index.js";
import { buildCadCrossReference } from "../../cad/index.js";
import { getTransportDeskStatus } from "../../transport-desk/index.js";
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
    description: "Summarize synthetic NEMT trips at risk for current escalation level",
    parameters: {
      type: "object",
      properties: {
        level: { type: "number", description: "Escalation level 1-4" },
      },
    },
    execute: async ({ level = 2 } = {}) => summarizeDispatch(level),
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
