/** Day 18 — defensibility narrative, founder credibility, Phase 2 CAD/EMS roadmap. */

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
      "Keyword RAG over 3 crisis SOP files; agents cite sopId/section in audit trail. Templates are starting points — workflow + citations are the defensible layer.",
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
      status: "planned",
    },
    {
      id: "ems-adjacent",
      title: "EMS-adjacent transport desk",
      items: [
        "Hospital transport liaison desk integrations (bed capacity signals, diversion status)",
        "EMS-to-NEMT handoff queue visibility (scheduled inter-facility, not 911 response)",
        "Shelter and fleet logistics personas (Phase 2 HITL roles)",
      ],
      status: "planned",
    },
    {
      id: "public-safety-feeds",
      title: "Fire / police situational awareness (read-only)",
      items: [
        "EOC and public-safety unit status feeds onto shared map (no dispatch authority)",
        "Institutional signal adapters (NHC live + UN OCHA / GFDRR overlays — started in sprint)",
        "Common operating picture export for EOC briefings",
      ],
      status: "planned",
    },
    {
      id: "routing-gis",
      title: "Deeper GIS routing",
      items: [
        "Turn-by-turn avoidance for restricted corridors when pilot agency provides road network",
        "Flood-depth or wind-exposure overlays when agency GIS available",
        "On-prem / sovereign deploy path (OWC edge angle for Caribbean operators)",
      ],
      status: "research",
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
    phase: "week-3-day-18",
    ...PHASE2_ROADMAP,
  };
}
