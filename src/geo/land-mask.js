/** Coast-following land mask for clipping street overlays to dry land. */

/** @type {[number, number][]} [lat, lon] west coast from south to north */
const WEST_COAST = [
  [24.978, -77.554],
  [25.01, -77.52],
  [25.03, -77.475],
  [25.05, -77.42],
  [25.07, -77.41],
  [25.09, -77.45],
];

/** @type {[number, number][]} [lat, lon] east coast from south to north */
const EAST_COAST = [
  [24.985, -77.265],
  [25.03, -77.258],
  [25.06, -77.262],
  [25.085, -77.275],
];

const PARADISE_RING = [
  [-77.318, 25.078],
  [-77.3, 25.076],
  [-77.278, 25.079],
  [-77.268, 25.088],
  [-77.27, 25.097],
  [-77.288, 25.1],
  [-77.308, 25.099],
  [-77.318, 25.092],
  [-77.318, 25.078],
];

/** @param {number} lat @param {[number,number][]} coast [lat, lon] pairs */
function coastLonAtLat(lat, coast) {
  if (lat <= coast[0][0]) return coast[0][1];
  if (lat >= coast[coast.length - 1][0]) return coast[coast.length - 1][1];
  for (let i = 0; i < coast.length - 1; i++) {
    const [lat0, lon0] = coast[i];
    const [lat1, lon1] = coast[i + 1];
    if (lat >= lat0 && lat <= lat1) {
      const t = (lat - lat0) / (lat1 - lat0);
      return lon0 + t * (lon1 - lon0);
    }
  }
  return coast[coast.length - 1][1];
}

/** @param {number} lon @param {number} lat */
export function pointOnLand(lon, lat, { marginDeg = 0.004 } = {}) {
  if (lat < 24.975 || lat > 25.105) return false;

  const westLon = coastLonAtLat(lat, WEST_COAST) + marginDeg;
  const eastLon = coastLonAtLat(lat, EAST_COAST) - marginDeg;
  if (lon < westLon || lon > eastLon) return false;

  if (lat >= 25.075 && lon >= -77.32 && lon <= -77.265) {
    return pointInRing(lon, lat, PARADISE_RING);
  }

  if (lat > 25.092 && lon < -77.31) return false;
  return true;
}

/** @param {number} lon @param {number} lat @param {[number,number][]} ring */
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Build a closed ring approximating the main island for SVG underlay. */
export function mainIslandRing() {
  const south = [-77.554, 24.978];
  const north = [-77.46, 25.092];
  const eastS = [-77.265, 24.985];
  const eastN = [-77.275, 25.085];
  return [
    south,
    [-77.35, 24.99],
    eastS,
    [-77.258, 25.05],
    eastN,
    north,
    [-77.52, 25.08],
    [-77.545, 25.04],
    south,
  ];
}

/** @returns {[number,number][][]} */
export function landClipRings() {
  return [mainIslandRing(), PARADISE_RING];
}
