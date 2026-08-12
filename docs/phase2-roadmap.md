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
- **NEMT CAD write-back** (pilot): handoff accept + run ID assignment via ingest webhook — see Day 3+ below
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
curl.exe http://127.0.0.1:8787/api/cad/summary
curl.exe http://127.0.0.1:8787/api/cad/cross-ref?level=2
curl.exe http://127.0.0.1:8787/api/transport-desk/summary
curl.exe http://127.0.0.1:8787/api/transport-desk/cross-ref?level=2
curl.exe http://127.0.0.1:8787/api/public-safety/summary
curl.exe http://127.0.0.1:8787/api/public-safety/cop-export?level=2
curl.exe http://127.0.0.1:8787/api/geo/corridors/esri?level=2
curl.exe http://127.0.0.1:8787/api/geo/corridors/source
curl.exe http://127.0.0.1:8787/api/signals/multi-feed?level=2
curl.exe http://127.0.0.1:8787/api/signals/cross-ref?level=2
curl.exe -X POST http://127.0.0.1:8787/api/transport-desk/handoff-accept -H "Content-Type: application/json" -d "{\"handoffs\":[{\"handoffId\":\"HO-2201\",\"status\":\"nemt_assigned\",\"nemtRunId\":\"RUN-8845\",\"linkedTripId\":\"T-1004\"}]}"
```

### Phase 2 Day 1 (CAD read-only overlay) ✅

- `src/cad/` — CSV adapter + webhook ingest stub
- `data/sample-cad-export.csv` — pilot CAD export linked to dispatch manifest
- Pipeline audit cross-references at-risk trips with CAD run/incident IDs
- Map overlay shows read-only unit status pins

### Phase 2 Day 2 (EMS-adjacent transport desk) ✅

- `src/transport-desk/` — hospital desk + handoff queue JSON adapters
- `data/sample-hospital-desk.json` · `data/sample-ems-handoff-queue.json`
- Monitor tool `get_transport_desk_status` · pipeline handoff audit cross-ref
- UI transport desk strip + hospital bed pressure on map

### Phase 2 Day 3 (Fire / police situational awareness) ✅

- `src/public-safety/` — EOC fire/police JSON adapter + webhook ingest stub
- `data/sample-public-safety-units.json` — corridor-assigned demo units
- Monitor tool `get_public_safety_status` · pipeline EOC corridor audit cross-ref
- UI EOC strip + fire (diamond) / police (shield) map pins · `GET /api/public-safety/cop-export`

### Phase 2 Day 4 (NEMT CAD write-back — pilot gated) ✅

- **`src/transport-desk/writeback.js`** — handoff accept merge by `handoffId`, CAD run ↔ trip validation
- **`POST /api/transport-desk/handoff-accept`** — pilot NEMT dispatch pushes accept + `nemtRunId`
- **`POST /api/transport-desk/ingest`** with `"patch": true` — same write-back via webhook shape
- Audit type **`handoff_writeback`** — state transitions logged separately from Triple HITL
- UI **Demo accept HO-2201** → `RUN-8845` · strip counts update live

**Scope guard (unchanged):**

- Write-back limited to **handoff accept / run assignment** — not trip dispatch authority, not 911 PSAP, not auto-send COMMS
- Triple HITL remains mandatory for outbound hospital bulletins and driver messaging
- Pilot validates one NEMT operator before multi-county or county CAD integration

**Pilot integration shape:**

```bash
# NEMT dispatch pushes handoff accept (example payload)
curl.exe -X POST http://127.0.0.1:8787/api/transport-desk/handoff-accept ^
  -H "Content-Type: application/json" ^
  -d "{\"handoffs\":[{\"handoffId\":\"HO-2201\",\"status\":\"nemt_assigned\",\"nemtRunId\":\"RUN-8845\",\"linkedTripId\":\"T-1004\"}]}"

# Or patch mode on ingest webhook
curl.exe -X POST http://127.0.0.1:8787/api/transport-desk/ingest ^
  -H "Content-Type: application/json" ^
  -d "{\"patch\":true,\"queue\":[{\"handoffId\":\"HO-2201\",\"status\":\"nemt_assigned\",\"nemtRunId\":\"RUN-8845\",\"linkedTripId\":\"T-1004\"}]}"
```

Future: optional ESRI corridor feature service replace static GeoJSON; shelter + fleet HITL personas.

### Phase 2 Day 5 (Bidirectional CAD enrichment) ✅

- **`src/cad/enrichment.js`** — merge live CAD run status + handoff assignment onto dispatch manifest
- **`GET /api/cad/enriched-dispatch?level=2`** · `summarize_dispatch` agent tool returns enriched payload
- Map at-risk trips show **cadRunId + unitStatus** labels · pipeline **`cad_dispatch_enrich`** audit step
- COP export includes `cadLinkedAtRisk` + live unit status counts

**Scope guard:** Enrichment is read/sync only — enriches situational awareness after Day 4 write-back; not new dispatch authority.

### Phase 2 Day 6 (ESRI corridor feature service) ✅

- **`src/geo/esri.js`** — ESRI FeatureServer adapter; normalizes polyline features → GeoJSON corridors
- **`data/geo/esri-corridors-demo.json`** — pilot agency GIS demo (NassauMetro_CorridorClosures)
- **`GET /api/geo/corridors/esri`** · **`GET /api/geo/corridors/source`** · **`POST /api/geo/corridors/ingest`**
- Monitor tool **`get_corridor_layers`** · pipeline **`esri_corridor_sync`** audit step
- Map + COP export use ESRI layer status (`restrictedAtLevel` / `closedAtLevel` attributes)
- Set **`ESRI_USE_STATIC=true`** to fall back to static `corridors.json`

**Scope guard:** Read-only corridor closure overlay — not turn-by-turn routing, not ESRI Enterprise write-back, not 911 dispatch authority.

```bash
curl.exe http://127.0.0.1:8787/api/geo/corridors/esri?level=2
curl.exe http://127.0.0.1:8787/api/geo/corridors/source
curl.exe -X POST http://127.0.0.1:8787/api/geo/corridors/ingest -H "Content-Type: application/json" -d "@data/geo/esri-corridors-demo.json"
npm run eval:run
```

### Phase 2 Day 7 (Shelter + fleet extended HITL) ✅

- **`src/shelter-fleet/`** — shelter capacity + fleet asset coordination JSON adapter
- **`data/sample-shelter-fleet.json`** — National Gymnasium + fleet staging demo
- **`GET /api/shelter-fleet/summary`** · **`GET /api/shelter-fleet/cross-ref`** · **`POST /api/shelter-fleet/ingest`**
- **Extended HITL (5 roles)** at L2+: shelter coordinator + fleet logistics approve routing/allocation drafts
- Monitor tool **`get_shelter_fleet_status`** · pipeline **`shelter_fleet_cross_ref`** audit step

**Scope guard:** Coordination + HITL approval only — not shelter ops authority, not fleet dispatch, COMMS-03 triple hospital gate preserved.

```bash
curl.exe http://127.0.0.1:8787/api/shelter-fleet/summary?level=2
curl.exe http://127.0.0.1:8787/api/shelter-fleet/cross-ref?level=2
npm run eval:run
```

### Phase 2 Day 8 (Persistent audit + EOC export) ✅

- **`src/audit/store.js`** — append-only JSONL persistence (`data/audit-trail.jsonl`)
- **`src/audit/eoc-export.js`** — EOC audit briefing bundle (trail + COP snapshot)
- **`GET /api/audit/persist`** · **`GET /api/audit/eoc-briefing?level=2`**
- Pipeline step **`audit_persist`** · Monitor tools **`get_audit_persist_status`** / **`get_eoc_audit_briefing`**
- Survives server restart — audit entries reload from JSONL on boot

**Scope guard:** Persisted audit is append-only export for EOC briefings — not dispatch authority, not mutable ledger.

```bash
npm run audit:persist
npm run audit:eoc-briefing
curl.exe http://127.0.0.1:8787/api/audit/persist
curl.exe http://127.0.0.1:8787/api/audit/eoc-briefing?level=2
npm run pipeline:run
npm run eval:run
```

### Phase 2 Day 9 (Multi-feed signal ingest) ✅

- **`src/signals/multi-feed.js`** — merge NHC live + institutional JSON/REST/webhook feeds
- **`src/signals/adapters/institutional.js`** — OCHA/GFDRR/Red Cross demo adapter
- **`data/signals/institutional-feed-demo.json`** — pilot institutional overlay demo
- **`GET /api/signals/multi-feed`** · **`GET /api/signals/cross-ref`** · **`GET /api/signals/sources`** · **`POST /api/signals/ingest`**
- Monitor tool **`get_multi_feed_status`** · pipeline **`signal_multi_feed_sync`** audit step
- Escalation level stays on demo SOP thresholds — live feeds overlay headlines only

**Scope guard:** Multi-feed ingest is read-only situational overlay — not auto-escalation, not dispatch authority.

```bash
curl.exe http://127.0.0.1:8787/api/signals/multi-feed?level=2
curl.exe http://127.0.0.1:8787/api/signals/cross-ref?level=2
curl.exe http://127.0.0.1:8787/api/signals/sources
npm run pipeline:run
npm run eval:run
```
