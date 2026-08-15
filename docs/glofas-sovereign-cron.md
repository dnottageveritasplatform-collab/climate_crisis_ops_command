# GloFAS Sovereign Refresh — Phase 3 Day 7

**Goal:** Keep Copernicus EWDS gap-fill current on operator-controlled infrastructure without relying on cloud pipeline runs alone.

CCOC refreshes GloFAS automatically when the orchestrator pipeline runs at **L2+** (`GLOFAS_ESCALATION_MIN_LEVEL`, default `2`). On sovereign / air-gapped hosts, schedule a background worker so the CDS cache stays warm even when operators are not clicking **Run Pipeline**.

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `GLOFAS_ENABLED` | `false` | Merge GloFAS gap-fill into flood overlay |
| `GLOFAS_LIVE` | `false` | Allow CDS probe on manual fetch / pipeline refresh |
| `GLOFAS_ESCALATION_MIN_LEVEL` | `2` | Pipeline refresh only when escalation level ≥ this |
| `GLOFAS_STALE_HOURS` | `36` | Monitor + audit stale warning when last fetch exceeds this |
| `GLOFAS_CDS_KEY` | — | Copernicus CDS API key (never commit) |
| `GLOFAS_CDS_CACHE_PATH` | `data/geo/glofas-cds-cache.json` | Last successful fetch metadata |

See also `docs/glofas-cds-setup.md` and `.env.example`.

---

## Option A — Cron (Linux / WSL sovereign VM)

Refresh every 6 hours during active storm windows:

```bash
# crontab -e
0 */6 * * * cd /opt/ccoc && /usr/bin/node -e "import('./src/geo/glofas.js').then(m=>m.syncGlofasFloodLayer(2,{refresh:true})).then(r=>console.log(JSON.stringify({ok:r.ok,fetchMode:r.fetchMode,stale:r.cdsStatus?.staleWarning},null,2)))" >> /var/log/ccoc-glofas-refresh.log 2>&1
```

Verify:

```bash
npm run geo:glofas-cds
npm run geo:glofas-fetch
curl.exe http://127.0.0.1:8787/api/geo/hazards/glofas/status
```

---

## Option B — systemd timer (recommended on-prem)

`/etc/systemd/system/ccoc-glofas-refresh.service`:

```ini
[Unit]
Description=CCOC GloFAS EWDS refresh
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/ccoc
EnvironmentFile=/opt/ccoc/.env
ExecStart=/usr/bin/npm run geo:glofas-fetch
```

`/etc/systemd/system/ccoc-glofas-refresh.timer`:

```ini
[Unit]
Description=Refresh GloFAS clip every 6 hours

[Timer]
OnBootSec=15min
OnUnitActiveSec=6h
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ccoc-glofas-refresh.timer
```

---

## Option C — Windows Task Scheduler (pilot laptop)

1. Action: `node.exe`
2. Arguments: `-e "import('./src/geo/glofas.js').then(m=>m.syncGlofasFloodLayer(2,{refresh:true}))"`
3. Start in: `C:\path\to\Climate & Crisis Ops Command`
4. Trigger: every 6 hours while `GLOFAS_ENABLED=true`

---

## Stale feed handling

When `lastSuccessfulFetchAt` is older than `GLOFAS_STALE_HOURS`:

- Monitor brief shows a **GloFAS EWDS feed stale** banner
- Recommended action: prefer agency flood GIS until refresh completes
- Audit pipeline summary: `glofas_flood_sync · stale Nh (prefer agency GIS)`
- Map meta row: `GloFAS stale Nh`

Pipeline runs below L2 use **cache-only** (`glofas_status_only`) — no CDS probe — to avoid unnecessary outbound calls during routine monitoring.

---

## Scope guard

- Scheduled refresh is **read-only gap-fill guidance** — not NEMA / Water & Sewerage authority
- Cron/worker does not bypass HITL before outbound COMMS
- Pre-download clip for fully air-gapped edge is Phase 3 Day 9 (`docs/sovereign-deploy.md`)
