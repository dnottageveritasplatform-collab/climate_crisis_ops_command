# Phase 2 Roadmap — CAD / EMS Integration

**Day 18 deliverable · Post-sprint · paste-ready for pitch slide 8 (Ask / roadmap).**

---

## Headline

**Same command surface — new adapters.** Phase 2 connects read-only CAD/EMS and public-safety feeds without turning CCOC into 911 dispatch.

---

## Principles

1. **Read-only situational feeds first** — visibility before write-back
2. **Tools API behind agents** — Monitor/Triage/Action stay; adapters plug in
3. **HITL mandatory** for outbound COMMS-03 and driver messaging
4. **Pilot-driven** — one design-partner NEMT + hospital before multi-county CAD

---

## Integration tracks

### 1. CAD / dispatch read-only overlay
- Ingest **county CAD** or **NEMT dispatch system** exports (CSV, REST, webhook) as trip/unit layers
- Cross-reference CCOC at-risk trips with **CAD incident / run IDs** in audit log
- Replace static corridor GeoJSON with **ESRI feature service** when agency provides layers

### 2. EMS-adjacent transport desk
- Hospital transport liaison signals: **bed pressure**, diversion, elective hold
- **EMS-to-NEMT handoff queue** (scheduled inter-facility — not 911 response)
- New HITL personas: **shelter coordinator**, **fleet logistics** (Phase 2)

### 3. Fire / police situational awareness (read-only)
- EOC and public-safety **unit status** on shared map — no dispatch authority in CCOC
- Live **NHC + institutional feeds** (sprint started with optional `NHC_FEED_URL`)
- **Common operating picture** PDF/JSON export for EOC briefings

### 4. Deeper GIS routing
- Corridor-aware routing when pilot provides **road network** or flood overlays
- **On-prem / sovereign** deploy (OWC edge angle for Caribbean operators)
- Optional **vector RAG** over expanded SOP corpus — only if operator corpus grows

---

## Explicitly not Phase 2 day-one

- 911 PSAP call-taking or municipal **CAD replacement**
- Auto-send COMMS/SMS without **triple HITL** approval
- Full **ESRI Enterprise** or live county CAD write-back in sprint window

---

## Sprint → Phase 2 mapping

| Sprint (Day 1–17) | Phase 2 extension |
|-------------------|-------------------|
| Synthetic dispatch CSV | Live dispatch / CAD adapter |
| Static GeoJSON corridors | Agency GIS / ESRI layers |
| Demo NHC overlay | Multi-feed signal ingest |
| Triple HITL (3 roles) | Shelter + fleet + EOC personas |
| Keyword SOP RAG (3 files) | Operator corpus + optional embeddings |
| In-memory audit | Persistent audit + export to EOC |

---

## API

```bash
curl.exe http://127.0.0.1:8787/api/defensibility/phase2
```
