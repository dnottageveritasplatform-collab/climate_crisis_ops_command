/** Replace western demo streets with land-following centerlines clipped to island mask. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pointOnLand } from "../src/geo/land-mask.js";
import { clipLineStringToLand } from "../src/geo/street-clip.js";

const streetsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/geo/streets.json"
);

/** Centerlines kept inland — east of west coast, west of east coast. */
const WESTERN_STREETS = [
  {
    name: "John F Kennedy Drive",
    highway: "primary",
    coordinates: [
      [-77.468, 25.018],
      [-77.448, 25.021],
      [-77.428, 25.024],
      [-77.408, 25.027],
      [-77.388, 25.029],
      [-77.368, 25.031],
    ],
  },
  {
    name: "Blake Road",
    highway: "secondary",
    coordinates: [
      [-77.458, 25.038],
      [-77.438, 25.042],
      [-77.418, 25.046],
      [-77.398, 25.050],
      [-77.378, 25.053],
    ],
  },
  {
    name: "West Bay Street",
    highway: "primary",
    coordinates: [
      [-77.402, 25.068],
      [-77.388, 25.071],
      [-77.374, 25.074],
      [-77.360, 25.077],
      [-77.346, 25.079],
    ],
  },
  {
    name: "Coral Road",
    highway: "secondary",
    coordinates: [
      [-77.462, 25.026],
      [-77.448, 25.030],
      [-77.434, 25.034],
      [-77.420, 25.038],
    ],
  },
  {
    name: "Adelaide Road",
    highway: "secondary",
    coordinates: [
      [-77.452, 25.048],
      [-77.432, 25.051],
      [-77.412, 25.054],
      [-77.392, 25.057],
    ],
  },
  {
    name: "Lyford Cay Highway",
    highway: "secondary",
    coordinates: [
      [-77.472, 25.024],
      [-77.462, 25.030],
      [-77.452, 25.036],
      [-77.442, 25.042],
      [-77.432, 25.048],
    ],
  },
  {
    name: "Queen's Highway",
    highway: "primary",
    coordinates: [
      [-77.448, 25.058],
      [-77.428, 25.062],
      [-77.408, 25.066],
      [-77.388, 25.070],
      [-77.368, 25.074],
    ],
  },
  {
    name: "Nassau Airport Access Road",
    highway: "secondary",
    coordinates: [
      [-77.442, 25.032],
      [-77.426, 25.034],
      [-77.410, 25.036],
      [-77.394, 25.038],
    ],
  },
];

const landTest = (lon, lat) => pointOnLand(lon, lat);

function featureKey(name, coords) {
  const a = coords[0];
  const b = coords[coords.length - 1];
  return `${name}|${a[0].toFixed(4)},${a[1].toFixed(4)}|${b[0].toFixed(4)},${b[1].toFixed(4)}`;
}

const geo = JSON.parse(fs.readFileSync(streetsPath, "utf8"));
geo.features = geo.features.filter((f) => !f.properties?.western && !f.properties?.manual);

const keys = new Set(geo.features.map((f) => featureKey(f.properties.name, f.geometry.coordinates)));
let added = 0;

for (const s of WESTERN_STREETS) {
  const runs = clipLineStringToLand(s.coordinates, null, landTest);
  runs.sort((a, b) => b.length - a.length);
  for (const [i, coords] of runs.entries()) {
    if (coords.length < 2) continue;
    const k = featureKey(s.name, coords);
    if (keys.has(k)) continue;
    keys.add(k);
    geo.features.push({
      type: "Feature",
      properties: {
        name: s.name,
        highway: s.highway,
        label: true,
        western: true,
        manual: true,
        clipRun: runs.length > 1 ? i + 1 : undefined,
      },
      geometry: { type: "LineString", coordinates: coords },
    });
    added++;
  }
}

fs.writeFileSync(streetsPath, `${JSON.stringify(geo)}\n`);
console.log(`Western streets replaced: ${added} segment(s), total ${geo.features.length}`);
