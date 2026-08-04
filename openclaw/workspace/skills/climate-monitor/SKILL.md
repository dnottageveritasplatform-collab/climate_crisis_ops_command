# climate-monitor (OpenClaw skill stub)

Future Caribbean sprint skill for the Monitor agent on Climate & Crisis Ops Command.

## Purpose

When OpenClaw Gateway is running locally, this skill documents the Monitor agent
responsibilities and tool surface for post-storm coordination briefs.

## Tools (mirrored in src/agents/runtime/tools.js)

- `get_signal_status` — current escalation level (demo or live feeds)
- `query_sop` — RAG over multi-file crisis SOP corpus (`data/sops/*.txt`)
- `summarize_dispatch` — impacted NEMT trips from dispatch manifest

## Day 6 status

Dispatch manifest, geo layer API (`/api/geo/layers`), and SOP RAG corpus
(`/api/sops/query`) are live. Command map renders facilities, corridors, and
at-risk trip pins from projected layer data.

## Day 5 status

Monitor agent runs a **threshold-driven tool plan**: reads signal level, queries matching SOP
sections + corridor rules, summarizes at-risk dispatch, and returns a brief with structured
citations (`sopId`, `section`, `ref`, `line`).

## API

- `POST /api/agents/monitor/brief` — canonical Monitor run
- `POST /api/agents/monitor/spike` — alias (Day 2 compat)
- `GET /api/agents/logs` — agent timeline events

## Day 2 status

In-repo spike runs via Express API (`POST /api/agents/monitor/spike`) using an
OpenClaw-compatible tool loop. Full Gateway wiring is Week 2 after signal ingest.

## Setup (when ready)

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
openclaw setup --baseline
```

Copy this skill into `~/.openclaw/workspace/skills/` or symlink this folder.
