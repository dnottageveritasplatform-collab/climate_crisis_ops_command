import assert from "node:assert/strict";
import {
  buildEocAuditBriefing,
  formatEocAuditBriefingHtml,
  formatEocAuditBriefingText,
} from "../src/audit/eoc-export.js";

const briefing = await buildEocAuditBriefing({ level: 2, limit: 5 });
const text = formatEocAuditBriefingText(briefing);
const html = formatEocAuditBriefingHtml(briefing);

assert.ok(text.includes("EOC AUDIT BRIEFING"));
assert.ok(text.includes("Situation"));
assert.ok(text.includes("At a glance"));
assert.ok(text.includes("Scope"));
assert.ok(!text.startsWith("{"), "text export must not be raw JSON");

assert.ok(html.includes("<!DOCTYPE html>"));
assert.ok(html.includes("<pre>"));
assert.ok(html.includes(escapeForAssert(text.slice(0, 40))));

console.log("eoc-briefing-format.test.mjs OK");

function escapeForAssert(fragment) {
  return fragment.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
