import { logAgentEvent, getAgentLogs } from "./runtime/logger.js";
import { listTools } from "./runtime/tools.js";

export const agents = {
  monitor: { status: "brief_ready", tools: listTools().map((t) => t.name) },
  triage: { status: "rank_ready" },
  action: { status: "pack_ready" },
};

export { runMonitorBrief, runMonitorSpike } from "./monitor/brief.js";
export { runTriageRank } from "./triage/rank.js";
export { runActionPack } from "./action/pack.js";
export { getAgentLogs };