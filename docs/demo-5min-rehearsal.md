# 5-Minute Demo Rehearsal — Day 17

**Purpose:** Mentor pitch + live demo rehearsal. Uses eval harness and efficiency numbers from Days 15–16.

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

---

## Beat sheet (~5:00)

| Time | Section | Do | Say |
|------|---------|-----|-----|
| **0:00–0:45** | Hook | Slide or intro | "After a tropical system, NEMT and hospital partners still coordinate on separate channels. Climate & Crisis Ops Command is one surface: signals in, agents orchestrate, humans approve before anything sends." |
| **0:45–1:00** | Scope | Show UI top bar + scenario strip | "Not 911 CAD in 21 days — post-storm multi-agency coordination. Demo data, real workflow." |
| **1:00–2:00** | Run Pipeline | Click **Run Pipeline** | "Level 2 Prepare. Monitor, Triage, Action — tools first, SOP RAG, LLM enriches narrative; ranks and map stay deterministic." |
| **2:00–2:30** | Map | Pan map, triage-sync badge | "CORR-02 restricted, hospital pins, P1 trips ranked on the map — triage drives sync." |
| **2:30–3:00** | Action | Triage tab → Action tab | "Checklist, COMMS-03 bulletins per partner, driver SMS — all draft, nothing auto-sends." |
| **3:00–3:30** | Triple HITL | Review + Approve all three roles | "Maria Clarke, James Rolle, Dr. Elaine Moss — each agency signs off on COMMS-03." |
| **3:30–4:00** | Audit | Scroll audit trail | "Pipeline steps, SOP citations, approver timestamps — audit-first." |
| **4:00–4:30** | Proof | Terminal or UI token line | **Use live numbers** — see below |
| **4:30–5:00** | Close | Released banner or metrics | "Tool-first agents, measured efficiency, small SOP corpus. LLM is replaceable enrichment." |

---

## Proof segment talk track (fill from API)

Run once before rehearsal:

```bash
npm run eval:run
npm run efficiency:pipeline
npm run demo:rehearsal
```

**Template (replace with your numbers):**

> "Eight scripted storm scenarios — Levels 1 through 4 — pass in under one second in demo mode, zero tokens. Last live pipeline: **{totalLatencyMs} ms**, **{totalTokens} tokens**, modes **{monitor}/{triage}/{action}**. Demo mode for repeatability; Groq or MiniMax for live narrative — ranks, map, and HITL stay rule-based."

**Example (Groq, from Day 16 capture):**

> "8/8 scenarios pass · ~250 ms eval suite · last pipeline 3,454 ms · 7,554 tokens · groq/groq/groq."

---

## Rehearsal checklist

- [ ] Scenario strip + Level 2 alert visible
- [ ] Pipeline completes (note token/latency line on timeline)
- [ ] Map: CORR-02 + #rank pins + triage sync
- [ ] Action: COMMS-03 bulletins + checklist
- [ ] All three HITL roles **Approved**
- [ ] Audit trail: `pipeline_run` + approvers
- [ ] Proof numbers memorized or on second monitor
- [ ] 2-min cut rehearsed (`demo-2min-capture.md`) for submission deadline

---

## API

```bash
curl.exe http://127.0.0.1:8787/api/demo/rehearsal
curl.exe http://127.0.0.1:8787/api/demo/rehearsal?format=text
```

---

## Rubric mapping (30 s close)

| Rubric | One line |
|--------|----------|
| **Agentic AI** | Monitor → Triage → Action orchestration; tools before LLM; triple HITL gate |
| **Efficiency** | Eval 8/8 · 0 tokens demo · logged ms/tokens per agent |
| **Defensibility** | 3-file SOP RAG + audit trail + deterministic ranks — not a generic chatbot |
