import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const defaultPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/sample-shelter-fleet.json"
);

export function loadShelterFleetFeed() {
  const filePath = process.env.SHELTER_FLEET_PATH || defaultPath;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
