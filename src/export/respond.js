import { wrapBriefingHtml } from "./briefing-shell.js";

export function parseExportFormat(req, defaultFormat = "json") {
  return String(req.query.format || defaultFormat).toLowerCase();
}

/** Send JSON by default; HTML/text when ?format=html|text (human briefing exports). */
export function respondExport(req, res, data, { formatText, pageTitle, subtitle }) {
  const format = parseExportFormat(req);
  if (format === "json") {
    res.json(data);
    return;
  }
  const text = formatText(data);
  if (format === "text") {
    res.type("text/plain; charset=utf-8").send(text);
    return;
  }
  const qs = new URLSearchParams(req.query);
  qs.set("format", "json");
  const jsonHref = `?${qs.toString()}`;
  res.type("text/html; charset=utf-8").send(
    wrapBriefingHtml({
      pageTitle: pageTitle || "Climate & Crisis Ops Command",
      subtitle: subtitle || "",
      text,
      jsonHref,
    })
  );
}
