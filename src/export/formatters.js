import {
  bullet,
  corridorStatusLabel,
  exportFooter,
  fmtBriefingTime,
  section,
  wrapBriefingHtml,
} from "./briefing-shell.js";

function headerLines(title, data, extra = []) {
  const lines = ["CLIMATE & CRISIS OPS COMMAND", title];
  lines.push(`Generated: ${fmtBriefingTime(data.generatedAt || new Date().toISOString())}`);
  if (data.level != null) lines.push(`Level: L${data.level}`);
  if (data.phase) lines.push(`Phase: ${data.phase}`);
  lines.push(...extra.filter(Boolean));
  return lines;
}

function appendCopSections(lines, data) {
  const sit = data.situation || {};
  section(lines, "Situation");
  bullet(lines, `Event: ${sit.event || "—"}`);
  bullet(lines, `Status: ${sit.label || "—"}`);
  bullet(lines, `Service area: ${sit.serviceArea || "—"}`);

  const corridors = data.corridors || {};
  const corridorIds = Object.keys(corridors);
  if (corridorIds.length) {
    section(lines, "Corridors");
    for (const id of corridorIds) {
      bullet(lines, `${id}: ${corridorStatusLabel(corridors[id])}`);
    }
  }

  const ps = data.publicSafety || {};
  if (ps.unitCount) {
    section(lines, "Public safety (read-only EOC feed)");
    bullet(lines, `${ps.fireCount ?? 0} fire · ${ps.policeCount ?? 0} police units`);
    for (const u of (ps.units || []).slice(0, 6)) {
      bullet(
        lines,
        `${u.unitId} (${u.agency}) — ${u.status || "—"}${u.corridor ? ` · ${u.corridor}` : ""}`,
        1
      );
    }
    if ((ps.units || []).length > 6) bullet(lines, `… +${ps.units.length - 6} more`, 1);
  }

  const cad = data.nemtCad || {};
  if (cad.runCount != null) {
    section(lines, "NEMT / CAD");
    bullet(lines, `CAD runs: ${cad.runCount ?? "—"}`);
    bullet(lines, `At-risk CAD matches: ${cad.atRiskMatched ?? "—"}`);
    bullet(lines, `Live-linked at-risk trips: ${cad.cadLinkedAtRisk ?? "—"}`);
  }

  const desk = data.transportDesk || {};
  if (desk.bedPressure || desk.pendingHandoffs != null) {
    section(lines, "Transport desk");
    for (const h of (desk.bedPressure || []).slice(0, 4)) {
      bullet(
        lines,
        `${h.name || h.facilityId}: beds ${h.bedPressurePct ?? "?"}% (${h.bedPressureLevel || "—"})${
          h.diversionStatus && h.diversionStatus !== "open" ? ` · diversion ${h.diversionStatus}` : ""
        }`
      );
    }
    bullet(lines, `Pending EMS→NEMT handoffs: ${desk.pendingHandoffs ?? "—"}`);
    bullet(lines, `Assigned / accepted: ${desk.assignedHandoffs ?? "—"}`);
  }

  const flood = data.floodHazard || {};
  if (flood.activeZoneCount) {
    section(lines, "Flood hazard");
    bullet(lines, `${flood.activeZoneCount} active zone(s) · ${flood.tripExposureCount ?? 0} trip exposure(s)`);
    for (const z of (flood.zoneMatches || []).slice(0, 4)) {
      bullet(lines, `${z.zoneId || "zone"} · corridor ${(z.linkedCorridors || [])[0] || "—"}`, 1);
    }
  }

  const wind = data.windHazard || {};
  if (wind.activeZoneCount) {
    section(lines, "Wind hazard");
    bullet(lines, `${wind.activeZoneCount} active zone(s) · ${wind.tripExposureCount ?? 0} trip exposure(s)`);
  }

  const fusion = data.multiHazard || {};
  if (fusion.fusedTripCount) {
    section(lines, "Multi-hazard fused trips");
    bullet(lines, `${fusion.fusedTripCount} fused · ${fusion.criticalTripCount ?? 0} critical · ${fusion.highTripCount ?? 0} high`);
    for (const t of (fusion.tripBriefings || []).slice(0, 5)) {
      bullet(
        lines,
        `${t.tripId} · ${t.corridor || "—"} · ${t.compositeRisk || "—"}${
          t.briefingLine ? ` — ${t.briefingLine}` : ""
        }`
      );
    }
  }

  const routing = data.routingPreview || {};
  if (routing.tripAdvisoryCount) {
    section(lines, "Routing advisories");
    bullet(lines, `${routing.tripAdvisoryCount} trip advisory(ies) · ${routing.corridorAdvisoryCount ?? 0} corridor advisory(ies)`);
    for (const a of (routing.tripAdvisories || []).slice(0, 5)) {
      bullet(lines, `${a.tripId} · ${a.corridor} → alt ${a.alternateName || a.alternateRouteId || "—"}`, 1);
    }
  }
}

export function formatCopExportText(cop) {
  const lines = headerLines("COMMON OPERATING PICTURE (COP)", cop);
  appendCopSections(lines, cop);
  section(lines, "Scope");
  lines.push(cop.scopeGuard || "Read-only situational feeds — not dispatch authority.");
  section(lines, "Disclaimer");
  lines.push(cop.disclaimer || "Synthetic demo COP — not authoritative for dispatch.");
  exportFooter(lines);
  return lines.join("\n");
}

export function formatMultiFeedSourcesText(data) {
  const lines = headerLines("MULTI-FEED SIGNAL SOURCES", data);
  section(lines, "Sources");
  for (const s of data.sources || []) {
    bullet(lines, `${s.label || s.id}${s.active === false ? " (inactive)" : ""}`);
  }
  section(lines, "Configuration");
  bullet(lines, `Live weather feed: ${data.liveWeather ? "yes" : "no"}`);
  bullet(lines, `NHC feed URL: ${data.nhcFeedUrl || "not configured"}`);
  bullet(lines, `Institutional feed URL: ${data.institutionalFeedUrl || "not configured"}`);
  bullet(lines, `Institutional feed path: ${data.institutionalFeedPath || "—"}`);
  if (data.ingestedAt) bullet(lines, `Last ingest: ${fmtBriefingTime(data.ingestedAt)}`);
  section(lines, "Scope");
  lines.push(data.scopeGuard || "Multi-feed ingest — situational only.");
  exportFooter(lines);
  return lines.join("\n");
}

export function formatSopCorpusText(data) {
  const lines = headerLines("OPERATOR SOP CORPUS", data, [data.headline]);
  section(lines, "Corpus");
  bullet(lines, `${data.fileCount ?? 0} file(s) · ${data.chunkCount ?? 0} chunk(s)`);
  bullet(lines, `Search mode: ${data.searchMode || data.mode || "keyword"}`);
  bullet(lines, `Semantic search: ${data.semanticEnabled ? "enabled" : "disabled"}`);
  section(lines, "SOP documents");
  for (const f of (data.files || []).slice(0, 20)) {
    bullet(lines, `${f.sopId || "SOP"} — ${f.file || "—"}`);
  }
  if ((data.files || []).length > 20) bullet(lines, `… +${data.files.length - 20} more`);
  section(lines, "Scope");
  lines.push(data.scopeGuard || "SOP corpus — citations in audit; not auto-dispatch.");
  exportFooter(lines);
  return lines.join("\n");
}

export function formatRoutingPreviewText(data) {
  const lines = headerLines("CORRIDOR ROUTING PREVIEW", data, [data.headline]);
  section(lines, "Summary");
  bullet(lines, `${data.tripAdvisoryCount ?? 0} trip advisory(ies)`);
  bullet(lines, `${data.corridorAdvisoryCount ?? 0} corridor advisory(ies)`);
  bullet(lines, `${data.restrictedCorridorCount ?? 0} restricted corridor(s) · ${data.atRiskCount ?? 0} at-risk trip(s)`);
  bullet(lines, `${data.alternateRuleCount ?? 0} alternate rule(s) loaded`);
  if (data.tripAdvisories?.length) {
    section(lines, "Trip advisories");
    for (const a of data.tripAdvisories.slice(0, 10)) {
      bullet(
        lines,
        `${a.tripId} (${a.priority || "—"}) · ${a.pickup || "—"} → ${a.facility || "—"} · ${a.corridor} ${(a.corridorStatus || "").toUpperCase()}`
      );
      bullet(lines, `Alternate: ${a.alternateName || a.alternateRouteId || "—"} — ${a.advisory || ""}`, 1);
      if (a.sopRef) bullet(lines, `SOP: ${a.sopRef}`, 1);
    }
  }
  section(lines, "Scope");
  lines.push(data.scopeGuard || "Routing preview — advisory only.");
  exportFooter(lines);
  return lines.join("\n");
}

export function formatMultiHazardText(data) {
  const lines = headerLines("MULTI-HAZARD FUSION", data, [data.headline]);
  section(lines, "Summary");
  bullet(lines, `${data.fusedTripCount ?? 0} fused trip briefing(s)`);
  bullet(lines, `${data.criticalTripCount ?? 0} critical · ${data.highTripCount ?? 0} high`);
  bullet(lines, `Flood merge: ${data.floodMergeRule || "—"}`);
  if (data.floodBadgeLabel) bullet(lines, data.floodBadgeLabel);
  bullet(lines, `Agency flood trips: ${data.agencyFloodTripCount ?? "—"} · Model: ${data.modelFloodTripCount ?? "—"} · Commercial: ${data.commercialFloodTripCount ?? "—"}`);
  bullet(lines, `Wind zones: ${data.windActiveZones ?? "—"} · Flood zones: ${data.floodActiveZones ?? "—"}`);
  bullet(lines, `Routing advisories: ${data.routingTripAdvisories ?? "—"} · Avoidance routes: ${data.avoidanceRouteCount ?? "—"}`);

  if (data.tripBriefings?.length) {
    section(lines, "Fused trip briefings");
    for (const t of data.tripBriefings.slice(0, 12)) {
      bullet(
        lines,
        `${t.tripId} · ${t.priority || "—"} · ${t.corridor || "—"} · risk ${t.compositeRisk || "—"} · hazards: ${(t.hazardTypes || []).join("+") || "—"}`
      );
      if (t.briefingLine) bullet(lines, t.briefingLine, 1);
      if (t.floodExposure?.sourceLabel) {
        bullet(lines, `Flood source: ${t.floodExposure.sourceLabel}${t.floodExposure.depthInches ? ` · ${t.floodExposure.depthInches}"` : ""}`, 1);
      }
      if (t.routingAdvisory?.alternateName) {
        bullet(lines, `Routing alt: ${t.routingAdvisory.alternateName}`, 1);
      }
    }
    if (data.tripBriefings.length > 12) bullet(lines, `… +${data.tripBriefings.length - 12} more trips`);
  }

  section(lines, "Scope");
  lines.push(data.scopeGuard || "Hazard fusion — EOC briefing context only.");
  exportFooter(lines);
  return lines.join("\n");
}

export function formatSovereignDeployText(data) {
  const lines = headerLines("SOVEREIGN ON-PREM DEPLOY PROFILE", data, [data.headline, data.regionNote]);
  const passed = (data.checks || []).filter((c) => c.ok).length;
  const total = (data.checks || []).length;
  section(lines, "Readiness");
  bullet(lines, `${passed}/${total} checks passed · ${data.ok ? "READY" : "REVIEW REQUIRED"}`);
  for (const c of data.checks || []) {
    bullet(lines, `${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail || "—"}`);
  }
  const residency = data.dataResidency || {};
  if (Object.keys(residency).length) {
    section(lines, "Data residency");
    for (const [key, val] of Object.entries(residency)) {
      bullet(lines, `${key}: ${val}`);
    }
  }
  if (data.glofasAirGap) {
    section(lines, "GloFAS air-gap bundle");
    bullet(lines, `Clip ready: ${data.glofasAirGap.clipReady ? "yes" : "no"}`);
    bullet(lines, `Path: ${data.glofasAirGap.clipPath || "—"}`);
    bullet(lines, `Features: ${data.glofasAirGap.clipFeatureCount ?? "—"}`);
  }
  if (data.urbanFloodAirGap) {
    section(lines, "Urban flood air-gap bundle");
    bullet(lines, `Clip ready: ${data.urbanFloodAirGap.clipReady ? "yes" : "no"}`);
    bullet(lines, `Path: ${data.urbanFloodAirGap.clipPath || "—"}`);
    bullet(lines, `Features: ${data.urbanFloodAirGap.clipFeatureCount ?? "—"}`);
  }
  if (data.deploymentOptions?.length) {
    section(lines, "Deployment options");
    for (const opt of data.deploymentOptions) {
      bullet(lines, `${opt.label} — ${opt.bestFor || ""}`);
      if (opt.command) bullet(lines, opt.command, 1);
    }
  }
  section(lines, "Scope");
  lines.push(data.scopeGuard || "Sovereign deploy profile — operator-controlled hosting.");
  exportFooter(lines);
  return lines.join("\n");
}
