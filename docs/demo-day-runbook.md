# Demo Day Runbook — Day 21

**Purpose:** Live run checklist for Future Caribbean demo day. Sprint finale — 21-day deliverable complete.

**API:** `GET /api/demo/runbook` · `POST /api/demo/preflight` · `npm run demo:preflight`

---

## Pre-flight (15 min before)

```bash
npm run demo:preflight
npm run demo:rehearsal
curl.exe http://127.0.0.1:8787/api/demo/runbook
curl.exe -X POST http://127.0.0.1:8787/api/demo/preflight
```

- [ ] Preflight green: **8/8 eval** · deploy checklist · pipeline smoke
- [ ] `DEMO_MODE=true` for live pitch (recommended)
- [ ] **HighRise:** optional one-liner in proof/close — sprint verified H200 inference; demo mode today (`docs/highrise-compute.md`)
- [ ] Refresh UI — HITL cleared, Level 2 alert + scenario strip visible
- [ ] Backup MP4 ready per `docs/backup-demo-video.md` (if Wi‑Fi uncertain)
- [ ] Q&A sheet open: `docs/demo-day-qa.md` or second monitor with `npm run demo:qa`

---

## Live run (~5 min)

Follow `docs/demo-5min-rehearsal.md` beat sheet:

| Phase | Time | Must show |
|-------|------|-----------|
| Hook + scope | 0:00–1:00 | Not 911/CAD · multi-agency coordination |
| **Run Pipeline** | 1:00–2:00 | Monitor → Triage → Action completes |
| Map + Action | 2:00–3:00 | CORR-02 · #rank pins · COMMS-03 drafts |
| Triple HITL | 3:00–3:30 | All three roles **Approved** |
| Audit + proof | 3:30–4:30 | Trail + eval/token numbers |
| Close | 4:30–5:00 | Tool-first · efficiency · Broward · Phase 2 · **HighRise (one line)** |

**HighRise mention (~10 s, optional — say during proof or close):**

> "We integrated Future Caribbean partner **HighRise H200 inference** during the sprint — full pipeline, tokens logged. Live demo today is demo mode for reliability; HighRise env is wired and documented, commented until credits renew."

**Proof line (fill from preflight):**

> "8/8 scripted storm scenarios pass in demo mode, zero tokens. Pipeline completes with triple HITL staged — ranks and map stay deterministic; LLM is optional prose."

---

## Fallback order

1. **Live staging URL** — `DEMO_MODE=true` · `docs/staging-deploy.md`
2. **Local** — `npm start` · http://127.0.0.1:8787
3. **Backup MP4** — `docs/demo-2min-capture.md`
4. **Static mockup** — `docs/mockups/command-center-llm-mode.jpg`

---

## After demo

- [ ] Q&A using `docs/demo-day-qa.md`
- [ ] Submit logbook + demo link per organizer instructions
- [ ] Note mentor follow-ups from `docs/mentor-questions.md`

---

## Sprint exit criteria ✅

- Repeatable 5-min demo
- Eval harness logged (8 scenarios)
- Efficiency metrics exportable
- Defensibility + Broward narrative
- Docker staging + backup video checklist
- Pitch deck outline (8 slides in `SPRINT.docx`)
