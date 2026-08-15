# Phase 3 Roadmap — GloFAS / Copernicus Gap-Fill Flood Layer

**Post-sprint · Future Caribbean · New Providence pilot**

---

## Headline

**Agency GIS when available — Copernicus GloFAS when not.** CCOC clips global flood guidance to Nassau and cross-references corridors/trips without building in-house hydrology.

---

## Principles

1. **Agency first** — Bahamian EOC / public works webhook remains primary when present (Phase 2 Day 12)
2. **Model gap-fill** — GloFAS/EWDS supplies coarse river/discharge exceedance when agency layer is stale or empty
3. **Label confidence** — Every GloFAS zone tagged `source: glofas` · `confidence: model_estimated` · never presented as field-confirmed depth
4. **Same command surface** — Normalized GeoJSON → existing flood map, hazard fusion, audit pipeline
5. **Read-only** — Not hydrology authority; HITL mandatory before outbound COMMS

---

## Sensible stack (Phase 3 implements #2)

| Priority | Source | Status |
|----------|--------|--------|
| 1 | Agency / EOC flood GIS webhook | ✅ Phase 2 (`POST /api/geo/hazards/flood/ingest`) |
| 2 | **GloFAS / Copernicus EWDS clip to Nassau** | ✅ Phase 3 (complete) |
| 3 | Commercial urban flood (Fathom, JBA) | 📋 Phase 3b — see [phase3b-roadmap.md](./phase3b-roadmap.md) |
| 4 | Field confirm ingest | Future operator override |

---

## Data path

```
Copernicus EWDS (GloFAS forecast GRIB/NetCDF)
        ↓  CDS API (daily discharge ensemble)
   clip bbox New Providence (~77.24–77.36°W, 25.03–25.10°N)
        ↓  threshold: return period / discharge percentile
   normalize → GeoJSON FeatureCollection (CCOC flood schema)
        ↓
   merge with agency layer (agency wins on overlap)
        ↓
   map overlay · hazard fusion · audit · EOC export
```

**GloFAS reality check:** Global 0.05° grid (~5 km) — good for **river/network flooding**, weak for **urban street ponding**. Phase 3 success = credible gap-fill + honest confidence labels, not inch-perfect Eastern Road depth.

---

## Sprint calendar (10 days)

### Phase 3 Day 1 — GloFAS adapter + Nassau clip demo ✅

- `src/geo/glofas.js` — adapter, Nassau bbox, demo fallback, normalize to flood schema
- `data/geo/glofas-nassau-demo.json` — clipped sample features
- `GET /api/geo/hazards/glofas` · `/glofas/cross-ref` · `POST /hazards/glofas/ingest`
- `.env.example` — `GLOFAS_ENABLED`, `GLOFAS_DEMO`, `GLOFAS_CLIP_BBOX`
- Merge hook in `hazards.js` when `GLOFAS_ENABLED=true`

### Phase 3 Day 2 — EWDS / CDS credentials + fetch stub ✅

- `docs/glofas-cds-setup.md` — Copernicus CDS registration + env guide
- `src/geo/glofas-cds.js` — CDS catalogue probe, cache read/write, stale warning
- `GLOFAS_LIVE`, `GLOFAS_CDS_*`, `GLOFAS_CDS_MOCK`, `GLOFAS_CDS_CACHE_PATH` env vars
- `syncGlofasFloodLayer()` · `GET /api/geo/hazards/glofas/status` · enhanced `POST /fetch`
- Pipeline step `glofas_flood_sync` · Monitor tool `get_glofas_flood_status`
- Cache last successful fetch in `data/geo/glofas-cds-cache.json` + audit trail

### Phase 3 Day 3 — Grid → polygon conversion (MVP) ✅

- `src/geo/glofas-convert.js` — discharge grid → GeoJSON polygons, `depthBand` thresholds
- `data/geo/glofas-grid-nassau-demo.json` — demo discharge cells for Nassau clip
- `scripts/glofas-grid-from-nc.py` — optional NetCDF sidecar stub
- `convertGlofasGridFile()` wired into CDS sync (`attachGridConversion`) → `glofas-nassau-latest.json`
- Layer loader prefers `GLOFAS_CLIP_PATH` over demo when clip exists
- `GLOFAS_GRID_PATH`, `GLOFAS_CLIP_PATH` env vars · `npm run geo:glofas-convert` · `npm run test:glofas-convert`
- Unit tests on demo grid slice (`tests/glofas-convert.test.mjs`)

### Phase 3 Day 4 — Agency + GloFAS merge rules ✅

- Agency features override GloFAS on same corridor
- `confidence` field: `agency_confirmed` vs `model_estimated`
- Hazard fusion briefing shows source attribution per trip

### Phase 3 Day 5 — Map + legend styling ✅

- Agency flood: solid cyan (existing)
- GloFAS model: dashed cyan + “model” label (no fake inch depth when unknown)
- Map badge: `N agency + M glofas zone(s)`

### Phase 3 Day 6 — Pipeline + Monitor tool ✅

- Pipeline step `glofas_flood_sync`
- Monitor tool `get_glofas_flood_status`
- EOC export `glofasFlood` block

### Phase 3 Day 7 — Scheduled refresh during escalation ✅

- Refresh GloFAS on pipeline run when `level >= 2`
- Optional cron/worker doc for sovereign deploy
- Stale feed warning if EWDS fetch > 36 h old

### Phase 3 Day 8 — Validation spike (Alma / Dorian historical) ✅

- Pull GloFAS historical for known event window
- Compare coarse extent vs demo agency zones — document fit/misfit in logbook
- Decision gate: continue GloFAS vs escalate to commercial

### Phase 3 Day 9 — Sovereign + air-gap profile ✅

- Pre-download GloFAS clip to `data/geo/glofas-nassau-latest.json` for offline edge
- Document in `docs/sovereign-deploy.md`

### Phase 3 Day 10 — Pilot runbook + scope guard review ✅

- Operator runbook: when to trust model vs wait for agency (`docs/glofas-pilot-runbook.md`)
- `src/geo/glofas-runbook.js` — 6-rule trust matrix + scope guard review
- Pipeline step `glofas_runbook_sync` · Monitor tool `get_glofas_runbook_status`
- Defensibility narrative updated — gap-fill not replacement hydrology (6th pillar)

---

## API (Day 1+)

```bash
curl.exe http://127.0.0.1:8787/api/geo/hazards/glofas?level=2
curl.exe http://127.0.0.1:8787/api/geo/hazards/glofas/cross-ref?level=2
curl.exe http://127.0.0.1:8787/api/geo/hazards/flood?level=2
npm run geo:glofas
```

Set `GLOFAS_ENABLED=true` to merge GloFAS gap-fill with agency flood layer on map + cross-ref.

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `GLOFAS_ENABLED` | `false` | Merge GloFAS gap-fill into flood overlay |
| `GLOFAS_DEMO` | `true` | Use demo clip when CDS key absent |
| `GLOFAS_DEMO_PATH` | `data/geo/glofas-nassau-demo.json` | Offline demo layer |
| `GLOFAS_CLIP_BBOX` | `77.36,-77.24,25.03,25.10` | Nassau clip (west,east,south,north) |
| `GLOFAS_CDS_URL` | — | Copernicus EWDS CDS API endpoint (Day 2+) |
| `GLOFAS_CDS_KEY` | — | CDS API key (never commit) |

---

## Scope guard

- GloFAS gap-fill is **model guidance** — not Water & Sewerage / NEMA authority
- Do not auto-close corridors or auto-send COMMS from model zones alone
- Extended HITL remains mandatory for outbound messaging
- Urban pluvial flooding may require Phase 3b commercial layer — see [phase3b-roadmap.md](./phase3b-roadmap.md) (triggered by Day 8 `continue_glofas_urban_caveat` gate)

---

## Phase 3b (next sprint)

Commercial urban flood layer for street pluvial / Bay Street ponding where GloFAS is too coarse. Full 10-day calendar: **[phase3b-roadmap.md](./phase3b-roadmap.md)**.

## References

- [GloFAS forecast dataset (EWDS)](https://ewds.climate.copernicus.eu/datasets/cems-glofas-forecast)
- [GloFAS technical information](https://global-flood.emergency.copernicus.eu/)
- [CEMS Flood Data User Guide](https://confluence.ecmwf.int/display/CEMS/CEMS-Flood+Data+User+Guide)
