/** Derive CCOC escalation level + label from live NHC RSS outlook text. */

const LEVEL_LABELS = {
  1: "Monitor",
  2: "Prepare",
  3: "Restrict",
  4: "Recover",
};

const BAHAMAS_PATTERN =
  /\b(bahamas|new providence|nassau|paradise island|caribbean sea|gulf of america|lesser antilles|turks and caicos|cabo verde islands)\b/i;

function normalizeText(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

/** Strip WMO/product headers and return the readable outlook body (preview cap applied in UI). */
export function extractOutlookExcerpt(summary = "", maxLen = 320) {
  let text = normalizeText(summary);
  text = text.replace(/^\d+\s+[A-Z]{4}\d+\s+[A-Z]{4}\s+\d+\s+TWOAT\s+/i, "");
  text = text.replace(
    /Tropical Weather Outlook NWS National Hurricane Center Miami FL [^.]+\.\s*/i,
    ""
  );
  text = text.replace(/^For the North Atlantic[^:]*:\s*/i, "");

  const activeIdx = text.search(/Active Systems:/i);
  if (activeIdx >= 0) {
    text = text.slice(activeIdx).replace(/^Active Systems:\s*/i, "Active systems — ");
  }

  text = text.replace(/\$\$.*$/, "").trim();
  const cleaned = text || normalizeText(summary);
  if (!maxLen || cleaned.length <= maxLen) return cleaned;
  return truncateAtWord(cleaned, maxLen);
}

function truncateAtWord(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxLen * 0.55 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

function formationHighlights(text) {
  const highlights = [];
  const blockRe = /\((AL\d+|Invest [A-Z0-9-]+)\):[^*]*\* Formation chance through 48 hours\.\.\.([^*]+)\*/gi;
  let match;
  while ((match = blockRe.exec(text))) {
    highlights.push({
      id: match[1],
      chance48h: match[2].trim(),
    });
  }
  return highlights;
}

function activeNamedStorms(text) {
  const storms = [];
  const re =
    /advisories on (?:Hurricane|Tropical Storm|Post-Tropical Cyclone|Potential Tropical Cyclone) ([A-Z][a-z]+)/gi;
  let match;
  while ((match = re.exec(text))) {
    storms.push(match[1]);
  }
  return [...new Set(storms)];
}

/**
 * Map NHC outlook language to CCOC SOP escalation level (1–4).
 * Returns level, label, rationale, and display helpers for UI + agents.
 */
export function classifyNhcOutlook({ headline = "", summary = "", serviceArea = "" } = {}) {
  const text = normalizeText(`${headline}. ${summary}`);
  const lower = text.toLowerCase();
  const nearServiceArea = BAHAMAS_PATTERN.test(text) || /northwest bahamas|nw bahamas/i.test(text);

  let score = 1;
  const rationale = [];

  if (/hurricane warning|tropical storm warning/.test(lower)) {
    score = Math.max(score, nearServiceArea ? 4 : 3);
    rationale.push("tropical/hurricane warning language in NHC feed");
  } else if (/hurricane watch|tropical storm watch/.test(lower)) {
    score = Math.max(score, nearServiceArea ? 3 : 2);
    rationale.push("watch issued in NHC feed");
  }

  const bahamasDirect = /\b(bahamas|new providence|nassau|northwest bahamas|nw bahamas|paradise island)\b/i.test(
    text
  );

  if (/issuing advisories on (?:hurricane|tropical storm)/i.test(text)) {
    score = Math.max(score, bahamasDirect ? 3 : 2);
    rationale.push(
      bahamasDirect
        ? "NHC advisories on named cyclone affecting Bahamas service area"
        : "NHC advisories on named cyclone in Atlantic basin"
    );
  }

  const highFormation = [...text.matchAll(/formation chance through 48 hours\.\.\.(high[^*]*)/gi)];
  const mediumFormation = [...text.matchAll(/formation chance through 48 hours\.\.\.(medium[^*]*)/gi)];
  if (highFormation.length && nearServiceArea) {
    score = Math.max(score, 2);
    rationale.push(`${highFormation.length} high 48h formation area(s) near Caribbean/Bahamas`);
  } else if (highFormation.length) {
    score = Math.max(score, 2);
    rationale.push(`${highFormation.length} high 48h formation area(s) in Atlantic basin`);
  } else if (mediumFormation.length && nearServiceArea) {
    score = Math.max(score, 2);
    rationale.push("medium 48h formation chance near Caribbean/Bahamas");
  }

  if (/potential tropical cyclone/.test(lower)) {
    score = Math.max(score, 2);
    rationale.push("potential tropical cyclone mentioned");
  }

  if (/post-tropical|remnants of|dissipated/.test(lower) && score <= 2) {
    score = 1;
    rationale.push("post-tropical/dissipating systems — monitor only");
  }

  const level = Math.min(Math.max(score, 1), 4);
  const label = LEVEL_LABELS[level];
  const storms = activeNamedStorms(text);
  const formations = formationHighlights(text);
  const outlookExcerpt = extractOutlookExcerpt(summary);

  let displayEvent = headline || "Atlantic Tropical Weather Outlook";
  if (storms.length || formations.length) {
    const parts = [];
    if (storms.length) parts.push(`TS ${storms.join(", ")} active`);
    const topInvest = formations.find((f) => /high/i.test(f.chance48h));
    if (topInvest) parts.push(`${topInvest.id} ${topInvest.chance48h}`);
    if (parts.length) displayEvent = `Atlantic Outlook — ${parts.join(" · ")}`;
  }

  return {
    level,
    label,
    rationale: rationale.length ? rationale.join("; ") : "baseline Atlantic outlook — monitor",
    outlookExcerpt,
    displayEvent,
    activeSystems: storms,
    formationHighlights: formations,
    nearServiceArea,
    serviceArea,
    escalationSource: "nhc_live",
  };
}

export function applyNhcEscalation(weather, { serviceArea } = {}) {
  if (!weather?.summary && !weather?.event) return weather;

  const escalation = classifyNhcOutlook({
    headline: weather.event,
    summary: weather.summary,
    serviceArea,
  });

  return {
    ...weather,
    level: escalation.level,
    label: escalation.label,
    event: escalation.displayEvent,
    nhcHeadline: weather.event,
    outlookExcerpt: escalation.outlookExcerpt,
    escalationSource: escalation.escalationSource,
    escalationRationale: escalation.rationale,
    activeSystems: escalation.activeSystems,
    formationHighlights: escalation.formationHighlights,
    nearServiceArea: escalation.nearServiceArea,
  };
}
