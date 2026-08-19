#!/usr/bin/env node
/** Free port 8787 (Climate Ops dev server). */
import { execSync } from "child_process";

const isWin = process.platform === "win32";

try {
  if (isWin) {
    const out = execSync('netstat -ano | findstr :8787 | findstr LISTENING', { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/\s(\d+)\s*$/);
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
      console.log(`Stopped PID ${pid} on port 8787`);
    }
    if (!pids.size) console.log("Port 8787 is free");
  } else {
    execSync("lsof -ti :8787 | xargs -r kill -9", { stdio: "inherit", shell: true });
  }
} catch {
  console.log("Port 8787 is free");
}
