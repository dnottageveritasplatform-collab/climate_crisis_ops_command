# Demo Day Q&A Prep — Day 21

**Purpose:** Anticipated judge and mentor questions with short answers and proof points.

**API:** `GET /api/demo/qa` · `GET /api/demo/qa?category=Agentic%20AI` · `?format=text` · `npm run demo:qa`

**Scope guard:** Demo data only — not 911/CAD replacement.

---

## Scope

**Q: Is this a 911 or CAD replacement?**

A: No. Sprint scope is post-storm coordination for NEMT and hospital transport liaisons — shared map, COMMS-03 bulletins, triple HITL. We explicitly do not claim PSAP call-taking or county CAD in 21 days. Phase 2 adds CAD read-only overlays when a pilot agency is available.

- Proof: `docs/phase2-roadmap.md` · scope guard in UI scenario strip
- Rubric: Defensibility · PMF

---

## Agentic AI

**Q: How is this agentic vs. a chatbot with RAG?**

A: Three specialized agents orchestrated in sequence: Monitor (signals + SOP brief), Triage (deterministic rank + map sync), Action (checklist + COMMS-03). Tools run first; LLM enriches prose only. Triple HITL gates outbound comms. Eval harness proves 8 scripted scenarios L1–L4 pass with assertions — not one lucky demo.

- Proof: `POST /api/eval/run` · `GET /api/audit/trail`
- Rubric: Agentic AI (50%)

---

## Efficiency

**Q: Did you use HighRise / the buildathon H200 compute?**

A: Yes — we wired OpenAI-compatible inference to **HighRise** (portal base URL + API key + catalog model). During the sprint we ran the full Monitor → Triage → Action pipeline with token and latency logged per agent. Demo day uses **`DEMO_MODE=true`** so judges get deterministic eval and HITL without expired-key risk; the HighRise block lives in local `.env` (commented) and `docs/highrise-compute.md`.

- Proof: `docs/highrise-compute.md` · `GET /api/efficiency/summary` (from sprint rehearsal) · `.env.example` HighRise block
- Rubric: Efficiency · Defensibility (partner compute narrative)

**Q: What does it cost to run? How do you prove efficiency?**

A: Demo mode: zero tokens, full pipeline under ~1 s per eval scenario, 8-scenario suite under 2 s. LLM mode logs exact prompt/completion/total per agent — exportable via `GET /api/efficiency/summary`. Small 3-file SOP keyword RAG, no vector DB in sprint scope.

- Proof: `docs/efficiency-narrative.md` · UI pipeline token line
- Rubric: Efficiency

---

## Defensibility

**Q: What stops someone from copying the templates?**

A: Workflow moat: triple-approver HITL, deterministic triage/map rules, audit trail with SOP citations, and operator-specific corpus. Founder lineage from Broward County IT GIS multi-agency weather coordination — same problem class, productized for Caribbean operators.

- Proof: `GET /api/defensibility/narrative` · `docs/defensibility-slide.md`
- Rubric: Defensibility

---

## PMF

**Q: Who pays for this? What's the design partner story?**

A: Beachhead: NEMT operators coordinating with hospital transport desks after tropical systems — Nassau demo vertical maps to Caribbean operator + liaison pain. Revenue path: per-operator command seat + hospital partner liaison seats; pilot conversation post-sprint with mentor intros.

- Proof: `docs/logbook-week3.md` · multi-agency scenario API
- Rubric: PMF

---

## Team

**Q: You're solo — how do you scale?**

A: Sprint built on KnightRoad Veritas platform architecture (reusable agents, command UI, SOP RAG). Open AI/ML engineer role; advisory from county GIS experience. Phase 2 integrations are adapter work behind the same orchestrator — not rebuilding from scratch.

- Proof: knightroadveritas.app · `docs/architecture.docx`
- Rubric: Team

---

## Product

**Q: Triple HITL seems slow for a crisis — why three approvers?**

A: Models real multi-agency SOP: NEMT supervisor holds trips/driver comms; each hospital liaison owns their COMMS-03 bulletin. Nothing auto-sends — regulatory and partner-trust requirement. Demo compresses to ~30 s of clicks; production can parallelize review notifications.

- Proof: `docs/sops/` · HITL panel in UI
- Rubric: Agentic AI · PMF

---

## Technical — data sovereignty

**Q: Can this run on-prem for Caribbean data residency?**

A: Yes — Docker staging today; Phase 2 sovereign path for operators needing PHI/PII on-prem. Demo uses synthetic dispatch only. HITL and audit design carry to on-prem without architecture change.

- Proof: `Dockerfile` · `docs/staging-deploy.md` · Phase 2 routing-gis track
- Rubric: Defensibility

---

## Technical — LLM dependency

**Q: What if Groq/OpenAI is unavailable?**

A: Demo mode runs full workflow with zero LLM dependency — judges see identical ranks, map pins, checklist, and HITL gates. LLM is optional narrative enrichment on brief and COMMS-03 drafts; provider is swappable via env config.

- Proof: `DEMO_MODE=true` · `npm run eval:run`
- Rubric: Efficiency · Agentic AI

---

## Roadmap

**Q: What's next after the sprint?**

A: Phase 2: CAD read-only trip overlay, EMS-adjacent hospital desk feeds, fire/police situational read-only layers, deeper GIS when pilot agency available. Same command surface — new tool adapters behind Monitor/Triage/Action.

- Proof: `GET /api/defensibility/phase2` · `docs/phase2-roadmap.md`
- Rubric: PMF · Defensibility

---

## Quick rubric close (30 s)

> "Agentic AI: three orchestrated agents with tools-first execution and triple HITL — eval proves repeatability. Efficiency: measured tokens and latency, zero-token demo path. Defensibility: operator workflow + SOP citations + Broward County IT lineage — not a generic chat wrapper. PMF: NEMT + hospital liaison beachhead in the Caribbean. Team: Veritas platform + open engineer hire."
