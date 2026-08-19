#!/usr/bin/env node
/** Fetch Esri World Imagery basemap clipped to the command-map bbox. */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MAP, esriBasemapExportUrl } from "../src/geo/map-constants.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "src/ui/public/assets/nassau-basemap.jpg");
const { bbox, viewBox } = MAP;

const url = esriBasemapExportUrl();

const res = await fetch(url);
if (!res.ok) {
  console.error(`Basemap fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const contentType = res.headers.get("content-type") || "";
if (!contentType.includes("image")) {
  console.error(`Expected image/jpeg, got ${contentType}`);
  process.exit(1);
}

const bytes = Buffer.from(await res.arrayBuffer());
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, bytes);

console.log(
  JSON.stringify(
    {
      ok: true,
      path: path.relative(root, outPath),
      bytes: bytes.length,
      bbox,
      bboxSR: 3857,
      size: `${viewBox.width}x${viewBox.height}`,
      source: "Esri World Imagery",
    },
    null,
    2
  )
);
