# Logbook Entry — Day 17

**Paste-ready for Future Caribbean Buildathon organizers / mentor check-in.**

---

**Date:** Thursday, 6 Aug 2026  
**Project:** Climate & Crisis Ops Command  
**Track:** Climate Risk & Disaster Coordination (Future Caribbean Buildathon 2026)  
**Hours:** ~2

### Goal for the day
**5-minute demo script rehearsal** — tighten talk track using eval + efficiency numbers. Week 3 · Day 17 deliverable.

### Completed

**Rehearsal module (`src/demo/rehearsal.js`)**
- Structured **5-minute beat sheet** (hook → live demo → proof → close)
- **`buildRehearsalScript()`** injects live stats from eval harness + efficiency summary
- **`formatRehearsalScriptText()`** for terminal rehearsal printout
- Proof-segment talk track auto-fills eval pass count, suite latency, last pipeline ms/tokens/modes

**API**
- `GET /api/demo/rehearsal` — JSON beat sheet + stats
- `GET /api/demo/rehearsal?format=text` — printable script

**CLI:** `npm run demo:rehearsal`

**Docs**
- `docs/demo-5min-rehearsal.md` — full beat sheet, proof template, checklist, rubric close
- Links to Day 14 `docs/demo-2min-capture.md` for submission cut-down

**Phase:** server + orchestrator + UI pill → **Week 3 · Day 17** · module chip `demo: rehearsal_ready`

### Verified
```bash
npm run eval:run
npm run demo:rehearsal
curl.exe http://127.0.0.1:8787/api/demo/rehearsal
curl.exe "http://127.0.0.1:8787/api/demo/rehearsal?format=text"
```

### Rehearsal notes
- **Live demo:** Groq for speed during development and mentor dry-runs; MiniMax M2.7-highspeed / M3 for capture when prose matters
- **Proof beat:** cite 8/8 eval + last pipeline token line from UI after Run Pipeline
- **2-min cut:** rehearse `demo-2min-capture.md` separately for judge video

### Tomorrow (Day 19)
Staging deploy + backup offline demo video (Nebius or PaaS; see mentor guidance).

### Rubric note
**Agentic AI:** 5-min script walks full Monitor → Triage → Action → triple HITL chain on one surface. **Efficiency:** proof segment cites eval suite (0 tokens) + logged pipeline metrics. **Defensibility:** audit trail + SOP citations called out explicitly in beats 3:30–4:30.

### Attachments
| File | Shows |
|---|---|
| `docs/demo-5min-rehearsal.md` | Beat sheet + checklist |
| `GET /api/demo/rehearsal` | Live stats injection |

**Deliverables:** `src/demo/rehearsal.js` · `docs/demo-5min-rehearsal.md` · `GET /api/demo/rehearsal`
