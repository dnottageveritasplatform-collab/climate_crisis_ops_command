# 5-Minute Demo Rehearsal — Phase 2 Day 17

**Purpose:** Mentor pitch + live demo rehearsal. Phase 2 sprint capstone — uses eval harness and efficiency numbers across Days 1–17.

**Shorter capture:** `docs/demo-2min-capture.md` (judge video cut-down)

---

## Before rehearsal

1. `npm start` — http://127.0.0.1:8787
2. **Live demo:** `DEMO_MODE=false` + Groq (fast) or MiniMax `M2.7-highspeed` / `M3` (richer prose)
3. Refresh page; clear HITL if needed
4. Prefetch proof numbers:
   ```bash
   npm run eval:run
   curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
   npm run demo:rehearsal
   curl.exe http://127.0.0.1:8787/api/demo/rehearsal
   ```
5. Toggle **Demo rehearsal** strip in UI for live eval + beat count

---

## Beat sheet (~5:00)

| Time | Section | Do | Say |
|------|---------|-----|-----|
| **0:00–0:45** | Hook | Slide or intro | "After a tropical system, NEMT and hospital partners still coordinate on separate channels. Climate & Crisis Ops Command is one surface: signals in, agents orchestrate, humans approve before anything sends." |
| **0:45–1:00** | Scope | Show UI top bar + scenario strip | "Seventeen days, four integration tracks — not 911 CAD. Post-storm multi-agency coordination. Demo data, real workflow." |
| **1:00–2:00** | Run Pipeline | Click **Run Pipeline** | "Level 2 Prepare. Monitor, Triage, Action — CAD cross-ref, ESRI corridors, flood + wind GIS, hazard fusion, road-network avoidance, sovereign checks. LLM enriches narrative; ranks and map stay deterministic." |
| **2:00–2:30** | Map + fusion | Pan map; toggle **Hazard fusion** | "Flood and wind overlays, CORR-02 restricted, hospital pins, P1 trips ranked. Hazard fusion merges per-trip flood + wind + turn-by-turn avoidance." |
| **2:30–3:00** | Action | Triage tab → Action tab | "Checklist, COMMS-03 bulletins per partner, driver SMS with fusion headline — all draft, nothing auto-sends." |
| **3:00–3:30** | Extended HITL | Review + Approve all five roles at L2+ | "Maria Clarke, James Rolle, Dr. Elaine Moss, Keisha Bain, Marcus Edgecombe — each agency signs off on COMMS-03." |
| **3:30–4:00** | Audit | Scroll audit trail | "Pipeline steps through hazard fusion and road network, SOP citations, approver timestamps — persisted JSONL, audit-first." |
| **4:00–4:30** | Proof | Demo rehearsal strip or terminal | **Use live numbers** — see below |
| **4:30–5:00** | Close | Released banner or metrics | "Phase 2 complete: same command surface, new adapters. Tool-first agents, measured efficiency, operator SOP corpus. LLM is replaceable enrichment. Day 18: defensibility pitch." |

---

## Proof segment talk track (fill from API)

Run once before rehearsal:

```bash
npm run eval:run
npm run efficiency:pipeline
npm run demo:rehearsal
```

**Template (replace with your numbers):**

> "Eight scripted storm scenarios — Levels 1 through 4 — pass in under one second in demo mode, zero tokens. Last live pipeline: **{totalLatencyMs} ms**, **{totalTokens} tokens**, modes **{monitor}/{triage}/{action}**. Seventeen Phase 2 days: CAD read-only, transport desk, EOC feeds, hazard fusion, sovereign deploy. Demo mode for repeatability; Groq or MiniMax for live narrative — ranks, map, and HITL stay rule-based."

---

## Rehearsal checklist

- [ ] Scenario strip + Level 2 alert visible
- [ ] Pipeline completes (note token/latency line on timeline)
- [ ] Map: flood/wind zones + CORR-02 + #rank pins + triage sync
- [ ] Hazard fusion: fused trips with turn-by-turn nested
- [ ] Action: COMMS-03 bulletins + checklist + driver SMS fusion headline
- [ ] All five extended HITL roles **Approved** (L2+)
- [ ] Audit trail: `pipeline_run` + Phase 2 sync steps + approvers
- [ ] Demo rehearsal strip: eval pass + beat count
- [ ] Proof numbers memorized or on second monitor
- [ ] 2-min cut rehearsed (`demo-2min-capture.md`) for submission deadline

---

## API

```bash
curl.exe http://127.0.0.1:8787/api/demo/rehearsal
curl.exe http://127.0.0.1:8787/api/demo/rehearsal?format=text
npm run demo:preflight
```

---

## Rubric mapping (30 s close)

| Rubric | One line |
|--------|----------|
| **Agentic AI** | Monitor → Triage → Action orchestration; tools before LLM; extended HITL gate |
| **Efficiency** | Eval 8/8 · 0 tokens demo · logged ms/tokens per agent |
| **Defensibility** | 5-file SOP RAG + persisted audit + deterministic ranks — not a generic chatbot |
| **Phase 2** | Same command surface — CAD, transport desk, EOC, hazard fusion, sovereign deploy |
