# Defensibility + Broward Credibility — Phase 2 Day 18

**Paste-ready for pitch deck slides 7–8 (Future Caribbean · Defensibility rubric · Ask / roadmap).**

---

## Slide 7: Founder credibility (Broward County IT)

**Headline:** Built this class of problem before — county-scale multi-agency weather coordination

**Body (3 bullets):**
- Part of **Broward County IT** team that built **GIS tooling** for **fire, police, and hospital EMS** after major weather events
- Same coordination pattern as CCOC: **shared map + corridor status + operator workflows** — not 911 call intake
- **Caribbean-rooted** demo (Nassau Metro NEMT + PMH + Doctor's Hospital + Shelter + Fleet) on **KnightRoad Veritas** command architecture

**Scope guard (say aloud):**
> "We are **not** claiming 911 or county CAD replacement in 21 days. Phase 2 delivered **17 days of read-only adapters** on one coordination vertical — NEMT and hospital liaisons on a shared command surface."

---

## Slide 8: Defensibility — why this is hard to copy

**Headline:** Workflow + operator corpus + audit — not a chatbot skin

| Pillar | Phase 2 proof |
|--------|----------------|
| **Workflow moat** | Monitor → Triage → Action + **extended HITL (5 roles)**; hazard fusion; COMMS-03 staged before send |
| **SOP corpus** | **5-file hybrid RAG** (keyword + TF-IDF); agents **cite sopId/section** in audit trail |
| **Audit-first** | **Persisted JSONL** audit; Phase 2 pipeline sync steps; approver timestamps — inspectable + EOC export |
| **Eval harness** | **8/8** scripted scenarios L1–L4; demo mode **0 tokens**, suite under 1 s |
| **Platform lineage** | Broward County IT weather GIS + Veritas command layer; **17 Phase 2 days delivered** |

**One-liner:**
> "Competitors can copy prompts. They can't copy **multi-agency approval workflow + cited SOP ops + eval-gated pipeline** without rebuilding operator trust."

---

## Slide 8b: Phase 2 delivered (optional appendix)

**Headline:** Same command surface — new adapters (Days 1–17)

| Track | Delivered |
|-------|-----------|
| CAD read-only | CSV overlay, live enrichment, ESRI corridors |
| EMS-adjacent | Transport desk, handoff write-back, extended HITL |
| EOC feeds | Fire/police overlay, multi-feed signals, COP export |
| Deeper GIS | Flood + wind overlays, hazard fusion, turn-by-turn avoidance, sovereign deploy |

**Not in scope:** 911 PSAP · auto-send COMMS · full ESRI Enterprise

---

## Talk track (30 s — mentor / judge close)

"I helped build multi-agency GIS coordination at Broward County IT after weather events — fire, police, hospital EMS on shared situational layers. CCOC applies that pattern to Caribbean NEMT and hospital partners: agents orchestrate, humans approve, audit captures everything. Phase 2 added CAD read-only, transport desk, EOC feeds, hazard fusion, and sovereign deploy across 17 days. Defensibility is the **workflow and SOP moat**, not the LLM."

---

## API quick test

```bash
npm run eval:run
npm run defensibility:summary
npm run defensibility:pitch
curl.exe http://127.0.0.1:8787/api/defensibility/summary
curl.exe http://127.0.0.1:8787/api/defensibility/narrative
curl.exe http://127.0.0.1:8787/api/defensibility/phase2
curl.exe http://127.0.0.1:8787/api/defensibility/pitch
curl.exe "http://127.0.0.1:8787/api/defensibility/pitch?format=text"
```
