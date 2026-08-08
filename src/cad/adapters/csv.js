import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const defaultPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/sample-cad-export.csv"
);

/** Load county CAD / NEMT dispatch export from CSV (read-only pilot format). */
export function loadCadCsv(filePath = process.env.CAD_CSV_PATH || defaultPath) {
  const csv = fs.readFileSync(filePath, "utf8");
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  return rows.map(normalizeCadRow);
}

function normalizeCadRow(row) {
  return {
    runId: row.run_id,
    incidentId: row.incident_id,
    tripId: row.trip_id,
    unitId: row.unit_id,
    unitStatus: row.unit_status,
    agency: row.agency,
    incidentType: row.incident_type,
    dispatchedAt: row.dispatched_at,
    lat: Number(row.lat),
    lon: Number(row.lon),
    destination: row.destination,
  };
}
