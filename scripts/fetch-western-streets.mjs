/** Fetch real western NP OSM roads in small tiles; merge into streets.json. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const streetsPath = path.join(root, "data/geo/streets.json");

const TILES = [
  [24.98, -77.56, 25.04, -77.48],
  [24.98, -77.48, 25.04, -77.4],
  [25.04, -77.56, 25.08, -77.48],
  [25.04, -77.48, 25.08, -77.4],
  [25.08, -77.56, 25.1, -77.45],
  [25.08, -77.45, 25.1, -77.38],
];

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function fetchTile([south, west, north, east]) {
  const q = `[out:json][timeout:45];
way["highway"~"primary|secondary|tertiary|residential|trunk|unclassified"]["name"](${south},${west},${north},${east});
out geom;`;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ClimateCrisisOpsCommand/0.1",
        },
        body: `data=${encodeURIComponent(q)}`,
      });
      if (!res.ok) continue;
      const data = await res.json();
      return data.elements || [];
    } catch {
      /* try next */
    }
  }
  return [];
}

function wayToFeature(way) {
  const coords = way.geometry?.map(({ lon, lat }) => [lon, lat]) || [];
  const name = way.tags?.name;
  if (!name || coords.length < 2) return null;
  return {
    type: "Feature",
    properties: {
      osmId: way.id,
      name,
      highway: way.tags.highway || "residential",
      label: true,
    },
    geometry: { type: "LineString", coordinates: coords },
  };
}

function featureKey(f) {
  return f.properties.osmId ? `osm:${f.properties.osmId}` : JSON.stringify(f.geometry.coordinates[0]);
}

const byId = new Map();
for (const tile of TILES) {
  const els = await fetchTile(tile);
  console.log(`Tile ${tile.join(",")} -> ${els.length} ways`);
  for (const el of els) {
    if (el.type === "way" && el.geometry?.length >= 2 && el.tags?.name) {
      byId.set(el.id, el);
    }
  }
}

const western = [...byId.values()].map(wayToFeature).filter(Boolean);
console.log(`Unique western OSM ways: ${western.length}`);

if (western.length === 0) {
  console.error("No western OSM data fetched — keeping existing non-manual streets only");
  process.exit(1);
}

const geo = JSON.parse(fs.readFileSync(streetsPath, "utf8"));
geo.features = geo.features.filter((f) => !f.properties?.western && !f.properties?.manual);

const keys = new Set(geo.features.map(featureKey));
let added = 0;
for (const f of western) {
  const k = featureKey(f);
  if (keys.has(k)) continue;
  keys.add(k);
  geo.features.push(f);
  added++;
}

fs.writeFileSync(streetsPath, `${JSON.stringify(geo)}\n`);
console.log(`Merged ${added} western OSM streets; total ${geo.features.length}`);
