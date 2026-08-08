# Defensibility + Broward Credibility — Day 18

**Paste-ready for pitch deck slide 7–8 (Future Caribbean · Defensibility rubric).**

---

## Slide: Founder credibility (Broward County IT)

**Headline:** Built this class of problem before — county-scale multi-agency weather coordination

**Body (3 bullets):**
- Part of **Broward County IT** team that built **GIS tooling** for **fire, police, and hospital EMS** after major weather events
- Same coordination pattern as CCOC: **shared map + corridor status + operator workflows** — not 911 call intake
- **Caribbean-rooted** demo (Nassau Metro NEMT + PMH + Doctor's Hospital) on **KnightRoad Veritas** command architecture

**Scope guard (say aloud):**
> "We are **not** claiming 911 or county CAD replacement in 21 days. This sprint proves **one coordination vertical** — NEMT and hospital liaisons on a shared command surface."

---

## Slide: Defensibility — why this is hard to copy

**Headline:** Workflow + operator corpus + audit — not a chatbot skin

| Pillar | Sprint proof |
|--------|----------------|
| **Workflow moat** | Monitor → Triage → Action + **triple HITL**; deterministic ranks/map; COMMS-03 staged before send |
| **SOP corpus** | 3-file keyword RAG; agents **cite sopId/section** in audit trail |
| **Audit-first** | Pipeline steps, citations, approver timestamps — inspectable JSON |
| **Eval harness** | **8/8** scripted scenarios L1–L4; demo mode **0 tokens**, <1 s suite |
| **Platform lineage** | Veritas command layer; extends to Phase 2 adapters |

**One-liner:**
> "Competitors can copy prompts. They can't copy **multi-agency approval workflow + cited SOP ops + eval-gated pipeline** without rebuilding operator trust."

---

## Talk track (30 s — mentor check-in)

"I helped build multi-agency GIS coordination at Broward County IT after weather events — fire, police, hospital EMS on shared situational layers. Climate & Crisis Ops Command applies that pattern to Caribbean NEMT and hospital partners: agents orchestrate, humans approve, audit captures everything. Defensibility is the **workflow and SOP moat**, not the LLM. Phase 2 adds CAD read-only and EMS-adjacent feeds when we have a pilot operator."

---

## API quick test

```bash
curl.exe http://127.0.0.1:8787/api/defensibility/summary
curl.exe http://127.0.0.1:8787/api/defensibility/narrative
npm run defensibility:summary
```
