import { logAgentEvent, getAgentLogs } from "./runtime/logger.js";
import { listTools } from "./runtime/tools.js";

export const agents = {
  monitor: { status: "brief_ready", tools: listTools().map((t) => t.name) },
  triage: { status: "pending" },
  action: { status: "pending" },
};

export { runMonitorBrief, runMonitorSpike } from "./monitor/brief.js";
export { getAgentLogs };