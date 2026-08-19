/** Clip manual western street segments in streets.json to dry land. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pointOnLand } from "../src/geo/land-mask.js";
import { clipLineStringToLand } from "../src/geo/street-clip.js";

const streetsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/geo/streets.json"
);

const landTest = (lon, lat) => pointOnLand(lon, lat);

const geo = JSON.parse(fs.readFileSync(streetsPath, "utf8"));
const kept = [];
let clipped = 0;
let dropped = 0;

for (const f of geo.features) {
  if (!f.properties?.western && !f.properties?.manual) {
    kept.push(f);
    continue;
  }

  const runs = clipLineStringToLand(f.geometry.coordinates, null, landTest);
  if (!runs.length) {
    dropped++;
    continue;
  }

  runs.sort((a, b) => b.length - a.length);
  for (const [i, coords] of runs.entries()) {
    if (coords.length < 2) continue;
    kept.push({
      ...f,
      properties: {
        ...f.properties,
        clipRun: runs.length > 1 ? i + 1 : undefined,
      },
      geometry: { type: "LineString", coordinates: coords },
    });
    clipped++;
  }
}

geo.features = kept;
fs.writeFileSync(streetsPath, `${JSON.stringify(geo)}\n`);
console.log(`Clipped western/manual segments: ${clipped} kept, ${dropped} dropped, total ${kept.length}`);
