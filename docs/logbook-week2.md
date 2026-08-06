# Logbook Entry #2 — Week 2

**Paste-ready for Future Caribbean Buildathon organizers / mentor check-in.**

---

**Week 2 — Climate & Crisis Ops Command**

**Track:** Climate Risk & Disaster Coordination

**Sprint goal (unchanged):** Post-storm multi-agency coordination — signals → Monitor / Triage / Action orchestration → triple HITL approvals → outputs on a thin map view. Demo vertical: Nassau Metro NEMT + Princess Margaret (public) + Doctor's Hospital (private). Not 911/CAD replacement.

**Week 2 delivered (Days 8–14):**

- **Triage agent** — ranked trips, hospital partners, corridor conflicts; map sync (`GET /api/geo/layers/triage`)
- **Action agent** — dispatch checklist, per-partner COMMS-03 bulletins, driver SMS drafts
- **Triple HITL** — NEMT supervisor (Maria Clarke) + PMH liaison (James Rolle) + Doctor's liaison (Dr. Elaine Moss); review/approve with editable bulletin
- **Orchestrator pipeline** — `POST /api/orchestrator/run` chains signals → Monitor → Triage → Action → HITL staged
- **Full audit trail** — steps, SOP citations, approver names + timestamps (`GET /api/audit/trail`)
- **Day 14 polish** — multi-agency scenario copy across UI, signal feed, agents, and HITL personas; `GET /api/scenario`; 2-min screen capture script

**Week 2 exit criteria met:** End-to-end workflow with triage-synced map view and triple-approved action pack (demo send blocked).

**Demo checkpoint:** Level 2 Prepare · Tropical Storm Alma (DEMO) · CORR-02 restricted · 3 at-risk P1 trips · pipeline `groq` or `demo` · triple HITL pending → approved · audit trail populated.

**LLM note:** Monitor, Triage, and Action agents support Groq when `DEMO_MODE=false`. Triage keeps deterministic ranks/map pins; Groq enriches summary and trip reasons. Action merges LLM narrative onto the demo pack skeleton.

**Ask mentors:**

- Eval harness design for Week 3 (5–10 scripted storm scenarios)
- Token/latency logging narrative for efficiency rubric
- Staging deploy options for demo day backup video

**Next (Week 3):** Eval harness, efficiency metrics, 5-min demo rehearsal, defensibility slide, staging deploy + backup capture.

---

**Artifacts**

- Command surface: http://127.0.0.1:8787
- LLM mode screenshot: `docs/mockups/command-center-llm-mode.jpg`
- 2-min capture script: `docs/demo-2min-capture.md`
- Architecture diagram: `docs/architecture-diagram.html`
