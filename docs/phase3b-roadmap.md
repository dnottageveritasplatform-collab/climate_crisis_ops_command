# Phase 3b Roadmap — Commercial Urban Flood Layer

**Post Phase 3 · Future Caribbean · New Providence pilot · optional design-partner track**

---

## Headline

**Agency first — GloFAS for network — commercial urban for street pluvial.** CCOC adds a fine-resolution urban flood adapter where the Day 8 validation gate documented GloFAS under-resolution (Bay Street ponding, cul-de-sacs), without replacing Bahamian agency GIS authority.

---

## Why Phase 3b exists

Phase 3 closed with gate **`continue_glofas_urban_caveat`** (`commercialReviewRecommended: true`):

| Event | GloFAS fit | Gap |
|-------|------------|-----|
| Alma 2016 | Good corridor overlap (CORR-02 / Eastern Road) | Acceptable network gap-fill |
| Dorian 2019 | Partial surge extent | **FLOOD-04 Bay Street urban pluvial** — 0.05° GloFAS grid under-resolves street ponding |

Phase 3b implements **stack priority #3** — commercial urban flood (Fathom, JBA, or equivalent) — only where agency GIS is absent **and** GloFAS is too coarse.

---

## Principles

1. **Agency still wins** — EOC / public works webhook remains primary (`agency_confirmed`)
2. **GloFAS stays for network** — river/discharge corridors; do not remove Phase 3 adapter
3. **Commercial fills urban gaps** — street pluvial, fine polygons; tagged `confidence: commercial_model`
4. **Same command surface** — normalized GeoJSON → existing flood map, hazard fusion, audit pipeline
5. **Read-only + HITL** — not hydrology authority; extended HITL mandatory before outbound COMMS
6. **Pilot-gated** — vendor API keys + license are design-partner scope; demo clip ships first

---

## Sensible stack (Phase 3b implements #3)

| Priority | Source | Status |
|----------|--------|--------|
| 1 | Agency / EOC flood GIS webhook | ✅ Phase 2 |
| 2 | GloFAS / Copernicus EWDS clip | ✅ Phase 3 |
| 3 | **Commercial urban flood (Fathom / JBA)** | 🚧 Phase 3b (this sprint) |
| 4 | Field confirm ingest | Future operator override |

---

## Data path

```
Design-partner commercial API (Fathom Global / JBA Flood Foresight) OR pre-licensed GeoJSON export
        ↓  clip urban core New Providence (~Bay Street · downtown · key cul-de-sacs)
        ↓  depth band / return period → depthInches where vendor supplies it
   normalize → GeoJSON FeatureCollection (CCOC flood schema + source: commercial)
        ↓
   three-way merge:
     agency wins on overlap
     commercial urban wins over GloFAS on urban corridor overlap
     GloFAS fills remaining network silent corridors
        ↓
   map overlay · hazard fusion · audit · EOC export
```

**Reality check:** Commercial layers improve **urban pluvial** storytelling — they are still **model products**, not NEMA field confirmation. Scope guard language from Phase 3 Day 10 runbook carries forward.

---

## Merge rule (target)

```
mergeRule: agency_wins_then_commercial_then_glofas

1. agency_confirmed     → always shown; suppresses commercial + GloFAS on same corridor
2. commercial_model     → shown where agency silent AND urban pluvial corridor flagged
3. model_estimated      → GloFAS gap-fill only where agency + commercial both silent
```

---

## Sprint calendar (10 days)

### Phase 3b Day 1 — Commercial urban adapter + Nassau demo clip ✅

- `src/geo/urban-flood.js` — adapter, urban bbox, demo fallback, normalize to flood schema
- `data/geo/urban-flood-nassau-demo.json` — Bay Street + Shirley Street pluvial demo (Dorian FLOOD-04 align)
- `GET /api/geo/hazards/urban-flood` · `/urban-flood/cross-ref` · `POST /hazards/urban-flood/ingest`
- `.env.example` — `URBAN_FLOOD_ENABLED`, `URBAN_FLOOD_DEMO`, `URBAN_FLOOD_CLIP_BBOX`, `URBAN_FLOOD_VENDOR`
- `npm run geo:urban-flood` · `npm run test:urban-flood`
- Feature flag independent of `GLOFAS_ENABLED` (both may be true)

### Phase 3b Day 2 — Vendor credentials + fetch stub ✅

- `docs/urban-flood-vendor-setup.md` — Fathom / JBA registration + licensing notes
- `src/geo/urban-flood-vendor.js` — API probe, cache read/write, stale warning
- `URBAN_FLOOD_LIVE`, `URBAN_FLOOD_VENDOR`, `URBAN_FLOOD_API_*`, `URBAN_FLOOD_CACHE_PATH`
- `syncUrbanFloodLayer()` · `GET /api/geo/hazards/urban-flood/status` · `POST /fetch`
- Pipeline step `urban_flood_sync` (stub) · Monitor tool `get_urban_flood_status`

### Phase 3b Day 3 — Export → polygon normalization ✅

- `src/geo/urban-flood-convert.js` — vendor grid/shapefile sidecar → GeoJSON polygons
- `data/geo/urban-flood-grid-nassau-demo.json` — demo depth cells for Bay Street block
- `convertUrbanFloodExport()` → `urban-flood-nassau-latest.json`
- `URBAN_FLOOD_GRID_PATH`, `URBAN_FLOOD_CLIP_PATH` env vars
- `npm run geo:urban-flood-convert` · `npm run test:urban-flood-convert`

### Phase 3b Day 4 — Three-way merge (agency + commercial + GloFAS) ✅

- Extend `hazards.js` merge: `mergeUrbanCommercialGapFill()`
- `confidence`: `agency_confirmed` · `commercial_model` · `model_estimated`
- Suppress GloFAS zones where commercial urban covers same corridor
- Hazard fusion briefing: source attribution per trip (agency / commercial / glofas)
- `npm run test:urban-flood-merge` · pipeline merge snapshot from `floodHazardSync`

### Phase 3b Day 5 — Map + legend styling ✅

- Agency flood: solid cyan (unchanged)
- GloFAS: dashed cyan + “model” (unchanged)
- **Commercial urban: dotted violet + “urban model” + depth when known**
- Map badge: `N agency + M glofas + K urban zone(s)`
- `npm run test:urban-flood-map-overlay` · `#floodStackBadge` on command map · legend toggle `flood-commercial`

### Phase 3b Day 6 — Pipeline + Monitor tool ✅

- Pipeline step `urban_flood_sync` (full payload)
- Monitor tool `get_urban_flood_status`
- EOC export `urbanFlood` block
- Extend `multi-hazard.js` fused briefing with commercial source tag

### Phase 3b Day 7 — Escalation-gated refresh + stale warning ✅

- Refresh commercial layer on pipeline when `level >= 2` (mirror GloFAS Day 7)
- `URBAN_FLOOD_STALE_HOURS` · stale vendor feed warning in Monitor brief
- Cache-only below L2 policy documented (`docs/urban-flood-sovereign-cron.md`)

### Phase 3b Day 8 — Dorian re-validation spike ✅

- Re-run Bay Street / FLOOD-04 comparison with commercial clip enabled
- `src/geo/urban-flood-validation.js` — IoU vs agency urban pluvial zones
- Decision gate: `urban_layer_acceptable` vs `stay_agency_only`
- Pipeline step `urban_flood_validation_sync` · purple audit chip
- Logbook: document fit improvement on Dorian urban misfit from Phase 3 Day 8

### Phase 3b Day 9 — Sovereign + air-gap urban bundle ✅

- Pre-download `urban-flood-nassau-latest.json` for offline edge
- Extend `sovereign.js` check `urban_flood_airgap_clip`
- Document in `docs/sovereign-deploy.md` (urban bundle section)
- Pipeline step `urban_flood_airgap_sync`

### Phase 3b Day 10 — Runbook + scope guard review (Phase 3b close-out) ✅

- Extend `docs/glofas-pilot-runbook.md` → `docs/flood-stack-runbook.md` (agency · GloFAS · commercial)
- `src/geo/flood-stack-runbook.js` — 8-rule trust matrix (inherits Phase 3 Day 10 rules + commercial)
- Pipeline step `flood_stack_runbook_sync`
- Defensibility: “three-layer honest stack” narrative
- Phase bump `phase-3b-day-10` · eval scenario update

---

## API (Day 1+)

```bash
curl.exe http://127.0.0.1:8787/api/geo/hazards/urban-flood?level=2
curl.exe http://127.0.0.1:8787/api/geo/hazards/urban-flood/cross-ref?level=2
curl.exe http://127.0.0.1:8787/api/geo/hazards/flood?level=2
npm run geo:urban-flood
```

Combined flood endpoint (Day 4+) returns merged agency + GloFAS + commercial when flags enabled.

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `URBAN_FLOOD_ENABLED` | `false` | Merge commercial urban layer into flood overlay |
| `URBAN_FLOOD_DEMO` | `true` | Use demo clip when vendor key absent |
| `URBAN_FLOOD_DEMO_PATH` | `data/geo/urban-flood-nassau-demo.json` | Offline demo layer |
| `URBAN_FLOOD_VENDOR` | `demo` | `fathom` · `jba` · `demo` |
| `URBAN_FLOOD_CLIP_BBOX` | `77.34,-77.30,25.04,25.08` | Urban core clip (tighter than GloFAS Nassau bbox) |
| `URBAN_FLOOD_LIVE` | `false` | Probe vendor API on pipeline sync |
| `URBAN_FLOOD_API_URL` | — | Vendor REST endpoint |
| `URBAN_FLOOD_API_KEY` | — | Vendor key — never commit |
| `URBAN_FLOOD_CACHE_PATH` | `data/geo/urban-flood-cache.json` | Last fetch metadata |
| `URBAN_FLOOD_CLIP_PATH` | `data/geo/urban-flood-nassau-latest.json` | Converted clip output |
| `URBAN_FLOOD_STALE_HOURS` | `24` | Stale vendor warning threshold |
| `URBAN_FLOOD_ESCALATION_MIN_LEVEL` | `2` | Pipeline refresh only at L2+ (L1 cache-only) |
| `GLOFAS_ENABLED` | `false` | Keep Phase 3 on — Phase 3b assumes GloFAS still active for network |

---

## Scope guard

- Commercial urban layer is **licensed model guidance** — not Water & Sewerage / NEMA authority
- Do not auto-close corridors or auto-send COMMS from commercial zones alone
- Extended HITL remains mandatory for outbound messaging
- Vendor licensing + API cost are **design-partner decisions** — demo clip proves merge path without contract
- If Dorian re-validation (Day 8) fails, default posture is **agency-only urban** until field GIS improves

---

## Entry criteria (start Phase 3b when)

- [ ] Phase 3 complete (10/10 days) ✅
- [ ] Design partner names urban pluvial corridors as pilot requirement (Bay Street, downtown, hospital access)
- [ ] Vendor shortlist chosen (Fathom vs JBA vs static licensed export)
- [ ] Legal/commercial review of data license for Caribbean pilot bbox

## Exit criteria (Phase 3b done when)

- [x] Dorian FLOOD-04 urban IoU improves vs GloFAS-only baseline (Day 8 re-validation)
- [x] Three-way merge + map legend + audit chips visible on L2 pipeline run
- [x] Runbook documents when to trust agency vs commercial vs GloFAS
- [x] Eval suite passes with `urban_flood_sync` in pipeline steps
- [x] Sovereign air-gap bundle documented for offline urban clip

---

## References

- [Phase 3 roadmap](./phase3-roadmap.md) — GloFAS sprint (complete)
- [GloFAS pilot runbook](./glofas-pilot-runbook.md) — agency-first trust matrix
- [Phase 3 Day 8 logbook](./logbook-phase3-day8.txt) — Dorian urban pluvial misfit
- [Fathom Global Flood](https://www.fathom.global/) — commercial urban flood (candidate vendor)
- [JBA Flood Foresight](https://jbagr.com/digital-tools/flood-foresight/) — commercial flood forecasting (candidate vendor)
