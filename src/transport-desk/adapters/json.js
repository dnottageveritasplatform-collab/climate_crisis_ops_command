import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dataRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../data");

export function loadHospitalDeskFeed(filePath = process.env.HOSPITAL_DESK_PATH) {
  const resolved = filePath || path.join(dataRoot, "sample-hospital-desk.json");
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

export function loadHandoffQueueFeed(filePath = process.env.EMS_HANDOFF_PATH) {
  const resolved = filePath || path.join(dataRoot, "sample-ems-handoff-queue.json");
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}
