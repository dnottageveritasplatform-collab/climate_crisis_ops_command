# 2-Minute Screen Capture Script — Day 14

**Purpose:** Judge-ready walkthrough of the multi-agency coordination workflow. Record at 1920×1080; keep under 2:00.

**Backup still:** `docs/mockups/command-center-llm-mode.jpg` (if live capture fails)

---

## Before recording

1. `npm start` — server on http://127.0.0.1:8787
2. Optional LLM: `.env` with `DEMO_MODE=false` + `LLM_*` (Groq). Demo mode is fine for capture.
3. Hide browser bookmarks bar; zoom 100%
4. Tool: OBS, Xbox Game Bar (Win+G), or Loom
5. Clear prior HITL state: refresh page or restart server

---

## Beat sheet (~2:00)

| Time | Action | Talk track |
|------|--------|------------|
| **0:00–0:15** | Show top bar + scenario strip + alert banner | "Climate & Crisis Ops Command — post-storm coordination for Caribbean NEMT and hospital partners. Three agencies on one surface: Nassau Metro, Princess Margaret, Doctor's Hospital. Demo data — not 911 CAD." |
| **0:15–0:35** | Click **Run Pipeline** (gold). Wait for completion | "Storm signal escalates to Level 2 Prepare. Pipeline runs Monitor, Triage, and Action — agents cite operator SOPs and rank at-risk dialysis trips." |
| **0:35–0:55** | Pan map — pins, CORR-02 restricted, triage-sync badge | "Thin GIS layer: facility pins, at-risk trips, corridor status synced to triage output." |
| **0:55–1:15** | Ops Output → Triage tab, then Action tab | "Triage ranks P1 trips across both hospital partners. Action drafts COMMS-03 bulletins and a dispatch checklist — nothing auto-sends." |
| **1:15–1:40** | Triple HITL: Review + Approve for NEMT, PMH, Doctor's | "Triple human-in-the-loop: dispatch supervisor and both hospital liaisons each review and approve. Named personas match our multi-agency SOP." |
| **1:40–1:55** | Scroll Audit Trail panel | "Audit log captures pipeline steps, SOP citations, and approver timestamps — audit-first by design." |
| **1:55–2:00** | Hold on released banner | "Veritas-powered crisis ops for operators and hospital-adjacent partners after weather events." |

---

## Capture checklist

- [ ] Scenario strip visible ("Multi-agency scenario")
- [ ] Alert shows Level 2 + institutional signals
- [ ] Pipeline completes without error
- [ ] Map shows CORR-02 + hospital pins + at-risk trips
- [ ] All three HITL roles show **Approved**
- [ ] Audit trail lists pipeline + HITL entries
- [ ] Export MP4 ≤ 50 MB (H.264, 1080p)

---

## CLI verification (optional, before capture)

```bash
npm start
curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
curl.exe http://127.0.0.1:8787/api/scenario
curl.exe http://127.0.0.1:8787/api/audit/trail
```

Save recording as: `docs/demo-2min-capture.mp4` (gitignore if large; attach to logbook submission separately).
