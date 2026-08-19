export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtBriefingTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

export function section(lines, title) {
  lines.push("");
  lines.push(title);
  lines.push("-".repeat(Math.min(title.length, 72)));
}

export function bullet(lines, text, indent = 0) {
  if (text == null || text === "") return;
  lines.push(`${"  ".repeat(indent)}• ${text}`);
}

export function corridorStatusLabel(status) {
  if (status === "closed") return "CLOSED";
  if (status === "restricted") return "RESTRICTED";
  return "OPEN";
}

export function exportFooter(lines, jsonHint = "append ?format=json to this URL") {
  lines.push("");
  lines.push(`Machine-readable JSON: ${jsonHint}.`);
}

export function wrapBriefingHtml({ pageTitle, subtitle, text, jsonHref }) {
  const title = pageTitle || "Climate & Crisis Ops Command";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(subtitle ? `${title} · ${subtitle}` : title)}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      max-width: 46rem;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 2.5rem;
      background: #0b1118;
      color: #e8edf2;
      line-height: 1.55;
    }
    h1 { font-size: 1.15rem; font-weight: 700; color: #ffc72c; margin: 0 0 0.25rem; }
    .subtitle { color: #8fa3b8; font-size: 0.88rem; margin-bottom: 1.25rem; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "Cascadia Code", "Consolas", monospace;
      font-size: 0.82rem;
      background: #121a22;
      border: 1px solid #2a3a48;
      border-radius: 8px;
      padding: 1rem 1.1rem;
      margin: 0;
    }
    .actions { margin-top: 1rem; font-size: 0.8rem; color: #8fa3b8; }
    .actions a { color: #00abc9; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
  <pre>${escapeHtml(text)}</pre>
  <p class="actions">Copy the briefing above into stand-up notes, email, or ICS forms.${
    jsonHref ? ` <a href="${escapeHtml(jsonHref)}">JSON export</a> for integrations.` : ""
  }</p>
</body>
</html>`;
}

export function wrapTextExport({ title, subtitle, bodyLines, scopeGuard, disclaimer, jsonHint }) {
  const lines = ["CLIMATE & CRISIS OPS COMMAND", title];
  if (subtitle) lines.push(subtitle);
  lines.push(...bodyLines);
  if (scopeGuard) {
    section(lines, "Scope");
    lines.push(scopeGuard);
  }
  if (disclaimer) {
    section(lines, "Disclaimer");
    lines.push(disclaimer);
  }
  exportFooter(lines, jsonHint);
  return lines.join("\n");
}
