/** Phase 2 Day 14 — fused flood + wind + routing advisory for at-risk trips. */

import { getAtRiskTrips } from "../dispatch/index.js";
import { buildFloodHazardCrossRef } from "./hazards.js";
import { buildWindHazardCrossRef } from "./wind.js";
import { buildRoutingPreviewCrossRef } from "./routing.js";
import { buildRoadNetworkCrossRef } from "./road-network.js";

export const MULTI_HAZARD_SCOPE_GUARD =
  "Combined hazard + routing advisory with nested turn-by-turn avoidance — read-only fused briefing for EOC/COP and HITL-gated driver drafts; not navigation authority.";

function zoneForCorridor(zoneMatches, corridor) {
  return (zoneMatches || []).find((z) => (z.linkedCorridors || []).includes(corridor));
}

function compositeRisk(hazardCount, hasRouting) {
  const score = hazardCount + (hasRouting ? 1 : 0);
  if (score >= 3) return "critical";
  if (score >= 2) return "high";
  return "elevated";
}

function briefingLine(trip, hazardTypes, routing) {
  const hazards = hazardTypes.length ? hazardTypes.join("+") : "corridor";
  const alt = routing?.alternateName ? ` · alt: ${routing.alternateName}` : "";
  return `${trip.id} ${trip.priority} · ${trip.corridor} · ${hazards}${alt}`;
}

/** Fuse flood, wind, and routing layers into per-trip EOC briefing chips. */
export function buildMultiHazardCrossRef(level = 2) {
  const flood = buildFloodHazardCrossRef(level);
  const wind = buildWindHazardCrossRef(level);
  const routing = buildRoutingPreviewCrossRef(level);
  const roadNetwork = buildRoadNetworkCrossRef(level);
  const atRisk = getAtRiskTrips(level);

  const floodTripIds = new Set((flood.tripExposures || []).map((t) => t.tripId));
  const windTripIds = new Set((wind.tripExposures || []).map((t) => t.tripId));
  const routingByTrip = Object.fromEntries(
    (routing.tripAdvisories || []).map((a) => [a.tripId, a])
  );
  const avoidanceByTrip = Object.fromEntries(
    (roadNetwork.tripAvoidanceRoutes || []).map((r) => [r.tripId, r])
  );

  const tripBriefings = atRisk
    .map((trip) => {
      const hazardTypes = [];
      if (floodTripIds.has(trip.id)) hazardTypes.push("flood");
      if (windTripIds.has(trip.id)) hazardTypes.push("wind");
      const routingAdvisory = routingByTrip[trip.id] || null;
      if (!hazardTypes.length && !routingAdvisory) return null;

      const floodZone = zoneForCorridor(flood.zoneMatches, trip.corridor);
      const windZone = zoneForCorridor(wind.zoneMatches, trip.corridor);

      return {
        tripId: trip.id,
        priority: trip.priority,
        pickup: trip.pickup,
        facility: trip.facility,
        corridor: trip.corridor,
        hazardTypes,
        compositeRisk: compositeRisk(hazardTypes.length, Boolean(routingAdvisory)),
        floodExposure: floodTripIds.has(trip.id)
          ? {
              zoneId: floodZone?.zoneId,
              depthBand: floodZone?.depthBand,
              depthInches: floodZone?.depthInches,
            }
          : null,
        windExposure: windTripIds.has(trip.id)
          ? {
              zoneId: windZone?.zoneId,
              gustMph: windZone?.gustMph,
              windBand: windZone?.windBand,
            }
          : null,
        routingAdvisory: routingAdvisory
          ? {
              alternateRouteId: routingAdvisory.alternateRouteId,
              alternateName: routingAdvisory.alternateName,
              advisory: routingAdvisory.advisory,
              corridorStatus: routingAdvisory.corridorStatus,
              sopRef: routingAdvisory.sopRef,
            }
          : null,
        avoidanceRoute: avoidanceByTrip[trip.id]
          ? {
              stepCount: avoidanceByTrip[trip.id].stepCount,
              totalDistanceM: avoidanceByTrip[trip.id].totalDistanceM,
              turnByTurn: avoidanceByTrip[trip.id].turnByTurn,
              steps: avoidanceByTrip[trip.id].steps?.map((s) => ({
                streetName: s.streetName,
                instruction: s.instruction,
                distanceM: s.distanceM,
              })),
              briefingLine: avoidanceByTrip[trip.id].briefingLine,
              corridorStatus: avoidanceByTrip[trip.id].corridorStatus,
            }
          : null,
        briefingLine: briefingLine(trip, hazardTypes, routingAdvisory),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, elevated: 2 };
      return (rank[a.compositeRisk] ?? 9) - (rank[b.compositeRisk] ?? 9);
    });

  return {
    ok: true,
    phase: "phase-2-day-14",
    level,
    mode: "multi_hazard_fusion",
    floodActiveZones: flood.activeZoneCount,
    windActiveZones: wind.activeZoneCount,
    routingTripAdvisories: routing.tripAdvisoryCount,
    avoidanceRouteCount: roadNetwork.avoidanceRouteCount,
    fusedTripCount: tripBriefings.length,
    criticalTripCount: tripBriefings.filter((t) => t.compositeRisk === "critical").length,
    highTripCount: tripBriefings.filter((t) => t.compositeRisk === "high").length,
    tripBriefings,
    matches: tripBriefings,
    scopeGuard: MULTI_HAZARD_SCOPE_GUARD,
    ingestedAt: new Date().toISOString(),
  };
}

export function buildMultiHazardSummary(level = 2) {
  const crossRef = buildMultiHazardCrossRef(level);

  return {
    ok: true,
    phase: "phase-2-day-14",
    headline: "Combined hazard + routing fusion — per-trip EOC briefing advisories",
    ...crossRef,
  };
}

/** Compact status for Monitor agent tool. */
export function getMultiHazardStatus() {
  const crossRef = buildMultiHazardCrossRef(2);

  return {
    ok: true,
    phase: "phase-2-day-14",
    fusedTripCount: crossRef.fusedTripCount,
    criticalTripCount: crossRef.criticalTripCount,
    highTripCount: crossRef.highTripCount,
    floodActiveZones: crossRef.floodActiveZones,
    windActiveZones: crossRef.windActiveZones,
    routingTripAdvisories: crossRef.routingTripAdvisories,
    avoidanceRouteCount: crossRef.avoidanceRouteCount,
    sampleBriefings: crossRef.tripBriefings?.slice(0, 3).map((t) => ({
      tripId: t.tripId,
      compositeRisk: t.compositeRisk,
      hazardTypes: t.hazardTypes,
      briefingLine: t.briefingLine,
    })),
    scopeGuard: MULTI_HAZARD_SCOPE_GUARD,
  };
}
