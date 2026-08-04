# OpenClaw integration

Future Caribbean lists OpenClaw as a primary agentic framework for the sprint.

## Day 2 decision

- **Pattern:** Tool-calling agent loop with structured audit logging (OpenClaw-compatible).
- **Sprint MVP:** Monitor agent spike in `src/agents/runtime/` invoked via Express API.
- **Gateway:** Install OpenClaw globally when ready; skill stub lives in `openclaw/workspace/skills/climate-monitor/`.
- **Week 2:** Wire Triage and Action agents; optional Gateway delegation for HITL notifications.

## Verify OpenClaw CLI (optional)

```bash
node -v   # need 22.22.3+ (you have 24.x)
npm install -g openclaw@latest
openclaw --version
openclaw doctor
```

See https://docs.openclaw.ai/install
