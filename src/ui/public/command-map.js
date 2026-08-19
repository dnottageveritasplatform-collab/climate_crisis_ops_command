/** Leaflet command map — WGS84 overlays on Esri World Imagery with full demo markers. */
(function () {
  const ISLAND_BOUNDS = [
    [24.97, -77.57],
    [25.12, -77.21],
  ];

  const MARKER_COLORS = {
    "hospital-public": "#f97316",
    "hospital-private": "#c084fc",
    nemt: "#38bdf8",
    fire: "#ef4444",
    police: "#3b82f6",
  };

  let map = null;
  let streetsLoaded = false;
  let streetLabelMarkers = [];
  const groups = {};

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function iconPaths(type) {
    if (type === "hospital-public" || type === "hospital-private") {
      return `
        <rect x="3" y="7" width="10" height="8" rx="1"/>
        <rect x="5" y="2" width="6" height="6" rx="1"/>
        <rect x="7.1" y="3.8" width="1.8" height="3.2" fill="#fff" stroke="none"/>
        <rect x="6.1" y="4.8" width="3.8" height="1.8" fill="#fff" stroke="none"/>
        <rect x="7" y="9" width="2" height="4" fill="rgba(255,255,255,0.35)" stroke="none"/>
      `;
    }
    if (type === "nemt") {
      return `
        <rect x="1.5" y="5" width="10" height="6.5" rx="1.2"/>
        <rect x="11" y="6" width="3.5" height="5.5" rx="1"/>
        <circle cx="4.5" cy="12.5" r="1.4" fill="#1e293b" stroke="none"/>
        <circle cx="12.5" cy="12.5" r="1.4" fill="#1e293b" stroke="none"/>
        <rect x="5.5" y="6.8" width="5" height="3.5" rx="0.5" fill="#fff" stroke="none"/>
        <rect x="6.8" y="7.4" width="1.2" height="2.3" fill="#38bdf8" stroke="none"/>
        <rect x="6.2" y="8.1" width="2.4" height="1.2" fill="#38bdf8" stroke="none"/>
      `;
    }
    if (type === "fire") {
      return `
        <rect x="1" y="6.5" width="5" height="5.5" rx="0.8"/>
        <rect x="5.5" y="5.5" width="9" height="6.5" rx="1"/>
        <rect x="7" y="3" width="6" height="3" rx="0.6"/>
        <circle cx="3.5" cy="12.5" r="1.3" fill="#1e293b" stroke="none"/>
        <circle cx="12" cy="12.5" r="1.3" fill="#1e293b" stroke="none"/>
        <rect x="8" y="6.5" width="5" height="0.9" fill="#fff" stroke="none" opacity="0.75"/>
        <rect x="8" y="8.1" width="5" height="0.9" fill="#fff" stroke="none" opacity="0.75"/>
        <rect x="8" y="9.7" width="5" height="0.9" fill="#fff" stroke="none" opacity="0.75"/>
      `;
    }
    if (type === "police") {
      return `
        <path d="M2.5 8.5 L4.5 6.5 H11.5 L13.5 8.5 V11 H2.5 Z"/>
        <rect x="5" y="4.3" width="6" height="2.2" rx="0.5" fill="#fff" stroke="none"/>
        <rect x="5.8" y="4.6" width="1.4" height="1.6" fill="#ef4444" stroke="none"/>
        <rect x="8.8" y="4.6" width="1.4" height="1.6" fill="#3b82f6" stroke="none"/>
        <circle cx="4.5" cy="12" r="1.2" fill="#1e293b" stroke="none"/>
        <circle cx="11.5" cy="12" r="1.2" fill="#1e293b" stroke="none"/>
      `;
    }
    return "";
  }

  function iconSvgHtml(type, color, size = 16) {
    return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="${color}" stroke="#fff" stroke-width="0.75" stroke-linejoin="round">${iconPaths(type)}</svg>`;
  }

  function divIcon(html, w, h, ax, ay, cls = "") {
    return L.divIcon({
      className: `cmd-map-icon ${cls}`.trim(),
      html,
      iconSize: [w, h],
      iconAnchor: [ax, ay],
    });
  }

  function facilityType(role) {
    if (role === "hospital_partner") return "hospital-public";
    if (role === "hospital_partner_private") return "hospital-private";
    return "nemt";
  }

  function facilityHtml(f) {
    const type = facilityType(f.role);
    const color = f.color || MARKER_COLORS[type];
    const name = esc(f.name.split(" ").slice(0, 2).join(" "));
    let bed = "";
    if (f.bedPressurePct != null) {
      const bc = f.bedPressureColor || "#ffb347";
      bed = `<div class="cmd-bed-pill" style="background:${bc}">BEDS ${f.bedPressurePct}%</div>`;
    }
    let diversion = "";
    if (f.diversionStatus && f.diversionStatus !== "open") {
      diversion = `<div class="cmd-diversion-pill">${esc((f.diversionLabel || "DIVERSION").toUpperCase())}</div>`;
    }
    let hold = "";
    if (f.electiveHold) {
      hold = `<div class="cmd-hold-pill">ELECTIVE HOLD</div>`;
    }
    let rank = "";
    if (f.rank) {
      rank = `<div class="cmd-rank-tag">#${f.rank}</div>`;
    }
    return `<div class="cmd-facility">${diversion}${bed}${iconSvgHtml(type, color, 20)}${rank}<div class="cmd-fac-name" style="color:${color}">${name}</div>${hold}</div>`;
  }

  function cadUnitHtml(u) {
    const stroke = u.atRiskLinked ? "#ffc72c" : "#fff";
    const label = esc(u.unitId.replace("UNIT-", "U"));
    return `<div class="cmd-cad-unit" style="background:${u.color || "#38bdf8"};border-color:${stroke}"><span>${label}</span></div>`;
  }

  function publicSafetyHtml(u) {
    const type = u.agency === "fire" ? "fire" : "police";
    const color = u.color || MARKER_COLORS[type];
    const label = esc(u.unitId.replace(/^(FP-|RBPF-)/, ""));
    return `<div class="cmd-psu">${iconSvgHtml(type, color, 18)}<div class="cmd-psu-label">${label}</div></div>`;
  }

  function tripHtml(t, rank) {
    const size = t.atRisk ? 14 : 10;
    const fill = t.color || "#ffc72c";
    let rankHtml = rank ? `<div class="cmd-trip-rank">#${rank}</div>` : "";
    let cadHtml = "";
    if (t.cadRunId && (t.atRisk || rank)) {
      cadHtml = `<div class="cmd-trip-cad">${esc(t.cadRunId.replace("RUN-", "R"))}${t.unitStatus ? ` · ${esc(t.unitStatus.replace("_", " "))}` : ""}</div>`;
    }
    return `<div class="cmd-trip">${rankHtml}<div class="cmd-trip-dot" style="width:${size}px;height:${size}px;background:${fill}"></div>${cadHtml}</div>`;
  }

  function corridorLabelHtml(c) {
    const statusLabel = c.status === "closed" ? "CLOSED" : c.status === "restricted" ? "RESTRICTED" : "OPEN";
    const color = c.color || "#ffb347";
    const atRisk = c.atRiskTrips
      ? `<div class="cmd-corridor-sub">${c.atRiskTrips} at-risk</div>`
      : "";
    return `<div class="cmd-corridor-label" style="border-color:${color};color:${color}"><div>${esc(c.id)} · ${statusLabel}</div>${atRisk}</div>`;
  }

  function floodCalloutHtml(f) {
    const c = f.callout || {};
    const headline = esc(c.headline || f.name || "Flood zone");
    const detail = esc(c.detail || f.label?.text || "");
    const stroke = f.stroke || "#0ea5e9";
    return `<div class="cmd-flood-callout" style="border-color:${stroke}"><div class="cmd-flood-head" style="color:${stroke}">${headline}</div><div class="cmd-flood-detail">${detail}</div></div>`;
  }

  function ringCenter(ring) {
    let lonSum = 0;
    let latSum = 0;
    for (const [lon, lat] of ring) {
      lonSum += lon;
      latSum += lat;
    }
    return [latSum / ring.length, lonSum / ring.length];
  }

  function lineMidpoint(coords) {
    const [[lon1, lat1], [lon2, lat2]] = coords;
    return [(lat1 + lat2) / 2, (lon1 + lon2) / 2];
  }

  function lineMidpointFromFeature(coords) {
    if (!coords?.length) return null;
    if (coords.length === 1) return [coords[0][1], coords[0][0]];
    let lonSum = 0;
    let latSum = 0;
    for (const [lon, lat] of coords) {
      lonSum += lon;
      latSum += lat;
    }
    return [latSum / coords.length, lonSum / coords.length];
  }

  function init() {
    if (map) return map;
    const el = document.getElementById("commandMap");
    if (!el || typeof L === "undefined") return null;

    map = L.map(el, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Esri World Imagery" }
    ).addTo(map);

    map.fitBounds(ISLAND_BOUNDS, { padding: [10, 10] });

    for (const key of [
      "streets",
      "street-labels",
      "flood-agency",
      "flood-glofas",
      "flood-commercial",
      "wind-hurricane",
      "wind-strong",
      "wind-tropical",
      "corridors",
      "trips",
      "hospital-public",
      "hospital-private",
      "nemt",
      "cad",
      "fire",
      "police",
    ]) {
      groups[key] = L.layerGroup().addTo(map);
    }

    map.on("zoomend", syncStreetLabelVisibility);
    loadStreets();
    return map;
  }

  function syncStreetLabelVisibility() {
    if (!map) return;
    const show = map.getZoom() >= 13;
    for (const m of streetLabelMarkers) {
      const el = m.getElement?.();
      if (el) el.style.display = show ? "" : "none";
    }
  }

  function loadStreets() {
    if (streetsLoaded) return;
    streetsLoaded = true;
    fetch("/api/geo/streets")
      .then((r) => r.json())
      .then((geojson) => {
        L.geoJSON(geojson, {
          filter: (f) => {
            const hw = f.properties?.highway;
            const name = f.properties?.name || "";
            if (hw === "tertiary" && !/collins|carmichael|bay|mackey|eastern|shirley|nassau|kennedy|blake|coral|adelaide|lyford|queen|airport/i.test(name)) {
              return false;
            }
            return hw !== "footway" && hw !== "path" && hw !== "steps";
          },
          style: (f) => {
            const hw = f.properties?.highway;
            const important = /collins|carmichael|bay street|mackey|eastern|shirley|kennedy|blake|coral|adelaide|lyford|queen|airport/i.test(f.properties?.name || "");
            return {
              color: important ? "#ffffff" : "#c8ddd2",
              weight: hw === "motorway" || hw === "trunk" ? 4 : hw === "primary" ? 3 : 2,
              opacity: important ? 0.92 : 0.72,
            };
          },
          onEachFeature: (f, layer) => {
            const name = f.properties?.name;
            if (!name || !/collins|carmichael|bay|mackey|eastern|shirley|nassau|market|kennedy|blake|coral|adelaide|lyford|queen|airport/i.test(name)) return;
            const anchor = f.properties?.labelAt;
            const mid = anchor
              ? [anchor[1], anchor[0]]
              : lineMidpointFromFeature(f.geometry?.coordinates);
            if (!mid) return;
            const prominent = /bay street|eastern|shirley|kennedy|blake|lyford/i.test(name);
            const html = `<div class="cmd-street-label${prominent ? " prominent" : ""}">${esc(name)}</div>`;
            const marker = L.marker(mid, {
              icon: divIcon(html, 120, 16, 60, 8, "cmd-street-label-icon"),
              interactive: false,
            });
            streetLabelMarkers.push(marker);
            marker.addTo(groups["street-labels"]);
          },
        }).addTo(groups.streets);
        syncStreetLabelVisibility();
      })
      .catch((err) => console.warn("Street layer load failed:", err));
  }

  function clearGroup(key) {
    if (groups[key]) groups[key].clearLayers();
  }

  function facilityLayerKey(role) {
    if (role === "hospital_partner") return "hospital-public";
    if (role === "hospital_partner_private") return "hospital-private";
    return "nemt";
  }

  function floodLayerKey(zone) {
    if (zone.confidence === "commercial_model" || zone.source === "commercial") return "flood-commercial";
    if (zone.source === "glofas" || zone.confidence === "model_estimated") return "flood-glofas";
    return "flood-agency";
  }

  function windLayerKey(zone) {
    const t = zone.tier || zone.windBand || zone.label?.text || "";
    if (/hurricane/i.test(t)) return "wind-hurricane";
    if (/strong|high/i.test(t)) return "wind-strong";
    return "wind-tropical";
  }

  function layerVisibilityKey(key) {
    if (key === "streets" || key === "street-labels") return "street-labels";
    return key;
  }

  function syncLayerVisibility(isVisible) {
    if (!map) return;
    for (const [key, group] of Object.entries(groups)) {
      const visible = isVisible(layerVisibilityKey(key));
      if (visible) {
        if (!map.hasLayer(group)) group.addTo(map);
      } else {
        map.removeLayer(group);
      }
    }
    syncStreetLabelVisibility();
  }

  const FACILITY_W = 100;
  const FACILITY_H = 96;
  const FACILITY_ANCHOR_Y = 92;

  function render(layers, ranks, isVisible, { visibilityOnly = false } = {}) {
    if (!init()) return;

    if (!visibilityOnly) {
      for (const key of Object.keys(groups)) {
        if (key !== "streets" && key !== "street-labels") clearGroup(key);
      }
    } else {
      syncLayerVisibility(isVisible);
      return;
    }

    for (const f of layers.floodZones || []) {
      const key = floodLayerKey(f);
      if (!isVisible(key) || !f.ring?.length) continue;
      const latlngs = f.ring.map(([lon, lat]) => [lat, lon]);
      L.polygon(latlngs, {
        color: f.stroke || "#0ea5e9",
        fillColor: f.fill || "#0ea5e9",
        fillOpacity: f.opacity || 0.35,
        weight: f.strokeDasharray ? 1.6 : 2,
        dashArray: f.strokeDasharray?.replace(/ /g, ",") || null,
      }).addTo(groups[key]);
      const center = ringCenter(f.ring);
      L.marker(center, {
        icon: divIcon(floodCalloutHtml(f), 130, 36, 65, 18, "cmd-flood-icon"),
        interactive: false,
      }).addTo(groups[key]);
    }

    for (const w of layers.windZones || []) {
      const key = windLayerKey(w);
      if (!isVisible(key) || !w.ring?.length) continue;
      const latlngs = w.ring.map(([lon, lat]) => [lat, lon]);
      L.polygon(latlngs, {
        color: w.stroke || "#a855f7",
        fillColor: w.fill || "#a855f7",
        fillOpacity: w.opacity || 0.25,
        weight: 1.5,
        dashArray: "4 2",
      }).addTo(groups[key]);
      const label = esc(w.label?.text || (w.gustMph != null ? `${w.gustMph}mph` : w.name || ""));
      if (label) {
        L.marker(ringCenter(w.ring), {
          icon: divIcon(`<div class="cmd-wind-label" style="color:${w.stroke || "#a855f7"}">${label}</div>`, 60, 14, 30, 7),
          interactive: false,
        }).addTo(groups[key]);
      }
    }

    for (const c of layers.corridors || []) {
      if (!isVisible("corridors") || !c.coords?.length) continue;
      const latlngs = c.coords.map(([lon, lat]) => [lat, lon]);
      const width = c.svg?.width || (c.status === "closed" ? 5 : 4);
      L.polyline(latlngs, {
        color: c.color || "#ffb347",
        weight: width,
        opacity: 0.95,
        dashArray: c.status === "restricted" ? "8 4" : c.status === "closed" ? "4 4" : null,
      }).addTo(groups.corridors);
      const mid = lineMidpoint(c.coords);
      L.marker(mid, {
        icon: divIcon(corridorLabelHtml(c), 100, c.atRiskTrips ? 38 : 26, 50, 13, "cmd-corridor-icon"),
        interactive: false,
      }).addTo(groups.corridors);
    }

    for (const t of layers.trips || []) {
      if (!isVisible("trips") || t.lat == null) continue;
      const rank = t.rank ?? ranks?.[t.id];
      if (layers.syncSource !== "triage" && !t.atRisk && !rank) continue;
      const h = t.cadRunId && (t.atRisk || rank) ? 44 : rank ? 32 : 24;
      L.marker([t.lat, t.lon], {
        icon: divIcon(tripHtml(t, rank), 80, h, 40, h / 2 + 4, "cmd-trip-icon"),
        interactive: false,
      }).addTo(groups.trips);
    }

    for (const f of layers.facilities || []) {
      const key = facilityLayerKey(f.role);
      if (!isVisible(key) || f.lat == null) continue;
      L.marker([f.lat, f.lon], {
        icon: divIcon(facilityHtml(f), FACILITY_W, FACILITY_H, FACILITY_W / 2, FACILITY_ANCHOR_Y, "cmd-facility-icon"),
        interactive: false,
      }).addTo(groups[key]);
    }

    for (const u of layers.cadUnits || []) {
      if (!isVisible("cad") || u.lat == null) continue;
      L.marker([u.lat, u.lon], {
        icon: divIcon(cadUnitHtml(u), 36, 36, 18, 18, "cmd-cad-icon"),
        interactive: false,
      }).addTo(groups.cad);
    }

    for (const u of layers.publicSafetyUnits || []) {
      const key = u.agency === "fire" ? "fire" : "police";
      if (!isVisible(key) || u.lat == null) continue;
      L.marker([u.lat, u.lon], {
        icon: divIcon(publicSafetyHtml(u), 56, 44, 28, 14, "cmd-psu-icon"),
        interactive: false,
      }).addTo(groups[key]);
    }

    syncLayerVisibility(isVisible);
    for (const key of ["corridors", "trips", "cad", "fire", "police", "hospital-public", "hospital-private", "nemt"]) {
      groups[key]?.bringToFront?.();
    }
    setTimeout(() => map.invalidateSize(), 0);
  }

  function syncVisibility(isVisible) {
    syncLayerVisibility(isVisible);
  }

  function resetView() {
    if (map) map.fitBounds(ISLAND_BOUNDS, { padding: [10, 10] });
  }

  function invalidateSize() {
    if (map) map.invalidateSize();
  }

  window.CommandMap = { init, render, resetView, invalidateSize, syncVisibility };
})();
