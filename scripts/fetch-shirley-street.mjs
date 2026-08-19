/** Fetch Shirley Street OSM geometry and append to streets.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const streetsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/geo/streets.json"
);

const q = `[out:json][timeout:45];
way["highway"]["name"~"Shirley",i](25.068,-77.345,25.078,-77.318);
out geom;`;

const geo = JSON.parse(fs.readFileSync(streetsPath, "utf8"));
geo.features = geo.features.filter((f) => !/shirley/i.test(f.properties?.name || ""));

const keys = new Set(
  geo.features.map((f) => `${f.properties.name}|${f.properties.osmId || ""}`)
);
let added = 0;

const res = await fetch("https://overpass.kumi.systems/api/interpreter", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "ClimateCrisisOpsCommand/0.1",
  },
  body: `data=${encodeURIComponent(q)}`,
});
if (!res.ok) {
  console.warn(`Overpass ${res.status} — using manual Shirley Street fallback`);
} else {
  const data = await res.json();
  for (const way of data.elements || []) {
    if (way.type !== "way" || !way.geometry?.length || !way.tags?.name) continue;
    const k = `${way.tags.name}|${way.id}`;
    if (keys.has(k)) continue;
    keys.add(k);
    geo.features.push({
      type: "Feature",
      properties: {
        osmId: way.id,
        name: way.tags.name,
        highway: way.tags.highway || "secondary",
        label: true,
      },
      geometry: {
        type: "LineString",
        coordinates: way.geometry.map(({ lon, lat }) => [lon, lat]),
      },
    });
    added++;
  }
}

if (added === 0) {
  geo.features.push({
    type: "Feature",
    properties: { name: "Shirley Street", highway: "secondary", label: true, manual: true },
    geometry: {
      type: "LineString",
      coordinates: [
        [-77.342, 25.068],
        [-77.338, 25.070],
        [-77.334, 25.072],
        [-77.330, 25.074],
        [-77.326, 25.075],
        [-77.322, 25.076],
      ],
    },
  });
  added = 1;
}

fs.writeFileSync(streetsPath, `${JSON.stringify(geo)}\n`);
console.log(`Shirley Street segment(s) added: ${added}`);
