# Logbook Entry #3 — Week 3

**Paste-ready for Future Caribbean Buildathon organizers / mentor check-in.**

---

**Week 3 — Climate & Crisis Ops Command**

**Track:** Climate Risk & Disaster Coordination

**Sprint goal (Week 3):** Judge-ready demo and rubric-aligned narrative — eval logged, efficiency measured, 5-min rehearsal, defensibility + staging deploy.

**Week 3 delivered (Days 15–20):**

- **Eval harness** (Day 15) — 8 scripted storm scenarios (L1–L4) with pass/fail assertions on triage ranks, corridor status, COMMS-03, triple HITL, map sync, and pipeline audit — `POST /api/eval/run`
- **Efficiency narrative** (Day 16) — per-agent latency + LLM token logging; pitch-ready narrative — `GET /api/efficiency/summary` · `docs/efficiency-narrative.md`
- **5-min demo rehearsal** (Day 17) — beat sheet with live eval + efficiency stats injection — `GET /api/demo/rehearsal` · `docs/demo-5min-rehearsal.md`
- **Defensibility + Phase 2 roadmap** (Day 18) — Broward County IT founder credibility, five defensibility pillars, CAD/EMS integration tracks — `GET /api/defensibility/narrative`
- **Staging deploy + backup video** (Day 19) — Dockerfile, deploy checklist API, staging guide, offline MP4 capture checklist — `GET /api/deploy/checklist`
- **Logbook #3 + mentor questions** (Day 20) — paste-ready Week 3 summary and prioritized mentor ask list — `GET /api/logbook/week3`

**Week 3 exit criteria met:** Repeatable 5-min demo · eval harness (8 scenarios) · efficiency metrics exportable · Broward defensibility narrative · Docker staging + backup video checklist · pitch deck outline (8 slides in `SPRINT.docx`).

**Demo checkpoint:** Tropical Storm Alma (DEMO) · Nassau Metro NEMT + PMH + Doctor's Hospital · 8/8 eval scenarios · demo mode 0 tokens · triple HITL + audit trail · staging deploy checklist green.

**Efficiency note:** Demo eval runs in <1 s with zero tokens; LLM mode logs exact prompt/completion/total per agent when `DEMO_MODE=false`. Staging recommended with `DEMO_MODE=true` for reliable public URL.

**Ask mentors (high priority):**

- Demo day: live staging URL vs. backup MP4 if Wi‑Fi fails — preferred submission format?
- Agentic AI rubric: emphasize tool-first agents + eval + HITL over model choice?
- 8-slide pitch deck review before Day 21?

**Full mentor questions list:** `docs/mentor-questions.md` · `GET /api/logbook/mentor-questions`

**Next (Day 21):** Demo day — live run + Q&A prep.

---

**Artifacts**

| File | Shows |
|---|---|
| `docs/demo-5min-rehearsal.md` | 5-min beat sheet + proof segment |
| `docs/efficiency-narrative.md` | Efficiency rubric talk track |
| `docs/defensibility-slide.md` | Broward + defensibility pitch |
| `docs/staging-deploy.md` | Public URL deploy guide |
| `docs/backup-demo-video.md` | Offline MP4 fallback |
| `docs/mentor-questions.md` | Prioritized mentor ask list |
| Command surface | http://127.0.0.1:8787 |
