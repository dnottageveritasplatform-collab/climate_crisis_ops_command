/**
 * Build Phase 4 Live Ops sprint roadmap as Word (.docx)
 * Run: node scripts/build-phase4-docx.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "docs", "phase4-live-ops-roadmap.docx");

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 120 } });
}
function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 } });
}
function h3(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 } });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });
}
function bullet(text) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}
function check(text) {
  return bullet(`☐ ${text}`);
}

function table(headers, rows) {
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
        })
    ),
  });
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
              children: [new Paragraph({ text: String(cell) })],
            })
        ),
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

const doc = new Document({
  creator: "Climate & Crisis Ops Command",
  title: "Phase 4 Live Ops Roadmap",
  description: "Sprint plan to make CCOC operational in live environments",
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "Phase 4 Sprint — Live Operations Integration", bold: true, size: 32 })],
        }),
        p("Climate & Crisis Ops Command · Future Caribbean · New Providence pilot"),
        p("Document date: August 15, 2026"),

        h1("Goal"),
        p(
          "CCOC stops being a demo shell and runs on real feeds, real unit locations, real hazard data, and real outbound COMMS — with HITL still gating sends, but sends actually happening after approval."
        ),

        h1("Where You Are Today"),
        p(
          "Phases 2–3b built the coordination workflow (agents, HITL, audit, hazard fusion, map). Almost every external integration follows the same pattern:"
        ),
        table(
          ["Pattern", "What exists", "What's missing"],
          [
            ["Webhook ingest", "Real endpoints (CAD, public safety, flood/wind ingest)", "Operators must push data; no pull/poll adapters for most feeds"],
            ["REST polling", "Env vars declared (CAD_FEED_URL, PUBLIC_SAFETY_URL)", "No fetch code — label only"],
            ["Metadata probe", "GLOFAS CDS + JBA/Fathom verify keys", "No GRIB/vendor forecast download in-app"],
            ["Outbound COMMS", "Draft generation + triple/extended HITL", "No SMS/email gateway — audit says demo: send blocked even after full approval"],
            ["Dispatch manifest", "Hardcoded data/sample-dispatch.csv", "No operator manifest adapter"],
          ]
        ),
        p("NHC weather RSS is the one feed that can already be live (NHC_LIVE=true)."),

        h1("Sprint Principles"),
        bullet("Agency wins — Bahamian EOC/public works flood GIS beats model layers"),
        bullet("HITL mandatory — nothing auto-sends; approval triggers real delivery"),
        bullet("Not 911/CAD replacement — read-only situational + NEMT handoff write-back only"),
        bullet("Design-partner gated — live ops requires operator agreements + API keys before code can be tested end-to-end"),
        bullet("Sovereign path preserved — air-gap bundles still work when outbound APIs are blocked"),

        h2("Parallel Workstream 0 — Credentials & Design Partners"),
        p("Start procurement/onboarding before engineering finishes adapters. These block live testing."),

        h3("Credential acquisition checklist"),
        table(
          ["Credential", "How to get it", "Env var(s)", "Blocks"],
          [
            ["Copernicus CDS / GLOFAS", "Register at cds.climate.copernicus.eu", "GLOFAS_CDS_KEY", "Live river/discharge gap-fill"],
            ["JBA Flood Foresight", "Contact JBA Global Resilience — evaluation for New Providence bbox", "URBAN_FLOOD_API_KEY, URBAN_FLOOD_API_URL", "Live urban pluvial polygons"],
            ["Fathom Global (alternate)", "Commercial email + pilot contract at fathom.global", "Same as JBA with URBAN_FLOOD_VENDOR=fathom", "Urban flood if JBA unavailable"],
            ["Twilio (or carrier)", "Account + SMS number + A2P registration", "TWILIO_* (new)", "Driver SMS after HITL"],
            ["Email provider", "SendGrid / AWS SES / operator SMTP", "COMMS_EMAIL_* (new)", "Hospital COMMS-03 bulletins"],
            ["NEMT dispatch API", "Nassau Metro or pilot NEMT operator", "DISPATCH_FEED_URL (new)", "Live trip manifest"],
            ["CAD / AVL feed", "County CAD vendor or NEMT CAD REST export", "CAD_FEED_URL", "Live unit/run overlay"],
            ["Police/fire AVL", "Royal Bahamas Police / EOC AVL export", "PUBLIC_SAFETY_URL", "Live unit pins on map"],
            ["Agency GIS webhook", "NEMA / public works FeatureServer or push webhook", "FLOOD_DEPTH_PATH + ingest auth", "Authoritative flood depth"],
            ["Wind exposure GIS", "NEMA / NWS wind field or agency polygon export", "WIND_EXPOSURE_PATH + ingest", "Gust-zone trip cross-ref"],
            ["ESRI corridors", "Agency FeatureServer URL", "ESRI_CORRIDOR_URL", "Live corridor status"],
            ["Hospital transport desk", "PMH / Doctor's Hospital EMS liaison API", "TRANSPORT_DESK_URL", "Bed pressure, handoff queue"],
            ["Institutional signals", "OCHA / GFDRR / regional feed", "INSTITUTIONAL_FEED_URL", "Multi-feed monitor brief"],
            ["LLM (optional)", "Groq / OpenAI / Ollama local", "LLM_*", "Richer COMMS prose only"],
          ]
        ),

        h3("Design partner agreements needed"),
        check("NEMT operator — dispatch manifest + driver phone numbers + SMS consent"),
        check("Hospital liaisons — COMMS-03 email recipients + approval workflow"),
        check("EOC / NEMA — agency flood + wind GIS webhook push OR FeatureServer access"),
        check("CAD vendor — read-only REST export spec (runs, units, lat/lon, status)"),
        check("Public safety — read-only unit AVL feed (no dispatch authority in CCOC)"),
        check("JBA or Fathom — New Providence urban core license + API docs"),
        check("Legal — SMS consent, PHI handling, data retention for audit JSONL"),

        h1("Sprint Tracks & Calendar (20 working days)"),
        p("Four parallel tracks. Days are suggested sequencing within each track."),
        table(
          ["Track", "Days", "Focus"],
          [
            ["A — Outbound COMMS", "1–10", "SMS gateway, hospital email, HITL release hook, delivery audit"],
            ["B — Live Dispatch/CAD/Public Safety", "1–12", "Dispatch REST, CAD poller, police AVL, transport desk write-back"],
            ["C — Live Hazard & Weather", "1–14", "Agency flood/wind, GLOFAS GRIB worker, JBA fetch, ESRI corridors, multi-feed signals"],
            ["D — Production Hardening", "1–15", "Webhook auth, cron/schedulers, live deploy profile, acceptance tests"],
          ]
        ),

        h1("Track A — Outbound COMMS (Days 1–10)"),
        p("Current: src/agents/action/pack.js generates COMMS-03 bulletins + driver SMS drafts. src/hitl/index.js approves but records demo: send blocked."),

        h3("Day 1–2: COMMS transport layer (new module src/comms/)"),
        table(
          ["Provider", "Use case", "Suggested env"],
          [
            ["Twilio SMS", "Driver reroute / delay notices", "COMMS_SMS_PROVIDER=twilio, TWILIO_*"],
            ["SendGrid / SES", "Hospital COMMS-03 bulletins", "COMMS_EMAIL_PROVIDER, COMMS_EMAIL_FROM"],
            ["Webhook fallback", "Operator-owned gateway", "COMMS_WEBHOOK_URL"],
          ]
        ),
        bullet("sendDriverSms({ to, body, packId, tripId }) with delivery receipt"),
        bullet("sendHospitalBulletin({ to, subject, body, hospitalId, packId })"),
        bullet("Idempotency key per HITL release (no double-send on retry)"),
        bullet("Scope guard: refuse send if draftOnly: true or HITL incomplete"),

        h3("Day 3: HITL release → send hook"),
        bullet("On final approval: set draftOnly: false, call src/comms/dispatch.js"),
        bullet("Audit: comms_sent with provider message IDs (replace demo: send blocked)"),
        bullet("UI: remove DEMO send banner; show delivery status per bulletin/SMS"),

        h3("Day 4–5: Recipient resolution"),
        bullet("Map trips → driver phone from live dispatch manifest"),
        bullet("Map hospitals → liaison email from operator config"),
        bullet("Validate E.164 phone format; block send if missing consent flag"),

        h3("Day 6–7: Delivery audit + operator controls"),
        bullet("GET /api/comms/status — last sends, failures, retries"),
        bullet("POST /api/comms/retry/{messageId} — operator retry"),
        bullet("Kill switch: COMMS_SEND_ENABLED=false (default in dev; true only in production)"),

        h3("Day 8–10: End-to-end COMMS acceptance"),
        check("Pipeline → HITL triple approve → SMS arrives on test phone"),
        check("COMMS-03 email arrives at hospital liaison inbox"),
        check("Failed send surfaces in UI + audit without silent drop"),
        check("Extended HITL (5-role) path also triggers send"),
        check("Runbook: never auto-send from model_estimated zones alone"),

        h1("Track B — Live Dispatch, CAD & Public Safety (Days 1–12)"),
        p("Current: Static CSV/JSON samples. Webhooks work but nothing polls REST feeds."),

        h3("Day 1–3: Live dispatch manifest adapter"),
        bullet("New src/dispatch/adapters/rest.js"),
        bullet("Env: DISPATCH_FEED_URL, DISPATCH_FEED_POLL_MS, DISPATCH_API_KEY"),
        bullet("Normalize operator JSON/CSV → existing trip schema"),
        bullet("Acceptance: At-risk trip count changes when operator updates manifest"),

        h3("Day 4–7: CAD REST poller"),
        bullet("New src/cad/adapters/rest.js (CAD_FEED_URL already declared but unimplemented)"),
        bullet("Poll runs, units, lat/lon, status, incident/run IDs"),
        bullet("Acceptance: Unit pin moves on map when CAD status changes"),

        h3("Day 8–10: Police/fire AVL poller"),
        bullet("New src/public-safety/adapters/rest.js"),
        bullet("Env: PUBLIC_SAFETY_URL, PUBLIC_SAFETY_POLL_MS, auth headers"),
        bullet("Acceptance: Police unit location on map matches AVL feed within poll interval"),

        h3("Day 11–12: Transport desk + NEMT write-back"),
        bullet("Implement TRANSPORT_DESK_URL REST poller"),
        bullet("Upgrade write-back to real CAD assignment API when NEMT_WRITEBACK_URL configured"),
        bullet("Acceptance: Handoff accept updates operator CAD run ID"),

        h1("Track C — Live Hazard & Weather Data (Days 1–14)"),

        h3("Day 1–2: Agency flood + wind live operations"),
        bullet("Webhook ingest already built at POST /api/geo/hazards/flood/ingest and /wind/ingest"),
        bullet("Operator runbook for NEMA/public works push cadence"),
        bullet("Webhook authentication; stale detection alerts"),
        bullet("Acceptance: Agency flood polygons from live push; agency_confirmed confidence"),

        h3("Day 3–8: GLOFAS live GRIB pipeline"),
        bullet("Complete Python sidecar: CDS retrieve → NetCDF/GRIB → discharge grid JSON"),
        bullet("Cron: npm run geo:glofas-fetch every 6–12h at L2+"),
        bullet("Node convert: grid → glofas-nassau-latest.json"),
        bullet("Credentials: GLOFAS_CDS_KEY (see docs/glofas-cds-setup.md)"),
        bullet("Acceptance: Fresh clip without demo fallback; stale warning clears after fetch"),

        h3("Day 3–7: JBA / Fathom live forecast download"),
        bullet("Implement vendor-specific forecast fetch once JBA provides API URL + key"),
        bullet("Download depth grid → urban-flood-grid-*.json → convert via urban-flood-convert.js"),
        bullet("See docs/urban-flood-vendor-setup.md"),
        bullet("Acceptance: URBAN_FLOOD_VENDOR=jba + live key → commercial_model zones without demo clip"),

        h3("Day 9–10: Wind exposure from operational source"),
        bullet("Agency wind polygon webhook, NWS/NHC wind field worker, or manual EOC push"),
        bullet("Acceptance: Gust-zone trip exposure updates when NHC escalates to L3+"),

        h3("Day 11–12: ESRI FeatureServer live pull"),
        bullet("Implement ESRI_CORRIDOR_URL fetch in src/geo/esri.js"),
        bullet("Corridor CLOSED/RESTRICTED status drives triage reasons"),

        h3("Day 13–14: Multi-feed signals"),
        bullet("Wire INSTITUTIONAL_FEED_URL REST adapter"),
        bullet("Monitor brief cites live OCHA/GFDRR when available"),

        h1("Track D — Production Hardening (Days 1–15)"),

        h3("Day 1–3: Security"),
        bullet("Webhook HMAC signing: X-CCOC-Signature with WEBHOOK_SECRET"),
        bullet("API key for ingest endpoints: INGEST_API_KEY"),
        bullet("Role-based HITL auth (operator tokens per role)"),
        bullet("Secrets via env only — never commit"),

        h3("Day 4–7: Schedulers & health"),
        bullet("Cron/systemd timers for GLOFAS, urban flood, CAD/dispatch poll, signal refresh"),
        bullet("GET /api/health/live — per-feed freshness"),
        bullet("Alert when any critical feed stale beyond threshold at L2+"),
        bullet("Document in docs/live-ops-runbook.md"),

        h3("Day 8–10: Production deploy profile"),
        p("Extend src/deploy/sovereign.js → src/deploy/live.js with checks:"),
        table(
          ["Check", "Pass criteria"],
          [
            ["COMMS provider configured", "Twilio/email probe succeeds"],
            ["Dispatch feed", "Last poll < 5 min"],
            ["CAD feed", "Units > 0 or explicit empty OK"],
            ["Agency flood", "Webhook received in last 24h OR stale alert acknowledged"],
            ["GLOFAS / urban", "Live fetch OR air-gap clip < stale hours"],
            ["HITL", "Send enabled only when COMMS_SEND_ENABLED=true"],
            ["Audit", "AUDIT_PERSIST=true"],
          ]
        ),

        h3("Day 11–15: Live acceptance test suite"),
        check("Live NHC escalation triggers L2 pipeline"),
        check("Live dispatch trip appears in triage rank"),
        check("CAD unit cross-ref matches run ID"),
        check("Agency flood suppresses GLOFAS on overlap"),
        check("HITL approve → SMS delivery receipt in audit"),
        check("Feed failure → graceful degrade + operator alert (no crash)"),

        h1("Master .env Additions (Phase 4)"),
        p("Add to .env.example when implementing:"),
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: [
                "# --- Phase 4 Live Ops ---",
                "COMMS_SEND_ENABLED=false",
                "COMMS_SMS_PROVIDER=twilio",
                "TWILIO_ACCOUNT_SID=",
                "TWILIO_AUTH_TOKEN=",
                "TWILIO_FROM_NUMBER=",
                "COMMS_EMAIL_PROVIDER=sendgrid",
                "COMMS_EMAIL_FROM=",
                "SENDGRID_API_KEY=",
                "COMMS_WEBHOOK_URL=",
                "DISPATCH_FEED_URL=",
                "DISPATCH_FEED_POLL_MS=60000",
                "DISPATCH_API_KEY=",
                "CAD_FEED_POLL_MS=30000",
                "CAD_API_KEY=",
                "PUBLIC_SAFETY_POLL_MS=30000",
                "PUBLIC_SAFETY_API_KEY=",
                "TRANSPORT_DESK_POLL_MS=120000",
                "NEMT_WRITEBACK_URL=",
                "WEBHOOK_SECRET=",
                "INGEST_API_KEY=",
                "OPERATOR_CONFIG_PATH=data/operators/nassau-metro.json",
              ].join("\n"),
              font: "Consolas",
              size: 20,
            }),
          ],
        }),
        p("Existing GLOFAS/JBA vars from .env.example lines 83–118 remain required for hazard layers."),

        h1("Definition of Done — Actually Works"),
        p("The sprint is complete when an operator can run this live drill without demo data:"),
        bullet("Storm escalates — NHC live feed (or operator inject) → L2+"),
        bullet("Real trips load — dispatch manifest from NEMT operator API"),
        bullet("Map is live — CAD units + police AVL + agency flood + (GLOFAS or JBA) merged"),
        bullet("Agents run — Monitor brief cites live feeds; Triage ranks real at-risk trips; Action drafts COMMS-03 + SMS"),
        bullet("HITL approves — NEMT supervisor + hospital liaisons sign off"),
        bullet("Messages send — Driver SMS delivered; hospital email delivered; audit records provider IDs"),
        bullet("No silent failures — stale feed alerts visible; degraded mode documented"),
        bullet("Sovereign still works — air-gap profile passes deploy check without outbound APIs"),

        h1("Risk Register"),
        table(
          ["Risk", "Mitigation"],
          [
            ["JBA API URL not public — design-partner only", "Start JBA contact Day 0; use Fathom alternate or licensed GeoJSON export + webhook ingest"],
            ["CAD vendor won't expose REST", "CSV drop folder watcher or webhook push from operator middleware"],
            ["SMS regulatory (consent, A2P)", "Legal review Day 0; test with operator-owned numbers first"],
            ["GLOFAS GRIB processing heavy", "Python sidecar on connected staging; sovereign uses pre-download clip"],
            ["Scope creep into 911/CAD replacement", "Keep scope guards; write-back limited to NEMT handoff accept"],
          ]
        ),

        h1("Recommended Sequencing (small team)"),
        h3("Week 1 (unblock visible value)"),
        bullet("Credentials procurement (parallel)"),
        bullet("Dispatch REST adapter"),
        bullet("CAD REST poller"),
        bullet("COMMS transport + HITL release hook"),

        h3("Week 2 (hazard truth)"),
        bullet("Agency flood/wind webhook ops + auth"),
        bullet("GLOFAS GRIB worker"),
        bullet("JBA fetch (when key arrives)"),

        h3("Week 3 (complete picture)"),
        bullet("Police AVL poller"),
        bullet("ESRI live corridors"),
        bullet("Production hardening + live acceptance tests"),

        h1("Files You'll Touch (engineering map)"),
        table(
          ["Area", "Existing", "New / extend"],
          [
            ["COMMS send", "src/hitl/index.js, src/agents/action/pack.js", "src/comms/*, src/routes/comms.js"],
            ["Dispatch", "src/dispatch/index.js", "src/dispatch/adapters/rest.js"],
            ["CAD", "src/cad/index.js, adapters/csv.js", "src/cad/adapters/rest.js"],
            ["Police", "src/public-safety/index.js", "src/public-safety/adapters/rest.js"],
            ["GLOFAS", "src/geo/glofas-cds.js, scripts/glofas-grid-from-nc.py", "Complete Python worker + cron"],
            ["Urban flood", "src/geo/urban-flood-vendor.js", "Vendor forecast download"],
            ["ESRI", "src/geo/esri.js", "FeatureServer fetch"],
            ["Security", "src/server.js", "Webhook auth middleware"],
            ["Deploy", "src/deploy/sovereign.js", "src/deploy/live.js"],
            ["Docs", "existing setup docs", "docs/live-ops-runbook.md"],
            ["Tests", "tests/*", "tests/live-comms.test.mjs, feed poller tests"],
          ]
        ),

        h1("Summary"),
        p(
          "Phases 2–3b built the command surface; Phase 4 wires the pipes and turns HITL approval into real-world action. This sprint closes the gap between production-shaped demo and production-operational."
        ),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
