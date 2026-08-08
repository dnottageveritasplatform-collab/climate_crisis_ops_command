/**
 * Automated demo MP4 builder — screen capture + Bahamian-professional voiceover + music.
 * Output: docs/demo-backup-capture.mp4
 *
 * Usage: node scripts/build-demo-video.mjs
 * Requires: server running at http://127.0.0.1:8787 (DEMO_MODE=true recommended)
 */

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "video-build");
const FINAL_MP4 = path.join(ROOT, "docs", "demo-backup-capture.mp4");
const END_SCREEN = path.join(ROOT, "docs", "assets", "end-screen.png");
const MUSIC_SOURCE = path.join(ROOT, "docs", "assets", "demo-music-source.mp3");
const MUSIC_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";
const BASE_URL = process.env.DEMO_URL || "http://127.0.0.1:8787";

// en-GB-SoniaNeural: professional British English female — closest edge-tts match for
// formal Bahamian register (British-influenced Caribbean English).
const VOICE = "en-GB-SoniaNeural";
const VOICE_OPTS = { voice: VOICE, rate: "-4%", pitch: "+0Hz", volume: "+5%" };

const BEATS = [
  {
    id: "intro",
    durationSec: 18,
    text: "Climate and Crisis Ops Command — post-storm coordination for Caribbean NEMT and hospital partners. Three agencies on one surface: Nassau Metro, Princess Margaret, and Doctor's Hospital. Demo data — not nine-one-one CAD.",
    async run(page) {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
    },
  },
  {
    id: "pipeline",
    durationSec: 22,
    text: "Storm signal escalates to Level two Prepare. Clicking Run Pipeline now — Monitor, Triage, and Action execute in sequence. Agents cite operator SOPs via keyword RAG; ranks and map pins stay deterministic while the LLM enriches narrative drafts.",
    async run(page) {
      await page.click("#runPipeline");
      await page.waitForFunction(
        () => !document.getElementById("runPipeline")?.disabled,
        { timeout: 120000 }
      );
      await page.waitForTimeout(800);
    },
  },
  {
    id: "map",
    durationSec: 20,
    text: "Thin GIS layer with facility pins, at-risk trips, and corridor status synced to triage output. CORR-zero-two is restricted. Hospital pins and numbered P-one dialysis trips reflect live triage ranking — no manual pin placement.",
    async run(page) {
      const host = page.locator("#mapScrollHost");
      await host.hover();
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 80);
        await page.waitForTimeout(350);
      }
      await page.waitForTimeout(600);
    },
  },
  {
    id: "triage-action",
    durationSec: 22,
    segments: [
      {
        durationSec: 11,
        text: "Opening the Triage tab — P-one trips ranked across both hospital partners, corridor conflicts flagged, sync badge confirms map alignment.",
      },
      {
        durationSec: 11,
        text: "Switching to Action — COMMS-zero-three bulletins per partner, dispatch checklist, and driver SMS drafts. Everything is draft; nothing auto-sends.",
      },
    ],
    async run(page) {
      await page.click("#tabTriage");
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        const el = document.getElementById("opsPanelBody");
        if (el) el.scrollTop = el.scrollHeight / 3;
      });
      await page.waitForTimeout(800);
      await page.click("#tabAction");
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        const el = document.getElementById("opsPanelBody");
        if (el) el.scrollTop = el.scrollHeight / 2;
      });
      await page.waitForTimeout(800);
    },
  },
  {
    id: "hitl",
    durationSec: 28,
    segments: [
      {
        durationSec: 9,
        text: "Triple human-in-the-loop gate. Maria Clarke, NEMT Dispatch Supervisor, opens the COMMS-zero-three review and approves.",
      },
      {
        durationSec: 9,
        text: "James Rolle, Transport Coordinator at Princess Margaret Hospital, reviews the bulletin draft and signs off.",
      },
      {
        durationSec: 10,
        text: "Doctor Elaine Moss completes the third approval for Doctor's Hospital — multi-agency SOP enforced before any release.",
      },
    ],
    async run(page) {
      const roles = [
        { review: "#btnNemtReview", approve: "#btnNemtApprove" },
        { review: "#btnPmhReview", approve: "#btnPmhApprove" },
        { review: "#btnDoctorsReview", approve: "#btnDoctorsApprove" },
      ];
      for (const r of roles) {
        await page.locator(r.review).click({ timeout: 15000 });
        await page.waitForSelector("#hitlModal.open", { timeout: 10000 });
        await page.waitForTimeout(600);
        await page.click("#hitlModalApprove");
        await page.waitForFunction(
          () => !document.getElementById("hitlModal")?.classList.contains("open"),
          { timeout: 10000 }
        );
        await page.waitForTimeout(500);
      }
    },
  },
  {
    id: "audit",
    durationSec: 18,
    text: "Audit trail panel — pipeline run logged with step timestamps, SOP citations pulled from the operator corpus, and named approvers recorded for each HITL role. Audit-first by design.",
    async run(page) {
      await page.evaluate(() => {
        const list = document.getElementById("auditTrailList");
        if (list) list.scrollTop = 0;
      });
      await page.waitForTimeout(800);
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          const list = document.getElementById("auditTrailList");
          if (list) list.scrollTop += 120;
        });
        await page.waitForTimeout(500);
      }
    },
  },
  {
    id: "proof",
    durationSec: 20,
    text: "Eight scripted storm scenarios pass in demo mode with zero tokens. The triple-approval banner confirms release clearance. Tool-first agents with optional LLM enrichment — ranks, map sync, and HITL gates remain rule-based.",
    async run(page) {
      await page.click("#tabMonitor");
      await page.waitForTimeout(1000);
      const released = page.locator("#hitlReleasedBanner");
      if (await released.isVisible()) {
        await released.scrollIntoViewIfNeeded();
      }
      await page.waitForTimeout(1500);
    },
  },
  {
    id: "close",
    durationSec: 14,
    text: "Veritas-powered crisis ops for operators and hospital-adjacent partners after weather events. KnightRoad Veritas — empower your business with predictive analytics.",
    async run(page) {
      await page.waitForTimeout(2000);
    },
  },
];

function ttsSave(text, file, options = {}) {
  const { voice = VOICE, rate = "-4%" } = options;
  execFileSync(
    "py",
    ["-m", "edge_tts", "--voice", voice, "--rate", rate, "--text", text, "--write-media", file],
    { stdio: "inherit" }
  );
}

const END_SCREEN_SEC = 5;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    proc.on("error", reject);
  });
}

function ff(args) {
  execFileSync("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
}

function probeDuration(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
    { encoding: "utf8" }
  );
  return parseFloat(out.trim());
}

/** Pad or slightly speed up a clip so it exactly fills the beat window. */
function fitSegmentToDuration(inputPath, targetSec, outputPath) {
  const dur = probeDuration(inputPath);
  if (dur > targetSec + 0.15) {
    const tempo = Math.min(2, dur / targetSec);
    ff([
      "-y", "-i", inputPath,
      "-af", `atempo=${tempo.toFixed(4)}`,
      "-t", String(targetSec),
      "-c:a", "libmp3lame", "-q:a", "2",
      outputPath,
    ]);
  } else if (dur < targetSec - 0.05) {
    ff([
      "-y", "-i", inputPath,
      "-af", `apad=pad_dur=${(targetSec - dur).toFixed(3)}`,
      "-t", String(targetSec),
      "-c:a", "libmp3lame", "-q:a", "2",
      outputPath,
    ]);
  } else {
    ff(["-y", "-i", inputPath, "-t", String(targetSec), "-c:a", "libmp3lame", "-q:a", "2", outputPath]);
  }
}

function beatSegments(beat) {
  if (beat.segments?.length) return beat.segments;
  return [{ text: beat.text, durationSec: beat.durationSec }];
}

async function ensureServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (res.ok) return;
  } catch {
    /* start below */
  }
  console.log("Starting server (DEMO_MODE=true)…");
  const child = spawn("node", ["src/server.js"], {
    cwd: ROOT,
    env: { ...process.env, DEMO_MODE: "true", PORT: "8787" },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        console.log("Server ready.");
        return child;
      }
    } catch {
      /* retry */
    }
  }
  throw new Error("Server did not start in time — run npm start first.");
}

async function generateVoiceover() {
  const voDir = path.join(OUT_DIR, "voice");
  fs.mkdirSync(voDir, { recursive: true });
  const fittedSegments = [];
  let segIdx = 0;

  for (const beat of BEATS) {
    for (const seg of beatSegments(beat)) {
      const rawPath = path.join(voDir, `${String(segIdx).padStart(2, "0")}-${beat.id}-raw.mp3`);
      const fitPath = path.join(voDir, `${String(segIdx).padStart(2, "0")}-${beat.id}.mp3`);
      console.log(`TTS [${beat.id}] ${seg.durationSec}s window…`);
      await ttsSave(seg.text, rawPath, VOICE_OPTS);
      fitSegmentToDuration(rawPath, seg.durationSec, fitPath);
      fittedSegments.push(fitPath);
      segIdx++;
    }
  }

  const listPath = path.join(voDir, "concat.txt");
  fs.writeFileSync(
    listPath,
    fittedSegments.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n")
  );

  const screenDur = BEATS.reduce((s, b) => s + b.durationSec, 0);
  const voPadded = path.join(voDir, "voiceover.mp3");
  ff(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:a", "libmp3lame", "-q:a", "2", voPadded]);

  const voDur = probeDuration(voPadded);
  console.log(`Voiceover duration: ${voDur.toFixed(1)}s (target ${screenDur}s)`);
  return { voPadded, screenDur };
}

function ensureMusicSource() {
  fs.mkdirSync(path.dirname(MUSIC_SOURCE), { recursive: true });
  if (fs.existsSync(MUSIC_SOURCE) && fs.statSync(MUSIC_SOURCE).size > 100_000) {
    return MUSIC_SOURCE;
  }
  console.log("  Downloading upbeat background track…");
  execFileSync(
    "curl.exe",
    ["-sL", "-o", MUSIC_SOURCE, MUSIC_URL],
    { stdio: "inherit" }
  );
  if (!fs.existsSync(MUSIC_SOURCE) || fs.statSync(MUSIC_SOURCE).size < 100_000) {
    throw new Error("Failed to download background music — check network or place MP3 at docs/assets/demo-music-source.mp3");
  }
  return MUSIC_SOURCE;
}

function generateBackgroundMusic(durationSec) {
  const src = ensureMusicSource();
  const bgPath = path.join(OUT_DIR, "background.mp3");
  const fadeOut = Math.max(0, durationSec - 4);

  console.log(`  Looping real music track to ${durationSec}s…`);
  ff([
    "-y",
    "-stream_loop", "-1",
    "-i", src,
    "-af", `afade=t=in:st=0:d=2,afade=t=out:st=${fadeOut}:d=4`,
    "-t", String(durationSec),
    "-c:a", "libmp3lame", "-q:a", "2",
    bgPath,
  ]);
  return bgPath;
}

function mixAudio(voPath, bgPath, durationSec) {
  const mixed = path.join(OUT_DIR, "mixed-audio.m4a");
  // No sidechain — music stays clearly audible; voice sits on top via weights + loudnorm
  ff([
    "-y",
    "-i", voPath,
    "-i", bgPath,
    "-filter_complex",
    [
      `[0:a]aresample=44100,apad=whole_dur=${durationSec},volume=1.0[voice]`,
      "[1:a]aresample=44100,volume=0.55[music]",
      "[voice][music]amix=inputs=2:duration=longest:dropout_transition=0:weights=1.0 0.65",
      "loudnorm=I=-13:TP=-0.8:LRA=8[out]",
    ].join(","),
    "-map", "[out]",
    "-t", String(durationSec),
    "-c:a", "aac", "-b:a", "192k",
    mixed,
  ]);
  return mixed;
}

async function recordScreen() {
  const captureDir = path.join(OUT_DIR, "capture");
  fs.mkdirSync(captureDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: captureDir, size: { width: 1920, height: 1080 } },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log("Recording screen capture…");
  for (const beat of BEATS) {
    console.log(`  Beat: ${beat.id} (${beat.durationSec}s)`);
    const t0 = Date.now();
    await beat.run(page);
    const elapsed = (Date.now() - t0) / 1000;
    const remaining = beat.durationSec - elapsed;
    if (remaining > 0) await page.waitForTimeout(remaining * 1000);
  }

  const video = page.video();
  await context.close();
  await browser.close();

  const webmPath = await video.path();
  const screenMp4 = path.join(OUT_DIR, "screen.mp4");
  ff([
    "-y", "-i", webmPath,
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-an",
    screenMp4,
  ]);
  return screenMp4;
}

function buildEndScreenClip(musicTailPath) {
  const endClip = path.join(OUT_DIR, "end-screen.mp4");
  if (musicTailPath && fs.existsSync(musicTailPath)) {
    ff([
      "-y",
      "-loop", "1",
      "-i", END_SCREEN,
      "-i", musicTailPath,
      "-t", String(END_SCREEN_SEC),
      "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x070b0f",
      "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-shortest",
      endClip,
    ]);
  } else {
    ff([
      "-y",
      "-loop", "1",
      "-i", END_SCREEN,
      "-f", "lavfi",
      "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-t", String(END_SCREEN_SEC),
      "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x070b0f",
      "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-shortest",
      endClip,
    ]);
  }
  return endClip;
}

function assembleFinal(screenMp4, mixedAudio, screenDur, totalAudioDur) {
  const withAudio = path.join(OUT_DIR, "screen-with-audio.mp4");
  ff([
    "-y",
    "-i", screenMp4,
    "-i", mixedAudio,
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k",
    "-map", "0:v:0", "-map", "1:a:0",
    "-shortest",
    withAudio,
  ]);

  const endMusicTail = path.join(OUT_DIR, "end-music-tail.m4a");
  ff([
    "-y", "-i", mixedAudio,
    "-ss", String(Math.max(0, totalAudioDur - END_SCREEN_SEC)),
    "-t", String(END_SCREEN_SEC),
    "-c:a", "aac", "-b:a", "192k",
    endMusicTail,
  ]);

  const endClip = buildEndScreenClip(endMusicTail);
  const listPath = path.join(OUT_DIR, "final-concat.txt");
  fs.writeFileSync(
    listPath,
    [`file '${withAudio.replace(/\\/g, "/")}'`, `file '${endClip.replace(/\\/g, "/")}'`].join("\n")
  );

  ff([
    "-y", "-f", "concat", "-safe", "0", "-i", listPath,
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    FINAL_MP4,
  ]);

  const stat = fs.statSync(FINAL_MP4);
  const mb = (stat.size / (1024 * 1024)).toFixed(1);
  console.log(`\nDone: ${FINAL_MP4} (${mb} MB, ~${screenDur + END_SCREEN_SEC}s)`);
}

async function main() {
  if (!fs.existsSync(END_SCREEN)) {
    throw new Error(`End screen missing: ${END_SCREEN}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  await ensureServer();

  console.log("\n=== Phase 1: Voiceover ===");
  const voPath = path.join(OUT_DIR, "voice", "voiceover.mp3");
  let voPadded;
  let screenDur;
  if (process.env.SKIP_VOICE === "1" && fs.existsSync(voPath)) {
    console.log("  (reusing existing voiceover.mp3)");
    voPadded = voPath;
    screenDur = BEATS.reduce((s, b) => s + b.durationSec, 0);
  } else {
    ({ voPadded, screenDur } = await generateVoiceover());
  }

  console.log("\n=== Phase 2: Background music ===");
  const totalAudioDur = screenDur + END_SCREEN_SEC;
  const bgPath = generateBackgroundMusic(totalAudioDur);

  console.log("\n=== Phase 3: Mix audio ===");
  const mixedAudio = mixAudio(voPadded, bgPath, totalAudioDur);

  console.log("\n=== Phase 4: Screen capture ===");
  const screenMp4Path = path.join(OUT_DIR, "screen.mp4");
  const screenMp4 =
    process.env.SKIP_CAPTURE === "1" && fs.existsSync(screenMp4Path)
      ? (console.log("  (reusing existing screen.mp4)"), screenMp4Path)
      : await recordScreen();

  console.log("\n=== Phase 5: Assemble final MP4 ===");
  assembleFinal(screenMp4, mixedAudio, screenDur, totalAudioDur);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
