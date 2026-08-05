# Climate & Crisis Ops Command

**Future Caribbean Buildathon 2026** — Climate Risk & Disaster Coordination track

Post-storm crisis coordination for Caribbean operators and hospital-adjacent partners: institutional signals → agent orchestration → dual human-in-the-loop approvals → operational actions on a thin map view.

## Sprint focus

- **Not** Global Monitor as a research brief tool
- **Not** full 911/CAD replacement in the 21-day window
- **Yes** NEMT + hospital liaison coordination on a shared command surface (map pins, corridors, dual HITL)
- **Yes** founder lineage from Broward County IT GIS multi-agency weather response (fire, police, EMS/hospital)

## Quick start (Day 1)

```bash
cp .env.example .env
npm install
npm start
```

Open http://127.0.0.1:8787 — health check at `/api/health`.

## Documentation

- `SPRINT.docx` — 21-day plan, demo script, pitch outline, Logbook templates
- `docs/logbook-week1.md` — Logbook entry #1 (Day 7, paste-ready)
- `docs/architecture-diagram.html` — Week 1 architecture diagram (Day 7)
- `docs/architecture.docx` — system architecture, dual HITL, thin GIS layer, Phase 2 roadmap
- `docs/track-switch-note.docx` — send to Future Caribbean organizers (Day 1)
- `docs/sops/` — multi-agency SOP templates for RAG

Regenerate Word docs: `py scripts/generate_docs.py`

## Repository layout

```
src/signals/      Signal ingest (Week 1 Day 3+)
src/agents/       Monitor, Triage, Action (Week 1 Day 5+)
src/orchestrator/ Pipeline runner (Week 2)
src/hitl/         Dual-role approvals (Week 2)
src/audit/        Audit log (Week 2)
src/sops/         Crisis SOP RAG corpus (Week 1 Day 6+)
src/dispatch/     NEMT dispatch manifest loader (Week 1 Day 6+)
src/geo/          Thin map layers (Week 1 Day 6+)
src/ui/public/    Command surface shell
data/             Sample dispatch CSV + GeoJSON corridors/facilities
docs/             Architecture and SOP Word docs
```

## Parent platform

Built on [KnightRoad Veritas](https://knightroadveritas.app) agent + command-center architecture.

## Status

**Week 2, Day 9 complete** — Action agent generates operational checklist, COMMS-03 hospital bulletin draft, and driver SMS drafts. All drafts require dual HITL before send. Demo mode — no Nebius/LLM required.

### Day 9 quick test

```bash
npm start
curl -X POST http://127.0.0.1:8787/api/agents/action/pack
npm run action:pack
# Open http://127.0.0.1:8787 — Monitor → Triage → Action; Action tab shows checklist + COMMS-03 + SMS
```

Action flow: `get_signal_status` → `summarize_dispatch` → `query_sop(COMMS-03)` → checklist + bulletin + driver comms → audit entry.

### Day 8 quick test

```bash
npm start
curl -X POST http://127.0.0.1:8787/api/agents/triage/rank
npm run triage:rank
# Open http://127.0.0.1:8787 — Run Monitor, then Triage; map shows #rank labels
```

Triage flow: `get_signal_status` → `summarize_dispatch(level)` → ranked trips / facilities / corridor conflicts → audit entry.

**LLM note:** Leave `DEMO_MODE=true` and no `LLM_*` keys until Nebius business email is set up. Demo scoring is judge-ready.

### Day 7 quick test (Week 1 exit criteria)

```bash
npm start
# Open http://127.0.0.1:8787 — click "Week 1 Demo" (gold button)
npm run demo:week1
curl -X POST http://127.0.0.1:8787/api/demo/week1
curl http://127.0.0.1:8787/api/audit/latest
```

**Deliverables:** `docs/logbook-week1.md` (paste-ready) · `docs/architecture-diagram.html` (open in browser)

**Exit criteria:** ✅ Signal in · ✅ Monitor brief on map · ✅ Audit log entry

### Day 6 quick test

```bash
npm start
curl http://127.0.0.1:8787/api/dispatch
curl "http://127.0.0.1:8787/api/geo/layers?level=2"
curl "http://127.0.0.1:8787/api/sops/query?q=COMMS-03"
# Open http://127.0.0.1:8787 — map loads pins + corridors from API
```

SOP corpus: `data/sops/*.txt` (3 files) · GeoJSON: `data/geo/` · Dispatch: `data/sample-dispatch.csv`

### Day 5 quick test

```bash
npm start
curl -X POST http://127.0.0.1:8787/api/agents/monitor/brief | jq '.brief.level, .brief.sopCitations[0].ref, .threshold'
# Open http://127.0.0.1:8787 — Run Monitor shows cited SOP refs + confidence
npm run brief:monitor   # CLI
```

Brief flow: `get_signal_status` → threshold plan (`Level N`, `CORR`, optional `COMMS-03`) → `summarize_dispatch(level)` → cited brief.

### Day 4 quick test

```bash
npm start
# Open http://127.0.0.1:8787 — alert banner loads from signal feed
# Click "Run Monitor" — timeline + brief populate; HITL gate shows pending review
curl http://127.0.0.1:8787/api/status
```

Static mockup reference: `docs/mockups/command-center-day1-day2.html`

### Day 3 quick test

```bash
npm.cmd start
curl http://127.0.0.1:8787/api/signals
curl -X POST http://127.0.0.1:8787/api/signals/refresh
curl -X POST http://127.0.0.1:8787/api/agents/monitor/spike
```

Optional: `NHC_FEED_URL` is set in `.env.example` to the Atlantic Tropical Weather Outlook (`TWOAT.xml`). Escalation level stays on demo SOP thresholds; live NHC text overlays the weather signal.

### Day 2 quick test

```bash
npm run spike:monitor          # CLI
curl -X POST http://127.0.0.1:8787/api/agents/monitor/spike
curl http://127.0.0.1:8787/api/agents/logs
```

Optional: set `LLM_*` or `OPENAI_API_KEY` in `.env` for LLM briefs. Leave unset for demo mode (recommended until credits available).
