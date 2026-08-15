# Flood Stack Runbook — Phase 3b Day 10

**Operator guide: when to trust agency GIS vs GloFAS vs commercial urban**

Extends [GloFAS pilot runbook](./glofas-pilot-runbook.md) with commercial urban pluvial rules for the three-layer Nassau flood stack.

---

## Headline

**Agency first — GloFAS for network — commercial urban for street pluvial.** CCOC never presents model or vendor guidance as Bahamian field-confirmed hydrology.

---

## Trust matrix (8 rules)

| ID | Situation | Trust source | Operator action |
|----|-----------|--------------|-----------------|
| `agency_fresh` | Agency flood GIS fresh on corridor | `agency_confirmed` | Prefer agency depth/inches; models only where agency silent |
| `agency_stale_or_empty` | Agency GIS stale, empty, or webhook down | `model_estimated_gap_fill` | Use dashed GloFAS + dotted commercial with labels; verify with EOC/field |
| `ewds_stale` | GloFAS EWDS fetch older than `GLOFAS_STALE_HOURS` | `wait_for_agency` | Prefer agency webhook; treat cached GloFAS clip as stale guidance |
| `urban_pluvial` | Urban pluvial / street ponding (Bay Street, cul-de-sacs) | `agency_or_commercial` | Do not trust coarse GloFAS alone — agency or commercial urban |
| `validation_urban_caveat` | GloFAS Day 8 gate `continue_glofas_urban_caveat` | `model_with_caveat` | Continue network gap-fill; flag urban for commercial review |
| `airgap_offline` | Sovereign edge, offline clip only | `offline_clip_only` | Pre-downloaded glofas + urban clips; refresh on connected LAN worker |
| `commercial_urban_acceptable` | Urban Day 8 gate `urban_layer_acceptable` | `commercial_model_gap_fill` | Three-way merge — agency wins overlap; commercial fills urban gaps |
| `commercial_stay_agency_only` | Urban gate `stay_agency_only` OR vendor stale | `agency_only_urban` | Suppress commercial merge until clip improves or refresh completes |

---

## Three-way merge order

1. **Agency GIS** — solid polygons · `agency_confirmed`
2. **Commercial urban** — dotted violet · `commercial_model` (where validation passed)
3. **GloFAS** — dashed blue · `model_estimated` (network/river gap-fill only)

Merge rule: `agency_wins_then_commercial_then_glofas` — suppressed zones never override agency corridors.

---

## Scope guard review (Phase 3b close-out)

1. All three layers are **guidance** — not Water & Sewerage / NEMA authority.
2. **Agency wins on overlap** — merge rule `agency_wins_corridor`.
3. **Never auto-close corridors** or **auto-send COMMS** from model or commercial zones alone.
4. **Extended HITL (5 roles)** mandatory before outbound messaging.
5. **GloFAS 0.05° grid** — credible for river/network flooding, weak for street ponding.
6. **Commercial urban** — fine mesh pluvial only where Dorian validation passed (`urban_layer_acceptable`).
7. Validation spikes (Alma/Dorian) document **honest limits** — not inch-perfect depth claims.
8. Sovereign edge hosts use **pre-downloaded clips** — no CDS or vendor API at runtime.

---

## Operator checklist (each escalation)

1. Confirm agency flood webhook status.
2. Read command map **flood stack badge**: N agency + M glofas + K urban zone(s).
3. Check Monitor sync: urban + GloFAS (cache-only / stale / L2 refresh).
4. Review pipeline audit chips: validation · air-gap · **flood_stack_runbook**.
5. Do not approve COMMS-03 citing commercial_model or model_estimated without EOC confirmation.
6. On sovereign edge: verify clip age via glofas + urban air-gap profiles.

---

## Defensibility narrative (three-layer honest stack)

> "We integrate **three honestly labeled flood layers** — Bahamian agency GIS first, licensed commercial urban for street pluvial where validated, and Copernicus GloFAS for network gap-fill when agency is silent. Defensibility is **agency-first merge + validation gates + HITL + audit** — not pretending any single model is local hydrology authority."

---

## API quick test

```bash
npm run geo:flood-stack-runbook
npm run test:flood-stack-runbook
curl.exe http://127.0.0.1:8787/api/geo/hazards/flood-stack/runbook
curl.exe "http://127.0.0.1:8787/api/geo/hazards/flood-stack/runbook?level=2"
set URBAN_FLOOD_ENABLED=true && set GLOFAS_ENABLED=true && npm run pipeline:run
curl.exe http://127.0.0.1:8787/api/defensibility/narrative
```

---

## Related docs

- [GloFAS pilot runbook](./glofas-pilot-runbook.md) — inherited 6-rule matrix
- [Phase 3b roadmap](./phase3b-roadmap.md)
- [Urban flood vendor setup](./urban-flood-vendor-setup.md)
- [Sovereign deploy](./sovereign-deploy.md)
- [Phase 3b Day 8 logbook](./logbook-phase3b-day8.txt) — Dorian re-validation
