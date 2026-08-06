/**
 * Day 14 — Multi-agency demo scenario copy (Nassau metro storm coordination).
 * Single source for UI, HITL personas, and status API narrative.
 */
export const SCENARIO = {
  id: "nassau-metro-storm-demo",
  title: "Tropical Storm Alma — Nassau Metro Multi-Agency Response",
  subtitle: "NEMT operator · Princess Margaret (public) · Doctor's Hospital (private) · corridor coordination",
  serviceArea: "New Providence, Bahamas",
  demoDisclaimer: "Synthetic dispatch & geo · Not 911/CAD replacement · DEMO DATA",
  narrative:
    "Storm watch escalates across New Providence. Nassau Metro NEMT, Princess Margaret Hospital, and Doctor's Hospital share one command surface — agents rank at-risk dialysis trips, draft COMMS-03 bulletins per partner, and stage triple human approval before any send.",
  agencies: [
    {
      id: "nemt",
      name: "Nassau Metro Medical Transport",
      shortName: "Nassau Metro NEMT",
      role: "nemt_operator",
      hitlRole: "nemt_supervisor",
      liaison: "Maria Clarke",
      liaisonTitle: "Dispatch Supervisor",
    },
    {
      id: "pmh",
      name: "Princess Margaret Hospital",
      shortName: "PMH",
      role: "hospital_partner",
      hitlRole: "hospital_liaison_pmh",
      liaison: "James Rolle",
      liaisonTitle: "Transport Coordinator",
    },
    {
      id: "doctors",
      name: "Doctor's Hospital",
      shortName: "Doctor's Hospital",
      role: "hospital_partner_private",
      hitlRole: "hospital_liaison_doctors",
      liaison: "Dr. Elaine Moss",
      liaisonTitle: "Transport Liaison",
    },
  ],
  corridors: [
    {
      id: "CORR-01",
      name: "Paradise Island Bridge approach",
      note: "Regional flood exposure · CLOSED at Level 3",
    },
    {
      id: "CORR-02",
      name: "Eastern Road low segment",
      note: "Washout history · RESTRICTED at Level 2+",
    },
  ],
  institutionalSources: ["UN OCHA Caribbean (demo)", "World Bank GFDRR (demo)"],
};

/** Display name for HITL approver field / audit log. */
export function hitlApproverName(hitlRole) {
  const agency = SCENARIO.agencies.find((a) => a.hitlRole === hitlRole);
  if (!agency) return "Approver (demo)";
  return `${agency.liaison}, ${agency.liaisonTitle} (${agency.shortName} · demo)`;
}

/** One-line scenario strip for command UI. */
export function scenarioStripText() {
  const partners = SCENARIO.agencies
    .filter((a) => a.role !== "nemt_operator")
    .map((a) => a.shortName)
    .join(" + ");
  return `${SCENARIO.serviceArea} · ${SCENARIO.agencies[0].shortName} + ${partners} · ${SCENARIO.corridors.map((c) => c.id).join(" / ")} corridor sync`;
}
