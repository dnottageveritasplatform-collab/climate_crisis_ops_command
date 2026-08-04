# Logbook Entry #1 — Week 1

**Paste-ready for Future Caribbean Buildathon organizers / mentor check-in.**

---

**Week 1 — Climate & Crisis Ops Command**

**Track:** Climate Risk & Disaster Coordination (pivot from Open Track).

**Sprint goal:** Post-storm multi-agency coordination — signals → multi-agent orchestration → dual HITL approvals → outputs on a thin map view. Demo vertical: NEMT + hospital transport liaison (not 911/CAD replacement).

**Founder context:** Broward County IT GIS experience coordinating fire, police, and hospital ambulances after major weather events.

**Week 1 delivered (Days 1–7):**

- Repo, env, track switch note, architecture doc scaffold
- OpenClaw-compatible Monitor agent (tool loop + structured logging)
- Signal ingest: weather + institutional demo feed (`/api/signals`)
- Command UI shell: alert banner, agent timeline, Monitor brief panel, dual HITL gate, live map
- Monitor agent: threshold-driven SOP RAG brief with structured citations
- Sample NEMT dispatch (8 trips), geo layers (facilities, corridors, at-risk pins), 3-file SOP corpus
- **Week 1 exit criteria met:** signal in → Monitor brief on map → audit log entry (`POST /api/demo/week1`)

**Demo checkpoint:** Level 2 Prepare · Nassau metro · 3 at-risk P1 trips · CORR-02 restricted · cited SOP refs from operator corpus.

**Ask mentors:**

- Dual-approver HITL patterns (NEMT supervisor + hospital liaison) for Week 2
- Lightweight map layer credibility vs. full GIS/CAD scope guardrails
- Nebius / compute credits timing for Triage + Action agents (Day 8+)

**Next (Week 2):** Triage agent, Action agent, dual HITL UI, orchestrator wiring, full audit trail with approver timestamps.

---

Architecture diagram: `docs/architecture-diagram.html`  
Command surface: http://127.0.0.1:8787
