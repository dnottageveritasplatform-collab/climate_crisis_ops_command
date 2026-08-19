/** Clip street centerlines to land rings (lon/lat). */

/** @param {number} lon @param {number} lat @param {[number,number][][]} rings */
export function pointOnLandRings(lon, lat, rings) {
  return rings.some((ring) => pointInRing(lon, lat, ring));
}

/** @param {number} lon @param {number} lat @param {[number,number][]} ring */
export function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** @param {[number,number][]} coords @param {number} maxStepDeg */
export function densifyLine(coords, maxStepDeg = 0.00014) {
  if (!coords.length) return [];
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const dist = Math.hypot(lon2 - lon1, lat2 - lat1);
    const steps = Math.max(1, Math.ceil(dist / maxStepDeg));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([lon1 + t * (lon2 - lon1), lat1 + t * (lat2 - lat1)]);
    }
  }
  return out;
}

/**
 * Split a line into land-only runs.
 * @param {[number,number][]} coords
 * @param {[number,number][][]|null} rings
 * @param {(lon:number, lat:number)=>boolean} [landTest]
 */
export function clipLineStringToLand(coords, rings, landTest) {
  if (!coords?.length) return [];
  const onLand =
    landTest ||
    (rings?.length ? (lon, lat) => pointOnLandRings(lon, lat, rings) : () => true);
  const dense = densifyLine(coords);
  /** @type {[number,number][][]} */
  const runs = [];
  /** @type {[number,number][]} */
  let run = [];

  for (const pt of dense) {
    const inside = onLand(pt[0], pt[1]);
    if (inside) {
      run.push(pt);
    } else if (run.length) {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);

  return runs.map(simplifyRun);
}

/** @param {[number,number][]} run */
function simplifyRun(run) {
  if (run.length <= 2) return run;
  const out = [run[0]];
  for (let i = 1; i < run.length - 1; i++) {
    const [lon0, lat0] = out[out.length - 1];
    const [lon1, lat1] = run[i];
    if (Math.hypot(lon1 - lon0, lat1 - lat0) >= 0.00012) out.push(run[i]);
  }
  out.push(run[run.length - 1]);
  return out;
}
