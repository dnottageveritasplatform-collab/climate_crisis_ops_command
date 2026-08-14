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
| LLM calls | None when `DEMO_MODE=true` | Optional Groq/Nebius when keys available |

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
