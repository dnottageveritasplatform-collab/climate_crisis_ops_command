# Staging Deploy — Day 19

**Goal:** Public URL for mentors/judges + local backup MP4 if Wi‑Fi fails on demo day.

---

## Recommended staging profile

| Setting | Value | Why |
|---------|-------|-----|
| `DEMO_MODE` | `true` | Fast pipeline, no API keys on server, matches eval harness |
| `PORT` | `8787` (or platform default) | Express binds `$PORT` in cloud |
| `NHC_FEED_URL` | optional | Live Atlantic outlook headline overlay |

For live LLM on staging, set `DEMO_MODE=false` + Groq keys (see `.env.staging.example`).

---

## Option A — Nebius (Future Caribbean partner)

1. Redeem promo code at [Nebius console](https://console.nebius.com) → Billing
2. **Compute → Container VMs → Create container over VM**
3. **Custom image:** build and push locally, or build on VM:

```bash
docker build -t climate-crisis-ops-command .
docker run -p 8787:8787 --env-file .env.staging.example climate-crisis-ops-command
```

4. Set environment variables from `.env.staging.example` in the Nebius VM/container UI
5. Open inbound **TCP 8787** (or map platform HTTPS → 8787)
6. Verify: `curl https://YOUR-HOST/api/health`

**Nebius notes:** Use **without GPU** preset for this app — it is a lightweight Node server, not model training.

---

## Option B — Render / Railway / Fly.io (fastest path)

### Render (free web service)

1. Connect GitHub repo `climate_crisis_ops_command`
2. **New Web Service** → Environment: Docker (or Node, build `npm ci`, start `npm start`)
3. Env vars: `DEMO_MODE=true`, `PORT=8787`
4. Health check path: `/api/health`

### Railway / Fly

Same env vars; deploy from Dockerfile or `npm start`.

---

## Local Docker smoke test (before cloud)

```bash
docker build -t ccoc:staging .
docker run --rm -p 8787:8787 -e DEMO_MODE=true ccoc:staging
curl.exe http://127.0.0.1:8787/api/health
curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
npm run deploy:check
```

---

## Post-deploy checklist

- [ ] `/api/health` returns `ok: true`, `phase: week-3-day-19`
- [ ] UI loads — scenario strip + map visible
- [ ] **Run Pipeline** completes (demo mode ~1 s)
- [ ] Triple HITL approve flow works
- [ ] Backup MP4 recorded (see `docs/backup-demo-video.md`)
- [ ] Staging URL saved in logbook / pitch deck

---

## API

```bash
npm run deploy:check
curl.exe http://127.0.0.1:8787/api/deploy/checklist
```
