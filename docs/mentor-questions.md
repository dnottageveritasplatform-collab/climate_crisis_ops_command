# Mentor Questions — Day 20

**Prioritized ask list for Future Caribbean Buildathon mentor check-in ahead of demo day (Day 21).**

**API:** `GET /api/logbook/mentor-questions` · `GET /api/logbook/mentor-questions?priority=high` · `?format=text` for terminal paste

**CLI:** `npm run mentor:questions` · `npm run logbook:week3`

---

## Demo day

**[HIGH]** For demo day, should I lead with live staging URL (`DEMO_MODE=true`) or pre-recorded MP4 if Wi‑Fi is uncertain — and is there a preferred submission format?

- Context: Docker staging ready; backup capture script in `docs/backup-demo-video.md`
- Rubric: Agentic AI · PMF

---

## Judge Q&A

**[HIGH]** How do judges typically weigh deterministic tool-first agents vs. LLM-heavy demos in the Agentic AI rubric — should I emphasize eval harness + HITL over model choice?

- Context: 8/8 eval scenarios; demo mode 0 tokens; Groq optional for live prose
- Rubric: Agentic AI (50%)

---

## Pitch

**[HIGH]** Can a mentor review my 8-slide deck outline (problem → Broward proof → demo → architecture → defensibility → Phase 2 → ask) before Day 21?

- Context: `SPRINT.docx` pitch outline + `docs/defensibility-slide.md`
- Rubric: PMF · Defensibility

---

## Go-to-market

**[MEDIUM]** Are there Caribbean NEMT operators, hospital transport desks, or EOC contacts in the mentor network open to a post-sprint pilot conversation?

- Context: Demo vertical: Nassau Metro NEMT + PMH + Doctor's Hospital (synthetic data)
- Rubric: PMF

---

## Technical — sovereign deploy

**[MEDIUM]** For Caribbean operators needing data residency, what's the lightest credible sovereign/on-prem path after Docker staging — Nebius VM vs. edge appliance narrative for OWC angle?

- Context: Phase 2 routing-gis track mentions on-prem sovereign deploy
- Rubric: Defensibility

---

## Technical — Phase 2 CAD

**[MEDIUM]** How much Phase 2 CAD read-only integration detail is useful in a 5-min demo vs. over-scoping — judges skeptical of 911 replacement claims?

- Context: Explicit scope guard: not 911/CAD in 21 days; `docs/phase2-roadmap.md`
- Rubric: Defensibility · PMF

---

## Team

**[MEDIUM]** As a solo founder, what's the best way to address the Team rubric — advisory board naming, open AI/ML engineer role, or partner org letter?

- Context: Sprint built solo on Veritas architecture
- Rubric: Team

---

## Technical — compute credits

**[LOW]** Nebius business email still pending — should demo day stay on `DEMO_MODE=true` + Groq free tier, or is there a mentor path to H200 / container credits this week?

- Context: Efficiency narrative separates demo (0 tokens) from logged LLM runs
- Rubric: Efficiency

---

## Product — HITL scope

**[LOW]** Triple HITL (NEMT + two hospital liaisons) reads well for multi-agency story — does it risk demo friction vs. dual approver for a 5-min window?

- Context: Week 2 expanded to PMH + Doctor's Hospital personas
- Rubric: Agentic AI · PMF

---

## Technical — eval LLM path

**[LOW]** Should eval harness add an optional LLM assertion path for regression when keys are available, or keep CI-style demo-only checks for reproducibility?

- Context: `POST /api/eval/run` defaults `skipLlm: true`
- Rubric: Efficiency · Agentic AI

---

## Quick paste (high priority only)

1. Demo day: live URL vs. backup MP4 — preferred format?
2. Agentic AI rubric: tool-first + eval + HITL vs. model showcase?
3. 8-slide deck review before Day 21?
