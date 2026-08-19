import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawPath = path.join(root, "data/geo/streets-raw.json");
const streetsPath = path.join(root, "data/geo/streets.json");

const WEST = { minLon: -77.56, maxLon: -77.36, minLat: 24.98, maxLat: 25.1 };

const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));

function inWest(lon, lat) {
  return lon >= WEST.minLon && lon <= WEST.maxLon && lat >= WEST.minLat && lat <= WEST.maxLat;
}

function wayToFeature(way) {
  const coords = way.geometry.map(({ lon, lat }) => [lon, lat]);
  const name = way.tags?.name;
  if (!name || coords.length < 2) return null;
  const mid = coords[Math.floor(coords.length / 2)];
  if (!inWest(mid[0], mid[1])) return null;
  return {
    type: "Feature",
    properties: {
      osmId: way.id,
      name,
      highway: way.tags?.highway || "residential",
      label: true,
    },
    geometry: { type: "LineString", coordinates: coords },
  };
}

function featureKey(f) {
  if (f.properties.osmId) return `osm:${f.properties.osmId}`;
  const c = f.geometry.coordinates;
  return `${f.properties.name}|${c[0][0].toFixed(5)},${c[0][1].toFixed(5)}`;
}

const western = (raw.elements || [])
  .filter((el) => el.type === "way" && el.geometry?.length >= 2 && el.tags?.name)
  .map(wayToFeature)
  .filter(Boolean);

console.log(`Western ways in streets-raw: ${western.length}`);

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
console.log(`Merged ${added}; total ${geo.features.length}`);
