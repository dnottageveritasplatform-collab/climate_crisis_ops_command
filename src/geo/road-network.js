/** Phase 2 Day 16 — pilot road network graph + turn-by-turn corridor avoidance (read-only). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAtRiskTrips } from "../dispatch/index.js";
import { getActiveCorridorStatus } from "./esri.js";

export const ROAD_NETWORK_SCOPE_GUARD =
  "Pilot road network turn-by-turn avoidance — read-only EOC/driver briefing; not navigation dispatch or automated reroute authority.";

const geoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/geo");
const defaultNetworkPath = path.join(geoRoot, "road-network-demo.json");

let cachedNetwork = null;

function loadRoadNetworkConfig({ refresh = false } = {}) {
  if (cachedNetwork && !refresh) return cachedNetwork;

  const filePath = process.env.ROAD_NETWORK_PATH || defaultNetworkPath;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  cachedNetwork = {
    nodes: raw.nodes || [],
    edges: raw.edges || [],
    tripAnchors: raw.tripAnchors || {},
    scopeGuard: raw.scopeGuard || ROAD_NETWORK_SCOPE_GUARD,
    source: path.basename(filePath).includes("demo") ? "demo_json" : "custom_json",
    loadedAt: new Date().toISOString(),
  };
  return cachedNetwork;
}

function nodeName(config, nodeId) {
  return config.nodes.find((n) => n.id === nodeId)?.name || nodeId;
}

function buildAdjacency(config) {
  const adj = new Map();
  for (const edge of config.edges) {
    for (const [from, to] of [
      [edge.from, edge.to],
      [edge.to, edge.from],
    ]) {
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from).push(edge);
    }
  }
  return adj;
}

function blockedEdgeIds(config, corridorStatus) {
  const blocked = new Set();
  for (const edge of config.edges) {
    if (!edge.corridorId) continue;
    const status = corridorStatus[edge.corridorId];
    if (status && status !== "open") blocked.add(edge.id);
  }
  return blocked;
}

/** Shortest path by edge distance, skipping corridor-blocked segments. */
export function findAvoidancePath(originNodeId, destNodeId, { blockedEdges = new Set(), config } = {}) {
  const network = config || loadRoadNetworkConfig();
  const adj = buildAdjacency(network);
  const dist = new Map([[originNodeId, 0]]);
  const prev = new Map();
  const queue = [originNodeId];

  while (queue.length) {
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const current = queue.shift();
    if (current === destNodeId) break;
    const currentDist = dist.get(current) ?? Infinity;

    for (const edge of adj.get(current) || []) {
      if (blockedEdges.has(edge.id)) continue;
      const neighbor = edge.from === current ? edge.to : edge.from;
      const nextDist = currentDist + (edge.distanceM || 1);
      if (nextDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, nextDist);
        prev.set(neighbor, { nodeId: current, edge });
        if (!queue.includes(neighbor)) queue.push(neighbor);
      }
    }
  }

  if (!prev.has(destNodeId) && originNodeId !== destNodeId) {
    return null;
  }

  const steps = [];
  let cursor = destNodeId;
  while (cursor !== originNodeId) {
    const link = prev.get(cursor);
    if (!link) break;
    steps.unshift({
      edgeId: link.edge.id,
      streetName: link.edge.name,
      corridorId: link.edge.corridorId || null,
      fromNodeId: link.nodeId,
      toNodeId: cursor,
      fromName: nodeName(network, link.nodeId),
      toName: nodeName(network, cursor),
      distanceM: link.edge.distanceM,
      instruction: `Continue on ${link.edge.name} toward ${nodeName(network, cursor)}`,
    });
    cursor = link.nodeId;
  }

  return {
    originNodeId,
    destNodeId,
    originName: nodeName(network, originNodeId),
    destName: nodeName(network, destNodeId),
    stepCount: steps.length,
    totalDistanceM: dist.get(destNodeId) ?? steps.reduce((n, s) => n + (s.distanceM || 0), 0),
    steps,
    turnByTurn: steps.map((s, i) => `${i + 1}. ${s.instruction}`),
  };
}

export function buildRoadNetworkCrossRef(level = 2) {
  const config = loadRoadNetworkConfig();
  const corridorStatus = getActiveCorridorStatus(level);
  const atRisk = getAtRiskTrips(level);
  const blocked = blockedEdgeIds(config, corridorStatus);

  const restrictedCorridors = Object.entries(corridorStatus)
    .filter(([, st]) => st !== "open")
    .map(([id, status]) => ({ id, status }));

  const tripAvoidanceRoutes = atRisk
    .map((trip) => {
      const anchor = config.tripAnchors[trip.id];
      if (!anchor) return null;

      const corridor = trip.corridor;
      const corridorSt = corridorStatus[corridor];
      if (!corridorSt || corridorSt === "open") return null;

      const path = findAvoidancePath(anchor.originNodeId, anchor.destNodeId, {
        blockedEdges: blocked,
        config,
      });
      if (!path?.steps?.length) return null;

      return {
        tripId: trip.id,
        priority: trip.priority,
        pickup: trip.pickup,
        facility: trip.facility,
        corridor,
        corridorStatus: corridorSt,
        originName: path.originName,
        destName: path.destName,
        stepCount: path.stepCount,
        totalDistanceM: path.totalDistanceM,
        turnByTurn: path.turnByTurn,
        steps: path.steps,
        avoidedCorridor: corridor,
        briefingLine: `Avoid ${corridor} (${corridorSt}) — ${path.stepCount} segment(s) via ${path.steps.map((s) => s.streetName).join(" → ")}`,
      };
    })
    .filter(Boolean);

  return {
    ok: true,
    phase: "phase-2-day-16",
    level,
    mode: "turn_by_turn_avoidance",
    nodeCount: config.nodes.length,
    edgeCount: config.edges.length,
    blockedEdgeCount: blocked.size,
    restrictedCorridorCount: restrictedCorridors.length,
    atRiskCount: atRisk.length,
    avoidanceRouteCount: tripAvoidanceRoutes.length,
    tripAvoidanceRoutes,
    matches: tripAvoidanceRoutes,
    restrictedCorridors,
    scopeGuard: config.scopeGuard,
    source: config.source,
    ingestedAt: config.loadedAt,
  };
}

export function buildRoadNetworkSummary(level = 2) {
  const config = loadRoadNetworkConfig();
  const crossRef = buildRoadNetworkCrossRef(level);

  return {
    ok: true,
    phase: "phase-2-day-16",
    headline: "Pilot road network — turn-by-turn corridor avoidance advisories",
    tripAnchorCount: Object.keys(config.tripAnchors).length,
    ...crossRef,
  };
}

export function getRoadNetworkStatus() {
  const config = loadRoadNetworkConfig();
  const crossRef = buildRoadNetworkCrossRef(2);

  return {
    ok: true,
    phase: "phase-2-day-16",
    nodeCount: config.nodes.length,
    edgeCount: config.edges.length,
    tripAnchorCount: Object.keys(config.tripAnchors).length,
    blockedEdgeCount: crossRef.blockedEdgeCount,
    avoidanceRouteCount: crossRef.avoidanceRouteCount,
    sampleRoutes: crossRef.tripAvoidanceRoutes.slice(0, 3).map((r) => ({
      tripId: r.tripId,
      corridor: r.corridor,
      stepCount: r.stepCount,
      briefingLine: r.briefingLine,
    })),
    scopeGuard: ROAD_NETWORK_SCOPE_GUARD,
    source: config.source,
  };
}

export function ingestRoadNetworkWebhook(payload) {
  if (!payload || !Array.isArray(payload.edges) || !Array.isArray(payload.nodes)) {
    throw new Error("Road network webhook payload must include nodes and edges arrays");
  }

  cachedNetwork = {
    nodes: payload.nodes,
    edges: payload.edges,
    tripAnchors: payload.tripAnchors || {},
    scopeGuard: payload.scopeGuard || ROAD_NETWORK_SCOPE_GUARD,
    source: "webhook",
    loadedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    ingested: {
      nodes: cachedNetwork.nodes.length,
      edges: cachedNetwork.edges.length,
      tripAnchors: Object.keys(cachedNetwork.tripAnchors).length,
    },
    source: "webhook",
    ingestedAt: cachedNetwork.loadedAt,
  };
}
