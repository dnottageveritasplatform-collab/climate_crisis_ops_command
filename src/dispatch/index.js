import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const dispatchPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/sample-dispatch.csv"
);

/** Load full NEMT dispatch manifest (synthetic demo data). */
export function loadDispatch() {
  const csv = fs.readFileSync(dispatchPath, "utf8");
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  return rows.map((r) => ({
    id: r.trip_id,
    priority: r.priority,
    patientCode: r.patient_code,
    pickup: r.pickup,
    pickupLat: Number(r.pickup_lat),
    pickupLon: Number(r.pickup_lon),
    facility: r.facility,
    facilityId: r.facility_id,
    scheduledAt: r.scheduled_at,
    status: r.status,
    corridor: r.route_corridor,
  }));
}

export function corridorStatusForLevel(level) {
  if (level >= 3) return { "CORR-01": "closed", "CORR-02": "closed" };
  if (level >= 2) return { "CORR-01": "open", "CORR-02": "restricted" };
  return { "CORR-01": "open", "CORR-02": "open" };
}

/** Trips at risk for a given escalation level. */
export function getAtRiskTrips(level = 2) {
  const trips = loadDispatch();
  if (level >= 3) return trips.filter((t) => ["P1", "P2"].includes(t.priority));
  if (level >= 2) return trips.filter((t) => t.priority === "P1");
  return [];
}

export function summarizeDispatch(level = 2) {
  const trips = loadDispatch();
  const atRisk = getAtRiskTrips(level);
  const p1 = trips.filter((t) => t.priority === "P1");
  const corridors = [...new Set(trips.map((t) => t.corridor))];

  return {
    level,
    totalTrips: trips.length,
    p1Trips: p1.length,
    atRiskTrips: atRisk.length,
    corridors,
    corridorStatus: corridorStatusForLevel(level),
    sample: atRisk.slice(0, 3).map((t) => ({
      id: t.id,
      priority: t.priority,
      pickup: t.pickup,
      facility: t.facility,
      corridor: t.corridor,
    })),
  };
}
