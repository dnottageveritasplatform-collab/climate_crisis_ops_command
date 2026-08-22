# HighRise H200 Compute — LLM Inference (Future Caribbean partner)

**Sprint status (Aug 2026):** CCOC is **wired for HighRise** — buildathon portal base URL + API key + catalog model ID in local `.env` (OpenAI-compatible `LLM_*` block). Lines are **commented out** for demo day because partner access expires ~Tuesday; live pitch stays on **`DEMO_MODE=true`**. Mention to judges: *verified H200 inference during sprint; demo mode today for reliability.*

**Goal:** Wire CCOC agents to **HighRise Cloud** inference on **NVIDIA H200-class** GPUs — the sprint compute partner judges and founders expect teams to use.

CCOC already speaks **OpenAI-compatible** `/chat/completions`. Point `LLM_BASE_URL` at HighRise's **serverless** endpoint + pass a catalog model ID — no Model Service deploy required for the buildathon API key path.

---

## Buildathon API key ≠ deploy a Model Service

HighRise has **two different things**:

| Product | What the buildathon key is for | Do you deploy GPU pods? |
|---------|--------------------------------|-------------------------|
| **Serverless endpoints** | Shared hosted LLMs — key + model ID string + base URL | **No** |
| **Model Service / Model Market** | Your own dedicated inference deployment | Yes (optional) |

**The Future Caribbean portal API key is for serverless inference.** You do **not** need to launch a Model Service just to get a model name.

The **model name is not a secret** — it is a **catalog ID string** you send in the JSON body, same as Groq's `llama-3.3-70b-versatile`. HighRise documents these in [Serverless endpoint](https://cloud.highrise.ai/doc/features/endpoint/) and [Model Market](https://cloud.highrise.ai/doc/features/iaas/modelmarket/):

| Try this `LLM_MODEL` first | Notes |
|----------------------------|--------|
| `meta-llama-3-8b-instruct` | Default in HighRise curl examples |
| `gemma-2-2b-it` | Smaller / faster |
| `Qwen2-72b-instruct` | Heavier |

**What you actually need from the portal (besides the key):**

1. **`LLM_API_KEY`** — buildathon email or **Setting → API Key** ✓ you have this  
2. **`LLM_BASE_URL`** — server address + `/api/v1/ai` (CCOC appends `/chat/completions`)

### Where the base URL is (and is NOT)

HighRise does **not** publish one global URL like `https://api.highrise.ai`. Their docs use a useless private IP example (`192.168.10.202`) — ignore that.

| Page (your sidebar) | Has base URL? |
|---------------------|---------------|
| **Setting → Profile** | **No** — name/email only |
| **Setting → API Key** | **Usually no** — key only; check anyway |
| **Setting → Billing** | No |
| **Inference → Playground → API tab** | **Yes** — when model dropdown works |
| **Inference → Model Service → Detail** | **Yes** — after you deploy a service (each gets its own URL) |
| **Support → Help Docs** | Docs only — same placeholder IP |
| **Future Caribbean buildathon email** | **Often yes** — check portal inbox |

**If Playground dropdown is empty**, HighRise has not surfaced your serverless endpoint in the UI. Your options:

1. **Setting → API Key** — scroll the full page; some orgs show endpoint text there  
2. **Inference → Model Service** — if any row is **Running**, open **Detail** → copy API URL  
3. **Buildathon portal / welcome email** — search for `http`, `https`, `api/v1/ai`, or `chat/completions`  
4. **Email organizers** — `apply@futurecaribbean.com` or HighRise support: *"What is the inference base URL for org Org_NrQ25N? Playground model dropdown is empty."*

There is nowhere else in the portal to "discover" it — this is a HighRise UX gap, not something you missed.

**Quick smoke test** (replace `BASE_URL` from your buildathon email):

```powershell
curl.exe -X POST "BASE_URL/chat/completions" `
  -H "Authorization: Bearer YOUR_API_KEY" `
  -H "Content-Type: application/json" `
  -d "{\"model\":\"meta-llama-3-8b-instruct\",\"messages\":[{\"role\":\"user\",\"content\":\"say hi\"}],\"max_tokens\":32}"
```

If that returns JSON, wire the same values into `.env` below. If it times out, the base URL is wrong or unreachable from your network — check the buildathon email; do not guess `192.168.x.x` from docs (that's an internal example).

**Model Service deploy** is only if you want a **dedicated** GPU pod — not required for the shared serverless API key path.

---

## 1. Credentials (current HighRise Cloud UI)

### API key

1. Left sidebar → **Setting** → **API Key** (not Profile)  
2. Or use the key from the **Future Caribbean buildathon portal** — same thing  

### Base URL (the part Playground would show if UI worked)

Check, in order:

1. Buildathon portal / welcome email for endpoint URL  
2. **Support → Help Docs → Serverless Endpoints**  
3. **Inference As A Service → Playground → API** tab (when dropdown works)  

Docs: [Serverless endpoint](https://cloud.highrise.ai/doc/features/endpoint/)

---

## Architecture (pitch-ready)

| Layer | Where it runs | Judge story |
|-------|----------------|-------------|
| **Command app** | Docker on Nebius / Render / local | Thin coordination shell — map, HITL, audit |
| **Agent LLM** | **HighRise Inference as a Service** (H200) | Monitor → Triage → Action prose on sprint partner compute |
| **Eval / rehearsal** | `DEMO_MODE=true` locally | 8/8 scenarios, zero tokens — efficiency baseline |

**Efficiency narrative:** Demo mode = 0 tokens for judges; live pipeline runs log **prompt/completion/total tokens + latency** per agent on HighRise — show the rollup in the UI after **Run Pipeline**.

**Defensibility narrative:** Operator workflow + SOP + audit moat does not depend on a consumer API tier. Inference runs on **Future Caribbean–provisioned H200 infrastructure** — same class of compute as production agentic systems, not a chatbot wrapper on a free tier.

---

## 2. Environment

Copy into `.env` (see also `.env.example`):

```env
DEMO_MODE=false

LLM_PROVIDER=highrise
LLM_BASE_URL=https://YOUR-BASE-URL-FROM-BUILDATHON-EMAIL/api/v1/ai
LLM_API_KEY=your-buildathon-or-portal-api-key
LLM_MODEL=meta-llama-3-8b-instruct
```

**Notes**

- **`LLM_MODEL`** — use a catalog ID above; you do not get a unique name from deploying unless you chose Model Service.  
- **`LLM_BASE_URL`** — must come from buildathon email / portal / API tab; CCOC appends `/chat/completions`.  
- Keep **`DEMO_MODE=true`** on public staging if you do not want LLM keys on the web server.

---

## 3. Smoke test (CCOC)

```bash
npm start
curl.exe http://127.0.0.1:8787/api/health
# expect llmProvider: "highrise" (or provider you set), demoMode: false

curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
curl.exe http://127.0.0.1:8787/api/efficiency/summary
```

Health pill in the UI should show **LLM · highrise** (or your `LLM_PROVIDER` label).

---

## 4. Demo-day talking points (30 seconds)

**Live demo:** keep `DEMO_MODE=true` — fast, zero tokens, no expired-key risk.

**Say once** (proof or close beat, ~10 s):

> "During the sprint we ran the full Monitor → Triage → Action pipeline on **Future Caribbean partner HighRise H200 inference** — OpenAI-compatible, token and latency logged per agent. Today's live demo uses demo mode for reliability; the HighRise env block is in our repo docs and local config, ready when compute credits renew."

**If a judge asks "did you use HighRise?"**

> "Yes — we integrated and smoke-tested it. Demo mode today so judges see deterministic eval + HITL; LLM provider swaps via env only, no code fork."

Proof doc: this file · Q&A: `docs/demo-day-qa.md` · runbook: `docs/demo-day-runbook.md`

1. **Eval harness:** 8 scripted storm scenarios pass in demo mode — deterministic, auditable, no API spend.
2. **Live pipeline (sprint):** HighRise H200 runs logged tokens + latency per agent — show screenshot or `GET /api/efficiency/summary` from rehearsal if asked.
3. **Moat:** LLM enriches COMMS prose only; ranks, map sync, HITL gates, and JSONL audit are **workflow + SOP**, not model-dependent.

---

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| `401` / auth error | Key wrong or inactive — regenerate under **Setting → API Key** |
| Don't know base URL | Check **buildathon welcome email** first — not Playground |
| Playground dropdown empty | UI/org glitch — use catalog model ID + base URL from email; try logout/login |
| `model not found` | Try `meta-llama-3-8b-instruct` then `gemma-2-2b-it` |
| Connection timeout | Base URL wrong or private IP not reachable from your PC |

---

## Related

- `docs/staging-deploy.md` — app container on Nebius/Render (no GPU required for Node)
- `docs/demo-5min-rehearsal.md` — beat to cite eval + efficiency after pipeline
- `GET /api/efficiency/summary` · `GET /api/defensibility/narrative`
