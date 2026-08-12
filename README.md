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

**Windows (PowerShell):** `curl` is an alias for `Invoke-WebRequest` — use `curl.exe` for the examples below, or `Invoke-RestMethod -Method POST -Uri …`.

## Documentation

- `SPRINT.docx` — 21-day plan, demo script, pitch outline, Logbook templates
- `docs/logbook-week1.md` — Logbook entry #1 (Day 7, paste-ready)
- `docs/logbook-week2.md` — Logbook entry #2 (Day 14, paste-ready)
- `docs/logbook-week3.md` — Logbook entry #3 (Day 20, paste-ready)
- `docs/mentor-questions.md` — Prioritized mentor ask list (Day 20)
- `docs/demo-day-runbook.md` — Demo day live run checklist (Day 21)
- `docs/demo-day-qa.md` — Judge Q&A prep (Day 21)
- `docs/demo-2min-capture.md` — 2-min screen capture script (Day 14)
- `docs/demo-5min-rehearsal.md` — 5-min pitch rehearsal (Day 17)
- `docs/defensibility-slide.md` — Broward + defensibility pitch copy (Day 18)
- `docs/phase2-roadmap.md` — CAD/EMS integration roadmap (Day 18)
- `docs/logbook-phase2-day1.md` — Phase 2 Day 1 CAD overlay (paste-ready)
- `docs/logbook-phase2-day2.md` — Phase 2 Day 2 transport desk (paste-ready)
- `docs/staging-deploy.md` — Staging deploy guide (Day 19)
- `docs/backup-demo-video.md` — Offline MP4 capture (Day 19)
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
src/cad/          CAD read-only overlay adapter (Phase 2 Day 1)
src/transport-desk/ EMS-adjacent hospital desk + handoff queue (Phase 2 Day 2)
src/public-safety/ Fire/police EOC overlay + COP export (Phase 2 Day 3)
src/geo/          Thin map layers (Week 1 Day 6+)
src/eval/          Eval harness — scripted scenarios (Week 3)
src/efficiency/    Token + latency logging (Week 3)
src/defensibility/ Defensibility narrative + Phase 2 roadmap (Week 3)
src/deploy/         Staging deploy checklist (Week 3)
src/logbook/        Logbook #3 + mentor questions (Week 3)
src/demo/           Rehearsal + demo day runbook (Week 3)
data/             Sample dispatch CSV + GeoJSON corridors/facilities
docs/             Architecture and SOP Word docs
```

## Parent platform

Built on [KnightRoad Veritas](https://knightroadveritas.app) agent + command-center architecture.

## Status

**Phase 2 Day 8 complete** — Persistent JSONL audit store + EOC audit briefing export (survives restart).

### Phase 2 Day 8 quick test

```bash
npm run pipeline:run
npm run audit:persist
npm run audit:eoc-briefing
curl.exe http://127.0.0.1:8787/api/audit/eoc-briefing?level=2
npm run eval:run
# UI: Audit strip → EOC audit export link
```

**Deliverables:** `src/audit/store.js` · `src/audit/eoc-export.js` · `GET /api/audit/eoc-briefing` · pipeline `audit_persist`

Append-only persistence for EOC briefings — not dispatch authority.

**Phase 2 Day 7 complete** — Shelter + fleet coordination feed with extended 5-role HITL (shelter coordinator + fleet logistics at L2+).

### Phase 2 Day 7 quick test

```bash
npm run shelter-fleet:summary
curl.exe http://127.0.0.1:8787/api/shelter-fleet/summary?level=2
curl.exe http://127.0.0.1:8787/api/shelter-fleet/cross-ref?level=2
npm run pipeline:run
npm run eval:run
# UI: Shelter/fleet strip · 5-role Extended HITL panel · audit shelter/fleet chips
```

**Deliverables:** `src/shelter-fleet/` · `GET /api/shelter-fleet/*` · extended HITL · pipeline `shelter_fleet_cross_ref`

Coordination + approval only — not shelter operations authority or fleet dispatch.

**Phase 2 Day 6 complete** — ESRI corridor feature service adapter replaces static GeoJSON when agency provides GIS layers.

### Phase 2 Day 6 quick test

```bash
npm run geo:corridors-esri
curl.exe http://127.0.0.1:8787/api/geo/corridors/esri?level=2
curl.exe http://127.0.0.1:8787/api/geo/corridors/source
npm run pipeline:run
npm run eval:run
# UI: map badge shows "ESRI corridors" · audit chips show CORR-02·restricted
```

**Deliverables:** `src/geo/esri.js` · `GET /api/geo/corridors/esri` · `get_corridor_layers` Monitor tool · pipeline `esri_corridor_sync`

Read-only corridor closure overlay — not turn-by-turn routing or ESRI Enterprise write-back.

**Phase 2 Day 5 complete** — Bidirectional CAD enrichment: live run status + handoff state merged onto dispatch manifest and map.

### Phase 2 Day 5 quick test

```bash
npm run cad:enriched-dispatch
curl.exe http://127.0.0.1:8787/api/cad/enriched-dispatch?level=2
npm run pipeline:run
npm run eval:run
# UI: at-risk trips show R8842 · en route labels · Monitor tool shows CAD live count
```

**Deliverables:** `src/cad/enrichment.js` · `GET /api/cad/enriched-dispatch` · enriched `summarize_dispatch` tool

Enriches dispatch with live CAD + handoff data — read/sync only, not new write authority.

### Phase 2 Day 4 quick test

```bash
npm run transport-desk:accept-demo
curl.exe http://127.0.0.1:8787/api/transport-desk/writeback-status
curl.exe -X POST http://127.0.0.1:8787/api/transport-desk/handoff-accept -H "Content-Type: application/json" -d "{\"handoffs\":[{\"handoffId\":\"HO-2201\",\"status\":\"nemt_assigned\",\"nemtRunId\":\"RUN-8845\",\"linkedTripId\":\"T-1004\"}]}"
npm run pipeline:run
npm run eval:run
# UI: http://127.0.0.1:8787 — Demo accept HO-2201 · audit handoff_writeback chip
```

**Deliverables:** `src/transport-desk/writeback.js` · `POST /api/transport-desk/handoff-accept` · patch ingest · audit `handoff_writeback`

Handoff accept write-back only — not COMMS-03 HITL, not 911 dispatch, not auto-send messaging.

### Phase 2 Day 3 quick test

```bash
npm run public-safety:summary
npm run public-safety:cross-ref
npm run public-safety:cop-export
curl.exe http://127.0.0.1:8787/api/public-safety/summary
curl.exe http://127.0.0.1:8787/api/public-safety/cross-ref?level=2
curl.exe http://127.0.0.1:8787/api/public-safety/cop-export?level=2
npm run pipeline:run
npm run eval:run
# UI: http://127.0.0.1:8787 — EOC strip · fire/police pins on map · COP export link
```

**Deliverables:** `src/public-safety/` · `data/sample-public-safety-units.json` · `GET/POST /api/public-safety/*`

Read-only EOC overlay — fire/police unit status on shared map; COP JSON bundles NEMT + transport desk + public-safety feeds for briefings. No dispatch authority.

### Phase 2 Day 2 quick test

```bash
npm run transport-desk:summary
npm run transport-desk:cross-ref
curl.exe http://127.0.0.1:8787/api/transport-desk/summary
curl.exe http://127.0.0.1:8787/api/transport-desk/handoff-queue
curl.exe http://127.0.0.1:8787/api/transport-desk/cross-ref?level=2
npm run pipeline:run
npm run eval:run
# UI: http://127.0.0.1:8787 — transport desk strip · hospital bed % on map
```

**Deliverables:** `src/transport-desk/` · `data/sample-hospital-desk.json` · `data/sample-ems-handoff-queue.json` · `docs/logbook-phase2-day2.md` · `GET/POST /api/transport-desk/*`

Read-only hospital transport desk — bed pressure + diversion + scheduled inter-facility handoff queue; not 911 dispatch.

### Phase 2 Day 1 quick test

```bash
npm run cad:summary
npm run cad:cross-ref
curl.exe http://127.0.0.1:8787/api/cad/summary
curl.exe http://127.0.0.1:8787/api/cad/cross-ref?level=2
curl.exe http://127.0.0.1:8787/api/cad/overlay
curl.exe http://127.0.0.1:8787/api/defensibility/phase2
npm run pipeline:run
# UI: http://127.0.0.1:8787 — map shows CAD unit pins · audit shows trip→run cross-ref
```

**Deliverables:** `src/cad/` · `data/sample-cad-export.csv` · `docs/logbook-phase2-day1.md` · `GET/POST /api/cad/*`

Read-only CAD overlay — ingest pilot CSV, correlate at-risk trips with run/incident IDs, no dispatch write-back.

**21-day sprint complete** — Demo day live run + Q&A prep. Preflight, runbook, and judge Q&A ready.

### Day 21 quick test

```bash
npm run demo:preflight
npm run demo:runbook
npm run demo:qa
curl.exe http://127.0.0.1:8787/api/demo/runbook
curl.exe http://127.0.0.1:8787/api/demo/qa
curl.exe -X POST http://127.0.0.1:8787/api/demo/preflight
# Live demo: http://127.0.0.1:8787 — Run Pipeline → triple HITL → audit
```

**Deliverables:** `src/demo/day21.js` · `docs/demo-day-runbook.md` · `docs/demo-day-qa.md` · `GET/POST /api/demo/*`

**Sprint exit criteria:** ✅ End-to-end workflow · ✅ 8/8 eval · ✅ Efficiency metrics · ✅ 5-min demo · ✅ Staging + backup · ✅ Logbooks #1–3

### Day 20 quick test

```bash
npm run eval:run
npm run logbook:week3
npm run mentor:questions
curl.exe http://127.0.0.1:8787/api/logbook/week3
curl.exe "http://127.0.0.1:8787/api/logbook/week3?format=text"
curl.exe http://127.0.0.1:8787/api/logbook/mentor-questions
curl.exe "http://127.0.0.1:8787/api/logbook/mentor-questions?priority=high&format=text"
```

**Deliverables:** `src/logbook/index.js` · `docs/logbook-week3.md` · `docs/mentor-questions.md` · `GET /api/logbook/*`

Paste-ready Logbook #3 for organizers; mentor questions tagged by rubric (3 high-priority for demo day).

### Day 19 quick test

```bash
npm run deploy:check
npm run docker:build
docker run --rm -p 8787:8787 -e DEMO_MODE=true ccoc:staging
curl.exe http://127.0.0.1:8787/api/deploy/checklist
```

**Deliverables:** `Dockerfile` · `docs/staging-deploy.md` · `docs/backup-demo-video.md` · `GET /api/deploy/checklist`

Recommended staging: `DEMO_MODE=true` on Nebius (Container VM, no GPU) or Render/Railway. Record backup MP4 per `docs/backup-demo-video.md`.

### Day 18 quick test

```bash
npm run defensibility:summary
curl.exe http://127.0.0.1:8787/api/defensibility/summary
curl.exe http://127.0.0.1:8787/api/defensibility/narrative
curl.exe http://127.0.0.1:8787/api/defensibility/phase2
```

**Deliverables:** `src/defensibility/index.js` · `docs/defensibility-slide.md` · `docs/phase2-roadmap.md` · `GET /api/defensibility/*`

Paste-ready pitch slides: Broward County IT founder proof + five defensibility pillars + Phase 2 CAD read-only / EMS-adjacent tracks.

### Day 17 quick test

```bash
npm run eval:run
npm run demo:rehearsal
curl.exe http://127.0.0.1:8787/api/demo/rehearsal
curl.exe "http://127.0.0.1:8787/api/demo/rehearsal?format=text"
```

**Deliverables:** `docs/demo-5min-rehearsal.md` · `src/demo/rehearsal.js` · `GET /api/demo/rehearsal`

Rehearse live demo per beat sheet; proof segment pulls 8/8 eval + last pipeline ms/tokens. Shorter judge cut: `docs/demo-2min-capture.md`.

### Day 16 quick test

```bash
npm run efficiency:pipeline
npm run efficiency:summary
curl.exe http://127.0.0.1:8787/api/efficiency/summary
curl.exe http://127.0.0.1:8787/api/efficiency/narrative
```

**Deliverables:** `src/efficiency/index.js` · `docs/efficiency-narrative.md` · `GET /api/efficiency/*`

Metrics logged: per-agent latency, LLM prompt/completion/total tokens, last pipeline rollup. Demo mode = 0 tokens; MiniMax (or configured provider) logs usage when `DEMO_MODE=false`.

### Day 15 quick test

```bash
npm run eval:run
curl.exe http://127.0.0.1:8787/api/eval/scenarios
curl.exe -X POST http://127.0.0.1:8787/api/eval/run
curl.exe http://127.0.0.1:8787/api/eval/results
```

Scenarios assert at-risk trip counts, corridor status, triage rank order, COMMS-03 bulletins, triple HITL staging, map sync, and pipeline audit entries. Default eval run uses `skipLlm: true` (demo mode) for fast, deterministic CI-style checks.

**Deliverables:** `data/eval/scenarios.json` · `src/eval/index.js` · `GET/POST /api/eval/*`

### Day 14 quick test

```bash
npm start
curl.exe http://127.0.0.1:8787/api/scenario
curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
# Open http://127.0.0.1:8787 — scenario strip, named HITL personas, multi-agency alert copy
# Record walkthrough using docs/demo-2min-capture.md
```

**Deliverables:** `docs/logbook-week2.md` · `docs/demo-2min-capture.md` · `docs/mockups/command-center-llm-mode.jpg`

**Week 2 exit criteria:** ✅ End-to-end pipeline · ✅ Triage-synced map · ✅ Triple HITL approved · ✅ Audit trail with citations + approvers

### Day 13 quick test

```bash
npm start
curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
curl.exe http://127.0.0.1:8787/api/audit/trail
# Approve all three HITL roles in UI — audit trail shows steps, citations, approver @ timestamps
npm run audit:trail
```

Audit trail: each entry logs `steps[]`, `citations[]` (SOP refs), and on release `approvers[]` with `reviewedAt` / `approvedAt`.

### Day 12 quick test

```bash
npm start
curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
npm run pipeline:run
# Open http://127.0.0.1:8787 — click "Run Pipeline" (gold); brief + triage map + action pack + HITL gate populate
```

PowerShell alternative:

```powershell
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:8787/api/orchestrator/run
```

Pipeline flow: signals → Monitor brief → Triage rank (map sync) → Action pack → triple HITL staged → audit entry.

### Day 11 quick test

```bash
npm start
curl.exe -X POST http://127.0.0.1:8787/api/agents/triage/rank
curl.exe http://127.0.0.1:8787/api/geo/layers/triage
npm run triage:rank
# Open http://127.0.0.1:8787 — Run Monitor → Triage; map shows #rank pins, CORR status, facility #rank, triage-sync badge
```

PowerShell alternative:

```powershell
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:8787/api/agents/triage/rank
Invoke-RestMethod http://127.0.0.1:8787/api/geo/layers/triage
```

Map sync: Triage ranks trips/facilities/corridors → `buildMapLayersFromTriage` projects pins + zone + corridor conflicts → UI badge shows "triage sync".

### Day 10 quick test

```bash
npm start
# Run Monitor → Triage → Action in UI, or:
curl -X POST http://127.0.0.1:8787/api/agents/action/pack
curl http://127.0.0.1:8787/api/hitl/status
curl -X POST http://127.0.0.1:8787/api/hitl/approve -H "Content-Type: application/json" -d "{\"role\":\"nemt_supervisor\",\"approver\":\"NEMT Supervisor (demo)\"}"
curl -X POST http://127.0.0.1:8787/api/hitl/approve -H "Content-Type: application/json" -d "{\"role\":\"hospital_liaison\",\"approver\":\"Hospital Liaison (demo)\"}"
# Open http://127.0.0.1:8787 — Review/Approve buttons in Dual HITL gate; audit strip logs both approvers
```

HITL flow: Action pack stages COMMS-03 → each role Review (edit bulletin) + Approve → dual release logged in audit.

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
