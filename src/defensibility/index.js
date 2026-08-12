/** Day 18 + Phase 2 Day 1 — defensibility narrative, founder credibility, Phase 2 CAD/EMS roadmap. */

export const FOUNDER_CREDIBILITY = {
  headline: "County-scale multi-agency GIS coordination — Broward County IT lineage",
  organization: "Broward County IT (founder experience)",
  context:
    "Part of the team that built GIS tooling helping fire, police, and hospital EMS coordinate after major weather events — the same coordination class as post-storm NEMT + hospital liaison workflows, not 911 call intake.",
  relevance: [
    "Shared situational map + corridor status across agencies",
    "Operator workflows with audit trails, not chatbot-only demos",
    "Caribbean diaspora + Bahamas-rooted scenario for Future Caribbean track",
  ],
  scopeGuard:
    "Sprint demo is NEMT + hospital partners on a thin map layer — explicitly not county CAD or 911 replacement in 21 days.",
};

export const DEFENSIBILITY_PILLARS = [
  {
    id: "workflow",
    title: "Workflow moat",
    detail:
      "Monitor → Triage → Action orchestration with triple HITL (NEMT + two hospital liaisons). Deterministic ranks, map sync, and COMMS-03 staging — LLM enriches prose only.",
  },
  {
    id: "sop",
    title: "Operator SOP corpus",
    detail:
      "Hybrid keyword + TF-IDF semantic RAG over 5 operator SOP files; agents cite sopId/section in audit trail. Templates are starting points — workflow + citations are the defensible layer.",
  },
  {
    id: "audit",
    title: "Audit-first design",
    detail:
      "Every pipeline run logs steps, SOP citations, HITL approvers with timestamps. Judges can inspect JSON trail — not black-box agent output.",
  },
  {
    id: "eval",
    title: "Repeatable eval harness",
    detail:
      "8 scripted storm scenarios (L1–L4) with pass/fail assertions; demo mode runs in <1 s with zero tokens.",
  },
  {
    id: "lineage",
    title: "Founder + platform lineage",
    detail:
      "Broward County IT multi-agency weather GIS experience + KnightRoad Veritas command-center architecture.",
  },
];

export const PHASE2_ROADMAP = {
  headline: "Phase 2 — CAD / EMS / multi-agency integration (post-sprint)",
  horizon: "Post Future Caribbean sprint · pilot with design-partner operator",
  principles: [
    "Read-only situational feeds first — no 911 call-taking in v1",
    "Same command surface; new adapters behind tools API",
    "HITL gates remain mandatory for outbound COMMS",
  ],
  tracks: [
    {
      id: "cad-readonly",
      title: "CAD / dispatch read-only overlay",
      items: [
        "Ingest county CAD or NEMT dispatch exports (CSV/API) as trip + unit status layers",
        "Correlate CCOC at-risk trips with CAD incident IDs for audit cross-reference",
        "Optional ESRI/ArcGIS feature service for corridor closures (replace static GeoJSON)",
      ],
      status: "in_progress",
      day1: {
        complete: true,
        deliverables: [
          "src/cad/ — CSV adapter + webhook ingest stub",
          "data/sample-cad-export.csv — pilot CAD export format",
          "GET /api/cad/* — overlay, summary, cross-ref, map-units",
          "Pipeline audit logs CAD run/incident IDs for at-risk trips",
        ],
      },
      day5: {
        complete: true,
        deliverables: [
          "src/cad/enrichment.js — live CAD run + handoff status on dispatch manifest",
          "GET /api/cad/enriched-dispatch · summarize_dispatch tool enriched",
          "Map at-risk trips show cadRunId + unitStatus · pipeline cad_dispatch_enrich audit",
        ],
      },
      day6: {
        complete: true,
        deliverables: [
          "src/geo/esri.js — ESRI FeatureServer corridor adapter + webhook ingest",
          "data/geo/esri-corridors-demo.json — pilot agency GIS demo layer",
          "GET /api/geo/corridors/esri · get_corridor_layers Monitor tool · pipeline esri_corridor_sync",
        ],
      },
    },
    {
      id: "ems-adjacent",
      title: "EMS-adjacent transport desk",
      items: [
        "Hospital transport liaison desk integrations (bed capacity signals, diversion status)",
        "EMS-to-NEMT handoff queue visibility (scheduled inter-facility, not 911 response)",
        "Shelter and fleet logistics personas (Phase 2 HITL roles)",
      ],
      status: "in_progress",
      day2: {
        complete: true,
        deliverables: [
          "src/transport-desk/ — hospital desk + handoff queue JSON adapters",
          "data/sample-hospital-desk.json · data/sample-ems-handoff-queue.json",
          "GET /api/transport-desk/* — summary, hospitals, handoff-queue, cross-ref",
          "Monitor tool get_transport_desk_status · pipeline handoff audit cross-ref",
        ],
      },
      day4: {
        complete: true,
        deliverables: [
          "src/transport-desk/writeback.js — handoff accept + nemtRunId CAD linkage",
          "POST /api/transport-desk/handoff-accept · patch mode on /ingest",
          "Audit type handoff_writeback — separate from Triple HITL",
          "UI demo accept HO-2201 → RUN-8845 · transport desk strip updates",
        ],
      },
      day7: {
        complete: true,
        deliverables: [
          "src/shelter-fleet/ — shelter capacity + fleet logistics JSON adapter",
          "Extended HITL (5 roles): shelter coordinator + fleet logistics at L2+",
          "GET /api/shelter-fleet/* · pipeline shelter_fleet_cross_ref",
        ],
      },
      day8: {
        complete: true,
        deliverables: [
          "src/audit/store.js — append-only JSONL persistence (data/audit-trail.jsonl)",
          "GET /api/audit/eoc-briefing · GET /api/audit/persist",
          "EOC audit briefing bundle — persisted trail + COP snapshot",
          "Pipeline step audit_persist · Monitor tools get_audit_persist_status / get_eoc_audit_briefing",
        ],
      },
    },
    {
      id: "public-safety-feeds",
      title: "Fire / police situational awareness (read-only)",
      items: [
        "EOC and public-safety unit status feeds onto shared map (no dispatch authority)",
        "Institutional signal adapters (NHC live + UN OCHA / GFDRR overlays — started in sprint)",
        "Common operating picture export for EOC briefings",
      ],
      status: "in_progress",
      day3: {
        complete: true,
        deliverables: [
          "src/public-safety/ — EOC fire/police JSON adapter + webhook ingest stub",
          "data/sample-public-safety-units.json — corridor-assigned demo units",
          "GET /api/public-safety/* — overlay, summary, cross-ref, map-units, cop-export",
          "Monitor tool get_public_safety_status · pipeline EOC corridor audit cross-ref",
        ],
      },
      day9: {
        complete: true,
        deliverables: [
          "src/signals/multi-feed.js — NHC live + institutional overlay merge",
          "data/signals/institutional-feed-demo.json — OCHA/GFDRR/Red Cross demo feeds",
          "GET /api/signals/multi-feed · /cross-ref · /sources · POST /ingest",
          "Pipeline step signal_multi_feed_sync · Monitor tool get_multi_feed_status",
        ],
      },
    },
    {
      id: "operator-corpus",
      title: "Operator SOP corpus + semantic RAG",
      items: [
        "Expand crisis SOP corpus beyond sprint 3-file keyword RAG",
        "Optional hybrid TF-IDF semantic search — no vector DB in pilot window",
        "Scenario cross-ref logs matched SOPs in pipeline audit",
      ],
      status: "in_progress",
      day10: {
        complete: true,
        deliverables: [
          "src/sops/semantic.js · src/sops/corpus.js — hybrid keyword + TF-IDF RAG",
          "data/sops/shelter-coordination.txt · fleet-logistics.txt — 5-file corpus",
          "GET /api/sops/corpus · /cross-ref · /search · pipeline sop_corpus_sync",
          "Monitor tool get_sop_corpus_status · query_sop hybrid mode",
        ],
      },
    },
    {
      id: "routing-gis",
      title: "Deeper GIS routing",
      items: [
        "Turn-by-turn avoidance for restricted corridors when pilot agency provides road network",
        "Flood-depth or wind-exposure overlays when agency GIS available",
        "On-prem / sovereign deploy path (OWC edge angle for Caribbean operators)",
      ],
      status: "in_progress",
      day11: {
        complete: true,
        deliverables: [
          "src/geo/routing.js — corridor-aware routing preview (read-only advisories)",
          "data/geo/routing-alternates-demo.json — Bay Street / Mackey bridge alternates",
          "GET /api/geo/routing/preview · /cross-ref · POST /routing/ingest",
          "Pipeline step routing_preview_sync · Monitor tool get_routing_preview_status",
          "COP + EOC export include routingPreview block",
        ],
      },
    },
  ],
  notInScope: [
    "911 PSAP call intake or municipal CAD replacement",
    "Automated outbound messaging without human approval",
    "Full ESRI Enterprise stack in sprint window",
  ],
};

export function buildDefensibilitySummary() {
  return {
    ok: true,
    phase: "week-3-day-18",
    founder: FOUNDER_CREDIBILITY,
    pillars: DEFENSIBILITY_PILLARS,
    phase2: {
      headline: PHASE2_ROADMAP.headline,
      trackCount: PHASE2_ROADMAP.tracks.length,
      principles: PHASE2_ROADMAP.principles,
    },
    scopeGuard: FOUNDER_CREDIBILITY.scopeGuard,
    docs: {
      slide: "docs/defensibility-slide.md",
      phase2: "docs/phase2-roadmap.md",
    },
  };
}

export function buildDefensibilityNarrative() {
  return {
    headline: "Defensible coordination ops — workflow + SOP moat, not a generic LLM wrapper",
    pitchLine:
      "We built the class of system I helped deliver at Broward County IT after weather events: multi-agency situational awareness with human gates before anything sends. The sprint proves one vertical (NEMT + hospitals); Phase 2 adds CAD read-only and EMS-adjacent feeds without claiming 911 replacement.",
    founder: FOUNDER_CREDIBILITY.headline,
    bullets: [
      ...DEFENSIBILITY_PILLARS.map((p) => `${p.title}: ${p.detail}`),
      `Phase 2: ${PHASE2_ROADMAP.tracks.map((t) => t.title).join(" · ")}.`,
    ],
    rubric: {
      defensibility: "SOP RAG + triple HITL workflow + audit/eval + Broward lineage",
      agenticAI: "Tool-first agents; optional LLM enrichment",
      pmf: "Design-partner NEMT + hospital liaison story; Caribbean operator relevance",
    },
  };
}

export function buildPhase2Roadmap() {
  return {
    ok: true,
    phase: "phase-2-day-11",
    day1Complete: true,
    day2Complete: true,
    day3Complete: true,
    day4Complete: true,
    day5Complete: true,
    day6Complete: true,
    day7Complete: true,
    day8Complete: true,
    day9Complete: true,
    day10Complete: true,
    day11Complete: true,
    ...PHASE2_ROADMAP,
  };
}
