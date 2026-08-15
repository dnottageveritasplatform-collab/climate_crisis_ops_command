# Sovereign On-Prem Deploy — Phase 2 Day 15

**Goal:** Operator-controlled data residency for Caribbean NEMT + hospital partners — same command surface as cloud staging, without mandatory outbound LLM or SaaS dependencies.

**OWC / Future Caribbean angle:** Dispatch manifest, audit trail, SOP corpus, and GIS hazard layers stay on the operator's VM or edge appliance.

---

## Recommended sovereign profile

| Setting | Value | Why |
|---------|-------|-----|
| `DEMO_MODE` | `true` | Zero outbound LLM API — tool-first agents + local SOP RAG |
| `AUDIT_PERSIST` | `true` | Append-only JSONL on local disk (`data/audit-trail.jsonl`) |
| `NHC_LIVE` | `false` | Demo storm signals when NHC XML unreachable or air-gapped |
| `PORT` | `8787` | Same as sprint command UI |

Copy `.env.sovereign.example` → `.env` on the operator host.

---

## Option A — Docker Compose (fastest on-prem pilot)

```bash
docker compose -f docker-compose.sovereign.yml up --build
curl.exe http://127.0.0.1:8787/api/deploy/sovereign
curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
```

Persistent `data/` volume retains audit trail across container restarts.

---

## Option B — Docker on edge VM

```bash
docker build -t ccoc:sovereign .
docker run --rm -p 8787:8787 -v "%CD%\data:/app/data" --env-file .env.sovereign.example ccoc:sovereign
```

Mount operator GIS JSON into `data/geo/` and set `FLOOD_DEPTH_PATH`, `WIND_EXPOSURE_PATH`, etc.

---

## Option C — Nebius VM (operator-selected region)

Same container image as staging. Operator owns VM, disk, and network policy — CCOC does not require multi-tenant SaaS. Use **without GPU** preset (lightweight Node server).

---

## Data residency map

| Data class | Location | Notes |
|------------|----------|-------|
| Dispatch manifest | `data/` (pilot: synthetic CSV/JSON) | Replace with operator feed |
| Audit trail | `data/audit-trail.jsonl` | Append-only; EOC export reads local file |
| SOP corpus | `docs/sops/*.txt` | Hybrid keyword RAG — no embedding API |
| GIS hazards | `data/geo/*.json` | Webhook ingest from agency GIS |
| GloFAS clip | `data/geo/glofas-nassau-latest.json` | Pre-downloaded Nassau clip — no CDS at runtime (Phase 3 Day 9) |
| Urban flood clip | `data/geo/urban-flood-nassau-latest.json` | Pre-downloaded commercial urban clip — no vendor API at runtime (Phase 3b Day 9) |
| LLM calls | None when `DEMO_MODE=true` | Optional Groq/Nebius when keys available |

---

## GloFAS air-gap bundle (Phase 3 Day 9)

For sovereign / air-gapped edge hosts, pre-download the Nassau GloFAS clip so flood gap-fill works **without** Copernicus CDS outbound calls.

### Bundle layout

| File | Required | Purpose |
|------|----------|---------|
| `data/geo/glofas-nassau-latest.json` | **Yes** | Pre-converted clip GeoJSON (`GLOFAS_CLIP_PATH`) |
| `data/geo/glofas-grid-nassau-demo.json` | Optional | Grid sidecar for refresh worker |
| `data/geo/glofas-cds-cache.json` | Optional | Last fetch metadata + stale hours |
| `data/geo/glofas-validation-catalog.json` | Optional | Alma/Dorian offline validation spike |

### Recommended sovereign env (GloFAS)

```env
GLOFAS_ENABLED=true
GLOFAS_AIRGAP=true
GLOFAS_LIVE=false
GLOFAS_DEMO=false
GLOFAS_CLIP_PATH=data/geo/glofas-nassau-latest.json
```

With `GLOFAS_LIVE=false`, pipeline runs use **offline_clip_only** — cached clip + agency GIS merge; no EWDS probe.

### Pre-download workflow (connected staging → air-gap edge)

On a connected staging host:

```bash
npm run geo:glofas-fetch
npm run geo:glofas-convert
```

Copy to sovereign edge:

```bash
# minimum bundle
data/geo/glofas-nassau-latest.json
data/geo/glofas-cds-cache.json
data/geo/flood-depth-demo.json
```

Verify on edge:

```bash
npm run geo:glofas-airgap
curl.exe http://127.0.0.1:8787/api/geo/hazards/glofas/air-gap
curl.exe http://127.0.0.1:8787/api/deploy/sovereign
```

Pipeline audit chip: `glofas_airgap_sync·air-gap-clip·N-feature(s)`

Scheduled refresh on connected sovereign LAN (not fully air-gapped): see `docs/glofas-sovereign-cron.md`.

---

## Urban flood air-gap bundle (Phase 3b Day 9)

For sovereign / air-gapped edge hosts, pre-download the Nassau commercial urban flood clip so street-level pluvial gap-fill works **without** Fathom/JBA vendor API outbound calls.

### Bundle layout

| File | Required | Purpose |
|------|----------|---------|
| `data/geo/urban-flood-nassau-latest.json` | **Yes** | Pre-converted urban clip GeoJSON (`URBAN_FLOOD_CLIP_PATH`) |
| `data/geo/urban-flood-grid-nassau-demo.json` | Optional | Grid sidecar for refresh worker |
| `data/geo/urban-flood-cache.json` | Optional | Last vendor fetch metadata + stale hours |
| `data/geo/urban-flood-validation-catalog.json` | Optional | Dorian FLOOD-04 offline validation spike |

### Recommended sovereign env (urban flood)

```env
URBAN_FLOOD_ENABLED=true
URBAN_FLOOD_AIRGAP=true
URBAN_FLOOD_LIVE=false
URBAN_FLOOD_DEMO=false
URBAN_FLOOD_CLIP_PATH=data/geo/urban-flood-nassau-latest.json
```

With `URBAN_FLOOD_LIVE=false`, pipeline runs use **offline_clip_only** — cached urban clip + agency GIS three-way merge; no vendor probe.

### Pre-download workflow (connected staging → air-gap edge)

On a connected staging host:

```bash
npm run geo:urban-flood-fetch
npm run geo:urban-flood-convert
```

Copy to sovereign edge:

```bash
# minimum bundle
data/geo/urban-flood-nassau-latest.json
data/geo/urban-flood-cache.json
data/geo/flood-depth-demo.json
```

Verify on edge:

```bash
npm run geo:urban-flood-airgap
curl.exe http://127.0.0.1:8787/api/geo/hazards/urban-flood/air-gap
curl.exe http://127.0.0.1:8787/api/deploy/sovereign
```

Pipeline audit chip: `urban_flood_airgap_sync·urban-air-gap-clip·N-feature(s)`

Sovereign deploy check: `urban_flood_airgap_clip` — passes when clip is present on disk.

Scheduled refresh on connected sovereign LAN (not fully air-gapped): see `docs/urban-flood-sovereign-cron.md`.

---

## Scope guard

- Sovereign deploy is **coordination software on operator infrastructure** — not 911 PSAP, not county CAD replacement
- Triple / Extended HITL still mandatory before outbound COMMS or driver SMS
- Live CAD/EMS feeds optional via read-only adapters (Phase 2 Days 1–5)

---

## API

```bash
npm run deploy:sovereign
curl.exe http://127.0.0.1:8787/api/deploy/sovereign
curl.exe http://127.0.0.1:8787/api/deploy/sovereign/checklist
```
