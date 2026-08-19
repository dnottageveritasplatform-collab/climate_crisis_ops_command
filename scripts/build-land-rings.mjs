#!/usr/bin/env node
/** Build a land clip polygon from OSM coastline ways (New Providence bbox). */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "data/geo/new-providence-land-rings.json");

const q = `[out:json][timeout:90];way["natural"="coastline"](24.96,-77.58,25.13,-77.20);out geom;`;
const res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  body: q,
  headers: { "User-Agent": "CCOC-street-clip/1.0" },
});
const data = await res.json();
if (!data.elements?.length) {
  console.error("No coastline ways returned");
  process.exit(1);
}

/** @type {Map<number, {lat:number,lon:number}>} */
const nodes = new Map();
/** @type {Array<{id:number, coords:[number,number][]}>} */
const ways = [];

for (const el of data.elements) {
  if (el.type === "way" && el.geometry?.length >= 2) {
    ways.push({
      id: el.id,
      coords: el.geometry.map((g) => [g.lon, g.lat]),
    });
  }
}

function key(lon, lat) {
  return `${lon.toFixed(6)},${lat.toFixed(6)}`;
}

/** Stitch coastline ways into closed rings where possible. */
function buildRings() {
  const unused = new Set(ways.map((_, i) => i));
  const rings = [];

  while (unused.size) {
    const startIdx = unused.values().next().value;
    unused.delete(startIdx);
    let chain = [...ways[startIdx].coords];
    let extended = true;

    while (extended) {
      extended = false;
      const head = key(chain[0][0], chain[0][1]);
      const tail = key(chain[chain.length - 1][0], chain[chain.length - 1][1]);

      for (const idx of [...unused]) {
        const w = ways[idx].coords;
        const wHead = key(w[0][0], w[0][1]);
        const wTail = key(w[w.length - 1][0], w[w.length - 1][1]);
        if (tail === wHead) {
          chain = chain.concat(w.slice(1));
          unused.delete(idx);
          extended = true;
          break;
        }
        if (tail === wTail) {
          chain = chain.concat([...w].reverse().slice(1));
          unused.delete(idx);
          extended = true;
          break;
        }
        if (head === wTail) {
          chain = w.slice(0, -1).concat(chain);
          unused.delete(idx);
          extended = true;
          break;
        }
        if (head === wHead) {
          chain = [...w].reverse().slice(0, -1).concat(chain);
          unused.delete(idx);
          extended = true;
          break;
        }
      }
    }

    if (chain.length >= 4) {
      const first = chain[0];
      const last = chain[chain.length - 1];
      if (key(first[0], first[1]) !== key(last[0], last[1])) {
        chain.push(first);
      }
      rings.push(chain);
    }
  }

  return rings;
}

const rings = buildRings().filter((ring) => ring.length >= 5);
if (!rings.length) {
  console.error("Failed to stitch coastline rings");
  process.exit(1);
}

/** Keep rings whose centroid falls inside the New Providence viewport. */
const viewport = { minLon: -77.57, maxLon: -77.21, minLat: 24.97, maxLat: 25.12 };
function ringCentroid(ring) {
  let lon = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lon += x;
    lat += y;
  }
  return { lon: lon / ring.length, lat: lat / ring.length };
}

const clipRings = rings.filter((ring) => {
  const c = ringCentroid(ring);
  return (
    c.lon >= viewport.minLon &&
    c.lon <= viewport.maxLon &&
    c.lat >= viewport.minLat &&
    c.lat <= viewport.maxLat
  );
});

fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      type: "FeatureCollection",
      source: "OpenStreetMap coastline",
      rings: clipRings.length ? clipRings : rings,
    },
    null,
    2
  )
);

console.log(JSON.stringify({ ok: true, path: path.relative(root, outPath), rings: (clipRings.length ? clipRings : rings).length, ways: ways.length }, null, 2));
