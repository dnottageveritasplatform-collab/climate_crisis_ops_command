# Backup Offline Demo Video — Day 19

**Purpose:** Judge-ready MP4 if live staging URL or Wi‑Fi fails on demo day.

**Primary script:** `docs/demo-2min-capture.md` (under 2:00)  
**Extended script:** `docs/demo-5min-rehearsal.md` (mentor pitch cut)

---

## Before recording

1. `npm start` locally **or** use staging URL
2. `DEMO_MODE=true` recommended (fast, reliable capture)
3. Clear HITL: refresh page or restart server
4. Tool: OBS, Xbox Game Bar (Win+G), or Loom
5. Resolution: **1920×1080**, H.264, target **≤ 50 MB**

---

## Capture beats (~2:00)

| Time | Show | Must include |
|------|------|----------------|
| 0:00–0:15 | Top bar, scenario strip, alert | "Not 911 CAD · demo data" |
| 0:15–0:35 | **Run Pipeline** | Completes without error |
| 0:35–0:55 | Map | CORR-02, #rank pins, triage sync |
| 0:55–1:15 | Triage + Action tabs | COMMS-03 drafts, checklist |
| 1:15–1:40 | Triple HITL | All three **Approved** |
| 1:40–1:55 | Audit trail | pipeline_run + approvers |
| 1:55–2:00 | Hold released banner | Close line |

---

## File naming

Save as: `docs/demo-backup-capture.mp4` (gitignored if large — attach to logbook submission separately).

Static backup still: `docs/mockups/command-center-llm-mode.jpg`

---

## Pre-flight CLI

```bash
npm run eval:run
npm run deploy:check
curl.exe -X POST http://127.0.0.1:8787/api/orchestrator/run
```

---

## Demo day fallback order

1. **Live staging URL** (preferred)
2. **Localhost** `npm start` on your laptop
3. **Backup MP4** full screen
4. **Still mockup** `command-center-llm-mode.jpg` (last resort)
