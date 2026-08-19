/** Shared command-map projection — full New Providence (+ Paradise Island margin). */

export const MAP_BBOX = {
  minLon: -77.57,
  maxLon: -77.21,
  minLat: 24.97,
  maxLat: 25.12,
};

/** Locked viewport — do not change (matches command-map panel layout). */
export const MAP_VIEW = { width: 800, height: 333, padLeft: 0 };

const MERCATOR_R = 6378137;

export function lonLatToMercator(lon, lat) {
  const x = (lon * Math.PI * MERCATOR_R) / 180;
  const latRad = (lat * Math.PI) / 180;
  const y = MERCATOR_R * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return { x, y };
}

export function mercatorBounds(bbox) {
  const sw = lonLatToMercator(bbox.minLon, bbox.minLat);
  const ne = lonLatToMercator(bbox.maxLon, bbox.maxLat);
  return { minX: sw.x, maxX: ne.x, minY: sw.y, maxY: ne.y };
}

export const MAP = {
  viewBox: { ...MAP_VIEW },
  bbox: MAP_BBOX,
};

export function mapViewBoxString(map = MAP) {
  const pad = map.viewBox.padLeft || 0;
  return `0 0 ${map.viewBox.width + pad} ${map.viewBox.height}`;
}

/** Web Mercator → SVG pixels (must match live Esri export below). */
export function projectPoint(lon, lat, map = MAP) {
  const bounds = mercatorBounds(map.bbox);
  const pt = lonLatToMercator(lon, lat);
  const { viewBox } = map;
  const x = ((pt.x - bounds.minX) / (bounds.maxX - bounds.minX)) * viewBox.width;
  const y = viewBox.height - ((pt.y - bounds.minY) / (bounds.maxY - bounds.minY)) * viewBox.height;
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

export function esriExportBbox(map = MAP) {
  const { minX, maxX, minY, maxY } = mercatorBounds(map.bbox);
  return [minX, minY, maxX, maxY].join(",");
}

/** Live Esri export URL — same bbox/size/SR as projectPoint(). */
export function esriBasemapExportUrl(map = MAP) {
  const { viewBox } = map;
  const params = new URLSearchParams({
    bbox: esriExportBbox(map),
    bboxSR: "3857",
    imageSR: "3857",
    size: `${viewBox.width},${viewBox.height}`,
    format: "jpg",
    f: "image",
  });
  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`;
}

/** Bump when projection/extent changes — shown in UI to confirm fresh code. */
export const BASEMAP_REV = "14";
