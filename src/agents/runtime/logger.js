const entries = [];
const MAX = 200;

export function logAgentEvent(event, payload = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...payload,
  };
  entries.unshift(entry);
  if (entries.length > MAX) entries.length = MAX;
  console.log(`[agent] ${event}`, payload.agent ? `${payload.agent} ` : "", payload.message || payload.tool || "");
  return entry;
}

export function getAgentLogs(limit = 50) {
  return entries.slice(0, limit);
}

export function clearAgentLogs() {
  entries.length = 0;
}
