# GloFAS Pilot Runbook — Phase 3 Day 10

**Operator guide: when to trust model gap-fill vs wait for agency GIS**

---

## Headline

**Agency first — GloFAS when agency is silent or stale.** CCOC never presents Copernicus guidance as Bahamian field-confirmed hydrology.

---

## Trust matrix (6 rules)

| ID | Situation | Trust source | Operator action |
|----|-----------|--------------|-----------------|
| `agency_fresh` | Agency flood GIS fresh on corridor | `agency_confirmed` | Prefer agency depth/inches; GloFAS only where agency silent |
| `agency_stale_or_empty` | Agency GIS stale, empty, or webhook down | `model_estimated_gap_fill` | Use dashed GloFAS zones; verify with EOC/field before hard restrictions |
| `ewds_stale` | EWDS fetch older than `GLOFAS_STALE_HOURS` | `wait_for_agency` | Prefer agency webhook; treat cached clip as stale guidance |
| `urban_pluvial` | Urban pluvial / street ponding | `agency_or_commercial` | Do not trust coarse GloFAS alone — agency or Phase 3b commercial |
| `validation_urban_caveat` | Day 8 gate `continue_glofas_urban_caveat` | `model_with_caveat` | Continue network gap-fill; flag urban for optional commercial review |
| `airgap_offline` | Sovereign edge, offline clip only | `offline_clip_only` | Pre-downloaded clip; refresh on connected LAN worker only |

---

## Scope guard review (say aloud in pilot)

1. GloFAS gap-fill is **model guidance** — not Water & Sewerage / NEMA authority.
2. **Agency wins on overlap** — merge rule `agency_wins_corridor`.
3. **Never auto-close corridors** or **auto-send COMMS** from model zones alone.
4. **Extended HITL (5 roles)** mandatory before outbound messaging.
5. **0.05° grid** (~5 km) — credible for river/network flooding, weak for street ponding.
6. Validation spike (Alma/Dorian) supports **continue with urban caveat** — not inch-perfect depth claims.

---

## Operator checklist (each escalation)

1. Confirm agency flood webhook status (`POST /api/geo/hazards/flood/ingest` or demo layer).
2. Read map badge: **N agency + M glofas zone(s)** — solid vs dashed styling.
3. Check Monitor GloFAS sync: cache-only / stale / L2 escalation refresh.
4. Review pipeline audit chips: flood · validation · air-gap · **runbook**.
5. Do not approve COMMS-03 drafts citing model zones without EOC confirmation.
6. On sovereign edge: verify clip age via `GET /api/geo/hazards/glofas/air-gap`.

---

## Defensibility narrative (gap-fill not replacement)

> "We integrate Copernicus GloFAS as **labeled gap-fill** when Bahamian agency GIS is missing or stale — we do **not** claim it replaces field hydrology. Defensibility is **agency-first merge + HITL + audit**, not pretending a global model is local authority."

---

## API quick test

```bash
npm run geo:glofas-runbook
npm run test:glofas-runbook
curl.exe http://127.0.0.1:8787/api/geo/hazards/glofas/runbook
curl.exe "http://127.0.0.1:8787/api/geo/hazards/glofas/runbook?level=2"
set GLOFAS_ENABLED=true && npm run pipeline:run
curl.exe http://127.0.0.1:8787/api/defensibility/narrative
```

---

## Related docs

- [Phase 3 roadmap](./phase3-roadmap.md)
- [GloFAS CDS setup](./glofas-cds-setup.md)
- [Sovereign deploy](./sovereign-deploy.md)
- [Day 8 validation logbook](./logbook-phase3-day8.txt)
