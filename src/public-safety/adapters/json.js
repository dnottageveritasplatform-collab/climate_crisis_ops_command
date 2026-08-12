import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const defaultPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/sample-public-safety-units.json"
);

export function loadPublicSafetyFeed(filePath = process.env.PUBLIC_SAFETY_PATH || defaultPath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
