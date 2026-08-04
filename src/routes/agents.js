import { Router } from "express";
import { runMonitorBrief, getAgentLogs } from "../agents/index.js";
import { listTools } from "../agents/runtime/tools.js";

const router = Router();

router.get("/tools", (_req, res) => {
  res.json({ tools: listTools() });
});

router.get("/logs", (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json({ logs: getAgentLogs(limit) });
});

async function handleMonitorBrief(_req, res) {
  try {
    const result = await runMonitorBrief();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

router.post("/monitor/brief", handleMonitorBrief);
router.post("/monitor/spike", handleMonitorBrief);

export default router;
