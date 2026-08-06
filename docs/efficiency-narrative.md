# Efficiency Narrative — Day 16

**Paste-ready for Future Caribbean pitch / mentor check-in (Efficiency rubric).**

---

## Headline

**Efficient agentic ops: tool-first pipeline, optional LLM enrichment, small RAG corpus**

## One-liner (pitch deck)

We log latency and tokens per agent. Demo mode proves the workflow for judges with **zero API cost**; MiniMax enriches narrative when enabled — without rebuilding county CAD or a vector stack in 21 days.

## Key points

1. **Tool-first architecture** — Monitor, Triage, and Action call shared tools (`get_signal_status`, `summarize_dispatch`, `query_sop`) before any LLM. Deterministic scoring, map pins, and HITL metadata stay rule-based.

2. **Zero-token demo path** — `DEMO_MODE=true` + `npm run eval:run` executes 8 scripted storm scenarios (L1–L4) with pass/fail assertions in under 1 second. Suitable for offline demo day.

3. **Optional LLM (MiniMax)** — When `DEMO_MODE=false`, only narrative layers call the API (brief, triage reasons, COMMS-03 prose). Typical pipeline: 3 LLM calls · logged per agent with prompt/completion/total tokens.

4. **Small RAG corpus** — 3 operator SOP text files in `data/sops/`; keyword retrieval, no embeddings or vector DB in sprint scope.

5. **Logged metrics** — `GET /api/efficiency/summary` · per-agent latency · per-LLM-call tokens · last pipeline rollup.

## API quick test

```bash
npm run efficiency:pipeline
npm run efficiency:summary
curl.exe http://127.0.0.1:8787/api/efficiency/summary
curl.exe http://127.0.0.1:8787/api/efficiency/narrative
```

## Compare modes (talk track)

| Mode | Tokens | Latency | Use case |
|------|--------|---------|----------|
| Demo | 0 | ~500 ms pipeline | Eval harness, judge repeatability, no Wi‑Fi |
| LLM (MiniMax) | ~3 calls / pipeline | 60–120 s | Agentic AI story, richer COMMS-03 prose |

## Rubric mapping

- **Efficiency:** Measured, not claimed — token/latency JSON exportable for mentors.
- **Agentic AI:** Multi-agent orchestration with optional LLM on top of tools, not LLM-only chat.
- **Defensibility:** Small operator SOP corpus + deterministic workflow moat; LLM is replaceable enrichment.
