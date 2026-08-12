import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const defaultPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/audit-trail.jsonl"
);

export function getAuditStorePath() {
  return process.env.AUDIT_PERSIST_PATH || defaultPath;
}

export function isAuditPersistEnabled() {
  return process.env.AUDIT_PERSIST !== "false";
}

/** Load persisted entries (newest first) and restore sequence counter. */
export function loadPersistedAuditState() {
  const storePath = getAuditStorePath();
  if (!isAuditPersistEnabled() || !fs.existsSync(storePath)) {
    return { entries: [], seq: 0, storePath, enabled: isAuditPersistEnabled(), loaded: 0 };
  }

  const raw = fs.readFileSync(storePath, "utf8").trim();
  if (!raw) {
    return { entries: [], seq: 0, storePath, enabled: true, loaded: 0 };
  }

  const lines = raw.split("\n").filter(Boolean);
  const entries = [];
  let seq = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const rec = JSON.parse(lines[i]);
      entries.push(rec);
      if (rec.id?.startsWith("AUD-")) {
        const n = Number.parseInt(rec.id.slice(4), 10);
        if (Number.isFinite(n) && n > seq) seq = n;
      }
    } catch {
      /* skip malformed line */
    }
  }

  return { entries, seq, storePath, enabled: true, loaded: entries.length };
}

/** Append one audit record to JSONL store (append-only). */
export function appendPersistedAuditEntry(record) {
  if (!isAuditPersistEnabled()) {
    return { ok: false, reason: "disabled" };
  }

  const storePath = getAuditStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.appendFileSync(storePath, `${JSON.stringify(record)}\n`, "utf8");

  return {
    ok: true,
    path: storePath,
    id: record.id,
    persistedAt: new Date().toISOString(),
  };
}

export function getAuditPersistStatus(entryCount = 0) {
  const storePath = getAuditStorePath();
  const enabled = isAuditPersistEnabled();
  let fileBytes = 0;
  let fileLines = 0;
  let lastModified = null;

  if (enabled && fs.existsSync(storePath)) {
    const stat = fs.statSync(storePath);
    fileBytes = stat.size;
    lastModified = stat.mtime.toISOString();
    const raw = fs.readFileSync(storePath, "utf8").trim();
    fileLines = raw ? raw.split("\n").length : 0;
  }

  return {
    enabled,
    storePath,
    memoryEntryCount: entryCount,
    fileEntryCount: fileLines,
    fileBytes,
    lastModified,
    format: "jsonl",
    phase: "phase-2-day-8",
  };
}
