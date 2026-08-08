# Logbook Entry — Day 19

**Paste-ready for Future Caribbean Buildathon organizers / mentor check-in.**

---

**Date:** Saturday, 8 Aug 2026  
**Project:** Climate & Crisis Ops Command  
**Track:** Climate Risk & Disaster Coordination (Future Caribbean Buildathon 2026)  
**Hours:** ~3

### Goal for the day
**Staging deploy + backup offline demo video** prep. Week 3 · Day 19 sprint deliverable.

### Completed

**Docker staging (`Dockerfile`)**
- Node 20 Alpine image · `npm ci --omit=dev`
- Default `DEMO_MODE=true` for reliable public staging
- Health check on `/api/health`
- Server binds `0.0.0.0` for cloud containers

**Deploy module (`src/deploy/index.js`)**
- `buildDeployChecklist()` — file presence, eval scenarios, demo-mode guidance
- Smoke-test URLs for health, pipeline, UI

**API:** `GET /api/deploy/checklist`

**Docs**
- `docs/staging-deploy.md` — Nebius, Render/Railway/Fly, local Docker smoke test
- `docs/backup-demo-video.md` — MP4 capture checklist + demo-day fallback order
- `.env.staging.example` — recommended staging env (demo mode + optional Groq)

**CLI:** `npm run deploy:check` · `npm run docker:build`

**Phase:** server + UI pill → **Week 3 · Day 19** · module chip `deploy: staging_ready`

### Verified
```bash
npm run deploy:check
docker build -t ccoc:staging .
docker run --rm -p 8787:8787 -e DEMO_MODE=true ccoc:staging
curl.exe http://127.0.0.1:8787/api/deploy/checklist
curl.exe http://127.0.0.1:8787/api/health
```

### Staging recommendation
- **Public URL:** `DEMO_MODE=true` (fast, no API keys on server)
- **Partner path:** Nebius Container VM (no GPU) or Render/Railway from GitHub
- **Backup:** Record MP4 per `docs/backup-demo-video.md` before demo day

### Tomorrow (Day 20)
Logbook #3 + mentor questions list (per sprint plan).

### Rubric note
**Efficiency:** Staging runs demo mode — zero token cost, same workflow judges see in eval. **Agentic AI:** Full pipeline on public URL. **Defensibility:** Offline MP4 + audit trail if live URL fails.

### Attachments
| File | Shows |
|---|---|
| `docs/staging-deploy.md` | Deploy guide |
| `docs/backup-demo-video.md` | Capture checklist |
| `Dockerfile` | Container staging |

**Deliverables:** `Dockerfile` · `docs/staging-deploy.md` · `docs/backup-demo-video.md` · `GET /api/deploy/checklist`
