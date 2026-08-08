/** Day 19 — staging deploy checklist + smoke-test helpers. */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { loadScenarios } from "../eval/index.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function buildDeployChecklist(baseUrl = `http://127.0.0.1:${config.port}`) {
  const checks = [];

  const fileOk = (name, relPath) => {
    const full = path.join(root, relPath);
    const ok = fs.existsSync(full);
    checks.push({ name, ok, detail: ok ? relPath : `missing: ${relPath}` });
    return ok;
  };

  fileOk("dockerfile", "Dockerfile");
  fileOk("staging_env_example", ".env.staging.example");
  fileOk("sop_corpus", "docs/sops");
  fileOk("eval_scenarios", "data/eval/scenarios.json");
  fileOk("backup_script", "docs/backup-demo-video.md");
  fileOk("staging_guide", "docs/staging-deploy.md");

  let scenarioCount = 0;
  try {
    scenarioCount = loadScenarios().length;
    checks.push({ name: "eval_scenario_count", ok: scenarioCount >= 8, detail: `${scenarioCount} scenarios` });
  } catch (err) {
    checks.push({ name: "eval_scenario_count", ok: false, detail: err.message });
  }

  checks.push({
    name: "demo_mode_recommended",
    ok: true,
    detail: config.demoMode
      ? "DEMO_MODE=true — good for staging"
      : "DEMO_MODE=false — set true on staging unless LLM keys configured",
  });

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok);

  return {
    ok: failed.length === 0,
    phase: "week-3-day-19",
    baseUrl,
    demoMode: config.demoMode,
    port: config.port,
    summary: `${passed}/${checks.length} deploy checks passed`,
    checks,
    smokeTest: {
      health: `${baseUrl}/api/health`,
      pipeline: `curl.exe -X POST ${baseUrl}/api/orchestrator/run`,
      ui: baseUrl,
    },
    docs: {
      staging: "docs/staging-deploy.md",
      backupVideo: "docs/backup-demo-video.md",
      capture2min: "docs/demo-2min-capture.md",
    },
    docker: {
      build: "docker build -t ccoc:staging .",
      run: "docker run --rm -p 8787:8787 -e DEMO_MODE=true ccoc:staging",
    },
  };
}
