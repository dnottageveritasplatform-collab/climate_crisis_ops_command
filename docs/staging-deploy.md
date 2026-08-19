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

## Option B — Render (free tier + Starter for demo day)

**Best for:** Fastest path to a public HTTPS URL. CCOC is a lightweight Node/Express app — no database, no GPU, fits Render's 512 MB plans.

| Plan | Cost | Use case |
|------|------|----------|
| **Free** | $0 | Dev/staging, backup URL, pre-demo testing |
| **Starter** | $7/mo | **Demo day** — no 15‑min spin-down, no ~60 s cold start |

Free tier spins down after 15 minutes of inactivity; the first request after idle shows Render's loading page for ~30–60 s. Upgrade to **Starter** before demo day so judges get an instant response.

---

### Step 1 — Local smoke test (before cloud)

```bash
npm run deploy:check
npm ci
npm start
```

In a second terminal:

```bash
curl.exe http://127.0.0.1:8787/api/health
curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
```

Or via Docker:

```bash
docker build -t ccoc:staging .
docker run --rm -p 8787:8787 -e DEMO_MODE=true ccoc:staging
```

---

### Step 2 — Create the Render service

1. Sign in at [render.com](https://render.com) and connect your GitHub account.
2. **New → Web Service** → select the `climate-crisis-ops-command` repo.
3. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `ccoc-staging` (or similar) |
| **Region** | Closest to demo audience (e.g. Ohio / Oregon) |
| **Branch** | `main` (or your deploy branch) |
| **Language / Runtime** | **Node** |
| **Instance type** | **Free** for testing · **Starter** for demo day |

**Health check path:** optional at create time. If Render shows a validation error on `/api/health`, leave the field **blank**, create the service, then set it under **Settings → Health Checks → Edit →** `/api/health` → Save.

**Node runtime — Build & Deploy** (visible when Language is Node):

| Field | Value |
|-------|-------|
| **Build Command** | `npm ci` |
| **Start Command** | `npm start` |

Click **Create Web Service** and wait for the first deploy (~3–5 min on Node).

#### Alternative — Docker runtime

Choose **Language → Docker** if you prefer matching Nebius/local Docker. No Build or Start commands — Render uses the repo `Dockerfile`. First deploy takes ~5–10 min.

To change build/start on an existing **Node** service later: **Settings → Build & Deploy**.

---

### Step 3 — Environment variables

In **Environment → Add Environment Variable**, set:

| Variable | Value | Notes |
|----------|-------|-------|
| `DEMO_MODE` | `true` | Fast pipeline, zero LLM cost — recommended for staging |
| `NODE_ENV` | `production` | |
| `NHC_FEED_URL` | `https://www.nhc.noaa.gov/xml/TWOAT.xml` | Optional live Atlantic outlook overlay |

**Do not set `PORT`** — Render injects it automatically; the app reads `process.env.PORT` in `src/config.js`.

For live LLM on staging, set `DEMO_MODE=false` and add Groq keys from `.env.staging.example`.

---

### Step 4 — Deploy and verify

1. Click **Create Web Service** (first deploy takes ~3–5 min on Node, longer on Docker).
2. Copy the URL: `https://ccoc-staging.onrender.com` (yours will differ).
3. Verify:

```bash
curl.exe https://YOUR-APP.onrender.com/api/health
curl.exe https://YOUR-APP.onrender.com/api/deploy/checklist
curl.exe -X POST https://YOUR-APP.onrender.com/api/orchestrator/run
```

4. Open the URL in a browser — UI, **Run Pipeline**, and triple HITL should work.

---

### Step 5 — Upgrade to Starter before demo day

1. Open the service in the Render dashboard.
2. **Settings → Instance Type → Starter** ($7/mo).
3. Save — no redeploy required; spin-down is disabled immediately.
4. Optional: add a **custom domain** under Settings → Custom Domains (free TLS included).

**Pre-demo warm-up (Free tier only):** hit `/api/health` 2–3 minutes before presenting if you haven't upgraded yet.

---

### Render notes and limits

| Topic | Detail |
|-------|--------|
| **HTTPS** | Automatic on `*.onrender.com` — no cert setup |
| **Audit persistence** | `data/audit-trail.jsonl` is ephemeral (no persistent disk on Free/Starter). Fine for demo; HITL gate state is in-memory anyway |
| **Free tier hours** | 750 instance hours/month per workspace (~24/7 for one service) |
| **Build minutes** | 500/month on Free — Docker builds use more minutes than Node; fine for demo staging |
| **Memory** | 512 MB — sufficient for `DEMO_MODE=true` with bundled geo JSON |

---

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails on `npm ci` | Ensure `package-lock.json` is committed |
| Service unhealthy | Check logs in Render dashboard; confirm `/api/health` returns 200 |
| Slow first load (Free) | Cold start after idle — upgrade to Starter or warm up before demo |
| Pipeline timeout | Unlikely in demo mode (~1 s); check Render logs if it persists |

---

## Option C — Railway / Fly.io

Same env vars as Render (`DEMO_MODE=true`, `NODE_ENV=production`); deploy from Dockerfile or `npm start`. Render is preferred for HTTPS + health checks out of the box.

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

- [ ] `/api/health` returns `ok: true`, `phase: week-3-day-21`, `sprintComplete: true`
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
