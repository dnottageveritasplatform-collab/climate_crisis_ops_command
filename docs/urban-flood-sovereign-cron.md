# Urban Flood Sovereign Refresh — Phase 3b Day 7

**Goal:** Keep commercial urban flood clip current on operator-controlled infrastructure without relying on cloud pipeline runs alone.

CCOC refreshes the urban flood layer automatically when the orchestrator pipeline runs at **L2+** (`URBAN_FLOOD_ESCALATION_MIN_LEVEL`, default `2`). Below L2, pipeline runs use **cache-only** — no outbound vendor probe. On sovereign / air-gapped hosts, schedule a background worker so the vendor cache stays warm even when operators are not clicking **Run Pipeline**.

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `URBAN_FLOOD_ENABLED` | `false` | Merge commercial urban layer into flood overlay |
| `URBAN_FLOOD_LIVE` | `false` | Allow vendor API probe on manual fetch / L2+ live refresh |
| `URBAN_FLOOD_ESCALATION_MIN_LEVEL` | `2` | Pipeline refresh only when escalation level ≥ this |
| `URBAN_FLOOD_STALE_HOURS` | `24` | Monitor + audit stale warning when last fetch exceeds this |
| `URBAN_FLOOD_API_KEY` | — | Vendor key (never commit) |
| `URBAN_FLOOD_CACHE_PATH` | `data/geo/urban-flood-cache.json` | Last successful fetch metadata |
| `URBAN_FLOOD_CLIP_PATH` | `data/geo/urban-flood-nassau-latest.json` | Converted urban clip output |

See also `docs/urban-flood-vendor-setup.md` and `.env.example`.

---

## Cache-only below L2 policy

| Escalation | Pipeline `urban_flood_sync` | Outbound vendor API |
|------------|----------------------------|---------------------|
| L1 | `skipped_below_L2` · reload cached clip only | No |
| L2+ | `escalation_refresh` · reload clip (+ vendor probe if `URBAN_FLOOD_LIVE=true`) | Only when `URBAN_FLOOD_LIVE=true` |

Stale vendor feed (`staleHours > URBAN_FLOOD_STALE_HOURS`) surfaces amber warning in Monitor brief and audit — prefer agency GIS until refresh completes.

---

## Option A — Cron (Linux / WSL sovereign VM)

Refresh every 4 hours during active storm windows:

```bash
# crontab -e
0 */4 * * * cd /opt/ccoc && /usr/bin/node -e "import('./src/geo/urban-flood.js').then(m=>m.syncUrbanFloodLayer(2,{refresh:true})).then(r=>console.log(JSON.stringify({ok:r.ok,fetchMode:r.fetchMode,stale:r.vendorStatus?.staleWarning},null,2)))" >> /var/log/ccoc-urban-flood-refresh.log 2>&1
```

Verify:

```bash
npm run geo:urban-flood-vendor
npm run geo:urban-flood-fetch
curl.exe http://127.0.0.1:8787/api/geo/hazards/urban-flood/status
```

---

## Option B — systemd timer (recommended on-prem)

`/etc/systemd/system/ccoc-urban-flood-refresh.service`:

```ini
[Unit]
Description=CCOC commercial urban flood refresh
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/ccoc
EnvironmentFile=/opt/ccoc/.env
ExecStart=/usr/bin/npm run geo:urban-flood-fetch
```

`/etc/systemd/system/ccoc-urban-flood-refresh.timer`:

```ini
[Unit]
Description=CCOC urban flood refresh every 4h

[Timer]
OnCalendar=*-*-* 00/4:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:

```bash
sudo systemctl enable --now ccoc-urban-flood-refresh.timer
```

---

## Option C — Windows Task Scheduler

Program: `node`  
Arguments: `-e "import('./src/geo/urban-flood.js').then(m=>m.syncUrbanFloodLayer(2,{refresh:true}))"`  
Start in: `C:\ccoc`  
Trigger: every 4 hours during hurricane season.

---

## Scope guard

- Urban flood refresh is **licensed model guidance** — not NEMA authority
- L1 cache-only avoids unnecessary vendor API calls during steady-state monitoring
- Cron/worker is operator-run — CCOC does not auto-send COMMS from commercial zones
