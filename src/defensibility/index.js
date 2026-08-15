/** Phase 2 Day 18 — defensibility narrative, founder credibility, Phase 2 sprint close-out pitch. */

import { getLastEvalRun, loadScenarios } from "../eval/index.js";
import { buildEfficiencySummary } from "../efficiency/index.js";

export const DEFENSIBILITY_SCOPE_GUARD =
  "Defensibility pitch — workflow + SOP + audit moat narrative; not dispatch authority.";

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
    "Sprint + Phase 2 demo is NEMT + hospital partners on a thin map layer — explicitly not county CAD or 911 replacement in 21 days.",
};

export const DEFENSIBILITY_PILLARS = [
  {
    id: "workflow",
    title: "Workflow moat",
    detail:
      "Monitor → Triage → Action orchestration with extended HITL (5 roles at L2+). Deterministic ranks, map sync, hazard fusion, and COMMS-03 staging — LLM enriches prose only.",
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
      "Append-only JSONL audit persists across restart. Every pipeline run logs Phase 2 sync steps, SOP citations, HITL approvers with timestamps — EOC briefing export ready.",
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
  {
    id: "glofas_gap_fill",
    title: "GloFAS gap-fill discipline (Phase 3)",
    detail:
      "Agency-first merge with labeled model_estimated zones, Alma/Dorian validation gate, sovereign air-gap bundle, and operator runbook — gap-fill not replacement hydrology.",
  },
];

export const PHASE2_ROADMAP = {
  headline: "Phase 2 complete — CAD / EMS / multi-agency integration (Days 1–17)",
  horizon: "Future Caribbean sprint · 17 days delivered · pilot with design-partner operator next",
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
        "Flood-depth and wind-exposure overlays when agency GIS available",
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
      day12: {
        complete: true,
        deliverables: [
          "src/geo/hazards.js — flood-depth hazard GIS overlay (read-only polygons)",
          "data/geo/flood-depth-demo.json — Eastern Road / Bay Street / Paradise Island zones",
          "GET /api/geo/hazards/flood · /cross-ref · POST /hazards/flood/ingest",
          "Pipeline step flood_hazard_sync · Monitor tool get_flood_hazard_status",
          "Command map flood polygon underlay + COP/EOC export floodHazard block",
        ],
      },
      day13: {
        complete: true,
        deliverables: [
          "src/geo/wind.js — wind-exposure hazard GIS overlay (read-only gust polygons)",
          "data/geo/wind-exposure-demo.json — Paradise Island / Eastern Road / Carmichael zones",
          "GET /api/geo/hazards/wind · /cross-ref · POST /hazards/wind/ingest",
          "Pipeline step wind_hazard_sync · Monitor tool get_wind_hazard_status",
          "Command map wind polygon underlay + COP/EOC export windHazard block",
        ],
      },
      day14: {
        complete: true,
        deliverables: [
          "src/geo/multi-hazard.js — fused flood + wind + routing per-trip EOC briefing",
          "GET /api/geo/hazards/combined · /cross-ref",
          "Pipeline step multi_hazard_sync · Monitor tool get_multi_hazard_status",
          "COP + EOC export include multiHazard block · fused trip briefing strip",
        ],
      },
      day15: {
        complete: true,
        deliverables: [
          "src/deploy/sovereign.js — on-prem data residency deploy profile + readiness checks",
          ".env.sovereign.example · docker-compose.sovereign.yml · docs/sovereign-deploy.md",
          "GET /api/deploy/sovereign · /sovereign/checklist",
          "Pipeline step sovereign_deploy_sync · Monitor tool get_sovereign_deploy_status",
          "Command UI sovereign deploy strip",
        ],
      },
      day16: {
        complete: true,
        deliverables: [
          "src/geo/road-network.js — pilot road graph + turn-by-turn corridor avoidance",
          "data/geo/road-network-demo.json — Nassau Metro demo nodes/edges + trip anchors",
          "GET /api/geo/routing/network · /cross-ref · POST /routing/network/ingest",
          "Pipeline step road_network_sync · Monitor tool get_road_network_status",
          "COP + EOC export include roadNetwork block · turn-by-turn nested in Hazard fusion UI + driver SMS drafts",
        ],
      },
      day17: {
        complete: true,
        deliverables: [
          "src/demo/rehearsal.js — 5-min pitch beat sheet with live eval + efficiency stats",
          "GET /api/demo/rehearsal · npm run demo:rehearsal · npm run demo:preflight",
          "Pipeline step demo_rehearsal_sync · Monitor tool get_demo_rehearsal_status",
          "Command UI demo rehearsal strip · COP + EOC export include demoRehearsal block",
          "docs/demo-5min-rehearsal.md — Phase 2 sprint capstone pitch script",
        ],
      },
    },
  ],
  day18: {
    complete: true,
    deliverables: [
      "src/defensibility/index.js — pitch slide builder + live eval/pillar stats",
      "GET /api/defensibility/summary · /narrative · /phase2 · /pitch",
      "Pipeline step defensibility_sync · Monitor tool get_defensibility_status",
      "Command UI defensibility strip · COP + EOC export include defensibility block",
      "docs/defensibility-slide.md — Broward credibility + five pillars paste-ready",
    ],
  },
  notInScope: [
    "911 PSAP call intake or municipal CAD replacement",
    "Automated outbound messaging without human approval",
    "Full ESRI Enterprise stack in sprint window",
  ],
};

export const FLOOD_STACK_DEFENSIBILITY = {
  headline: "Three-layer honest flood stack — agency · GloFAS · commercial urban",
  phase3bDaysDelivered: 10,
  scopeGuard:
    "CCOC merges agency GIS, licensed commercial urban pluvial, and Copernicus GloFAS as honestly labeled guidance layers — not replacement hydrology or NEMA authority.",
  proof: [
    "Agency wins on corridor overlap — three-way merge agency_wins_then_commercial_then_glofas",
    "Map styling: solid agency · dashed GloFAS · dotted violet commercial",
    "Dorian FLOOD-04 validation gate urban_layer_acceptable before commercial merge",
    "Extended HITL mandatory — no auto-COMMS from model or commercial zones alone",
    "Sovereign air-gap bundles for glofas + urban offline edge hosts",
    "8-rule flood stack runbook documents when to trust each layer",
  ],
  docs: "docs/flood-stack-runbook.md",
};

export const GLOFAS_DEFENSIBILITY = {
  headline: "Agency-first flood gap-fill — model guidance, not hydrology authority",
  phase3DaysDelivered: 10,
  scopeGuard:
    "GloFAS integrates Copernicus EWDS as labeled gap-fill when Bahamian agency GIS is missing or stale — CCOC does not claim it replaces field hydrology or NEMA authority.",
  proof: [
    "Agency wins on corridor overlap — merge rule agency_wins_corridor",
    "Dashed map styling + model_estimated confidence on every GloFAS zone",
    "Extended HITL mandatory — no auto-COMMS from model zones alone",
    "Alma/Dorian validation gate with urban pluvial caveat documented",
    "Sovereign air-gap pre-download bundle for offline edge hosts",
    "Operator runbook: 6-rule trust matrix when to wait for agency",
  ],
  docs: "docs/glofas-pilot-runbook.md",
};

function liveProofStats() {
  const evalRun = getLastEvalRun();
  const scenarios = loadScenarios();
  const efficiency = buildEfficiencySummary();
  const lastPipeline = efficiency.lastPipelineMetrics || efficiency.lastPipeline;
  return {
    evalTotal: evalRun?.summary?.total ?? scenarios.length,
    evalPassed: evalRun?.summary?.passed ?? null,
    evalSuiteMs: evalRun?.totalLatencyMs ?? null,
    evalOk: evalRun?.ok ?? null,
    lastPipelineMs: lastPipeline?.totalLatencyMs ?? null,
    lastPipelineTokens: lastPipeline?.totalTokens ?? null,
    pillarCount: DEFENSIBILITY_PILLARS.length,
    phase2TrackCount: PHASE2_ROADMAP.tracks.length,
    phase2DaysDelivered: 17,
    phase3DaysDelivered: GLOFAS_DEFENSIBILITY.phase3DaysDelivered,
  };
}

export function buildDefensibilitySummary() {
  const proof = liveProofStats();
  return {
    ok: true,
    phase: "phase-3b-day-10",
    founder: FOUNDER_CREDIBILITY,
    pillars: DEFENSIBILITY_PILLARS,
    glofas: GLOFAS_DEFENSIBILITY,
    floodStack: FLOOD_STACK_DEFENSIBILITY,
    phase2: {
      headline: PHASE2_ROADMAP.headline,
      trackCount: PHASE2_ROADMAP.tracks.length,
      principles: PHASE2_ROADMAP.principles,
      daysDelivered: proof.phase2DaysDelivered,
      complete: true,
    },
    proof,
    scopeGuard: FOUNDER_CREDIBILITY.scopeGuard,
    docs: {
      slide: "docs/defensibility-slide.md",
      phase2: "docs/phase2-roadmap.md",
      glofasRunbook: GLOFAS_DEFENSIBILITY.docs,
      floodStackRunbook: FLOOD_STACK_DEFENSIBILITY.docs,
    },
  };
}

export function buildDefensibilityNarrative() {
  const proof = liveProofStats();
  const evalLine =
    proof.evalPassed != null
      ? `${proof.evalPassed}/${proof.evalTotal} eval scenarios pass`
      : "8 scripted eval scenarios";
  return {
    headline: "Defensible coordination ops — workflow + SOP moat, not a generic LLM wrapper",
    pitchLine:
      "We built the class of system I helped deliver at Broward County IT after weather events: multi-agency situational awareness with human gates before anything sends. Phase 2 delivered 17 days of CAD read-only, EMS-adjacent, EOC, and GIS routing adapters — without claiming 911 replacement.",
    founder: FOUNDER_CREDIBILITY.headline,
    bullets: [
      ...DEFENSIBILITY_PILLARS.map((p) => `${p.title}: ${p.detail}`),
      `Phase 2 (${proof.phase2DaysDelivered} days): ${PHASE2_ROADMAP.tracks.map((t) => t.title).join(" · ")}.`,
      `Phase 3 GloFAS (${proof.phase3DaysDelivered} days): ${GLOFAS_DEFENSIBILITY.headline}.`,
      `Phase 3b flood stack (${FLOOD_STACK_DEFENSIBILITY.phase3bDaysDelivered} days): ${FLOOD_STACK_DEFENSIBILITY.headline}.`,
      `Proof: ${evalLine}${proof.evalSuiteMs ? ` in ${proof.evalSuiteMs} ms` : ""}.`,
    ],
    rubric: {
      defensibility: "SOP RAG + extended HITL workflow + persisted audit/eval + Broward lineage",
      agenticAI: "Tool-first agents; optional LLM enrichment",
      pmf: "Design-partner NEMT + hospital liaison story; Caribbean operator relevance",
    },
    proof,
  };
}

export function buildDefensibilityPitch() {
  const proof = liveProofStats();
  const evalProof =
    proof.evalPassed != null
      ? `${proof.evalPassed}/${proof.evalTotal} scripted scenarios · ${proof.evalSuiteMs ?? "—"} ms suite`
      : "Run npm run eval:run — 8 scripted scenarios L1–L4";

  const slides = [
    {
      id: "founder",
      title: "Founder credibility — Broward County IT",
      headline: "Built this class of problem before — county-scale multi-agency weather coordination",
      bullets: FOUNDER_CREDIBILITY.relevance,
      scopeGuard: FOUNDER_CREDIBILITY.scopeGuard,
    },
    {
      id: "defensibility",
      title: "Defensibility — why this is hard to copy",
      headline: "Workflow + operator corpus + audit — not a chatbot skin",
      pillars: DEFENSIBILITY_PILLARS.map((p) => ({ title: p.title, detail: p.detail })),
      oneLiner:
        "Competitors can copy prompts. They can't copy multi-agency approval workflow + cited SOP ops + eval-gated pipeline without rebuilding operator trust.",
    },
    {
      id: "phase2",
      title: "Phase 2 delivered — same surface, new adapters",
      headline: PHASE2_ROADMAP.headline,
      tracks: PHASE2_ROADMAP.tracks.map((t) => t.title),
      principles: PHASE2_ROADMAP.principles,
      notInScope: PHASE2_ROADMAP.notInScope,
    },
    {
      id: "glofas",
      title: "Phase 3 GloFAS — gap-fill not replacement",
      headline: GLOFAS_DEFENSIBILITY.headline,
      bullets: GLOFAS_DEFENSIBILITY.proof,
      scopeGuard: GLOFAS_DEFENSIBILITY.scopeGuard,
    },
    {
      id: "flood-stack",
      title: "Phase 3b — three-layer honest flood stack",
      headline: FLOOD_STACK_DEFENSIBILITY.headline,
      bullets: FLOOD_STACK_DEFENSIBILITY.proof,
      scopeGuard: FLOOD_STACK_DEFENSIBILITY.scopeGuard,
    },
    {
      id: "proof",
      title: "Measured proof",
      headline: evalProof,
      metrics: {
        pillars: proof.pillarCount,
        phase2Tracks: proof.phase2TrackCount,
        phase2Days: proof.phase2DaysDelivered,
        lastPipelineMs: proof.lastPipelineMs,
        lastPipelineTokens: proof.lastPipelineTokens,
      },
    },
  ];

  return {
    ok: true,
    phase: "phase-3-day-10",
    title: "Climate & Crisis Ops Command — defensibility pitch (slides 7–8)",
    slides,
    talkTrack30s:
      "I helped build multi-agency GIS coordination at Broward County IT after weather events. CCOC applies that pattern to Caribbean NEMT and hospital partners: agents orchestrate, humans approve, audit captures everything. Phase 2 added CAD read-only, transport desk, EOC feeds, hazard fusion, and sovereign deploy. Phase 3 adds honest GloFAS gap-fill — agency-first, labeled model zones, operator runbook — not claiming Copernicus replaces Bahamian hydrology. Defensibility is the workflow and SOP moat, not the LLM.",
    scopeGuard: DEFENSIBILITY_SCOPE_GUARD,
    docs: ["docs/defensibility-slide.md", "docs/phase2-roadmap.md"],
    api: {
      summary: "/api/defensibility/summary",
      narrative: "/api/defensibility/narrative",
      phase2: "/api/defensibility/phase2",
      pitch: "/api/defensibility/pitch",
    },
  };
}

export function formatDefensibilityPitchText(pitch = buildDefensibilityPitch()) {
  const lines = [pitch.title, `Phase: ${pitch.phase}`, "", pitch.talkTrack30s, ""];

  for (const slide of pitch.slides) {
    lines.push(`## ${slide.title}`);
    lines.push(slide.headline);
    if (slide.bullets) slide.bullets.forEach((b) => lines.push(`- ${b}`));
    if (slide.pillars) slide.pillars.forEach((p) => lines.push(`- ${p.title}: ${p.detail}`));
    if (slide.tracks) slide.tracks.forEach((t) => lines.push(`- ${t}`));
    if (slide.oneLiner) lines.push(`> ${slide.oneLiner}`);
    if (slide.scopeGuard) lines.push(`Scope: ${slide.scopeGuard}`);
    lines.push("");
  }

  return lines.join("\n");
}

/** Compact status for Monitor agent tool + pipeline audit (Phase 2 Day 18). */
export function getDefensibilityStatus() {
  const summary = buildDefensibilitySummary();
  const pitch = buildDefensibilityPitch();
  return {
    ok: true,
    phase: "phase-3b-day-10",
    pillarCount: summary.proof.pillarCount,
    phase2TrackCount: summary.proof.phase2TrackCount,
    phase2DaysDelivered: summary.proof.phase2DaysDelivered,
    phase3DaysDelivered: summary.proof.phase3DaysDelivered,
    phase3bDaysDelivered: FLOOD_STACK_DEFENSIBILITY.phase3bDaysDelivered,
    phase2Complete: true,
    phase3bComplete: true,
    evalPassed: summary.proof.evalPassed,
    evalTotal: summary.proof.evalTotal,
    evalSuiteMs: summary.proof.evalSuiteMs,
    evalOk: summary.proof.evalOk,
    slideCount: pitch.slides.length,
    founder: FOUNDER_CREDIBILITY.organization,
    scopeGuard: DEFENSIBILITY_SCOPE_GUARD,
    glofasHeadline: GLOFAS_DEFENSIBILITY.headline,
    floodStackHeadline: FLOOD_STACK_DEFENSIBILITY.headline,
    summary: `${summary.proof.pillarCount} pillars · Phase 2 ${summary.proof.phase2DaysDelivered}d · Phase 3 GloFAS ${summary.proof.phase3DaysDelivered}d · Phase 3b flood stack ${FLOOD_STACK_DEFENSIBILITY.phase3bDaysDelivered}d · ${summary.proof.evalPassed ?? "?"}/${summary.proof.evalTotal} eval`,
    docs: summary.docs,
    api: pitch.api,
  };
}


export function buildPhase2Roadmap() {
  return {
    ok: true,
    phase: "phase-2-day-18",
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
    day12Complete: true,
    day13Complete: true,
    day14Complete: true,
    day15Complete: true,
    day16Complete: true,
    day17Complete: true,
    day18Complete: true,
    phase2Complete: true,
    ...PHASE2_ROADMAP,
  };
}
