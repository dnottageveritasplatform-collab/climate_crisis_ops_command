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
const VOICE_OPTS = { voice: VOICE, rate: "-6%", pitch: "+0Hz", volume: "+8%" };

const sleep = (page, ms) => page.waitForTimeout(ms);

async function setToggle(page, selector, on) {
  const btn = page.locator(selector);
  if (!(await btn.count())) return;
  const pressed = await btn.getAttribute("aria-pressed");
  if ((pressed === "true") !== on) await btn.click();
}

async function approveHitlRole(page, reviewSelector) {
  const btn = page.locator(reviewSelector);
  if (!(await btn.isEnabled())) return;
  await btn.click({ timeout: 15000 });
  await page.waitForSelector("#hitlModal.open", { timeout: 10000 });
  await sleep(page, 700);
  await page.click("#hitlModalApprove");
  await page.waitForFunction(
    () => !document.getElementById("hitlModal")?.classList.contains("open"),
    { timeout: 10000 }
  );
  await sleep(page, 400);
}

const BEATS = [
  {
    id: "intro",
    durationSec: 24,
    text: "Climate and Crisis Ops Command is built to save lives — by orchestrating emergency personnel across Nassau during a major weather event. One operator surface coordinates NEMT, hospitals, shelter, fleet, fire, and police so dialysis trips, corridors, and COMMS-zero-three bulletins stay in sync. Demo data — not nine-one-one CAD.",
    async run(page) {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await sleep(page, 1800);
    },
  },
  {
    id: "strips",
    durationSec: 28,
    segments: [
      {
        durationSec: 14,
        text: "Weather and transport-desk strips sit at the top — NHC alerts, hospital bed pressure, and EMS to NEMT handoffs in one glance.",
      },
      {
        durationSec: 14,
        text: "Operators toggle multi-feed signals, SOP corpus, GIS routing, hazard fusion, shelter and fleet, and the EOC overlay — each strip is live situational context, not a separate app.",
      },
    ],
    async run(page) {
      await setToggle(page, "#toggleScenarioStrip", true);
      await sleep(page, 1200);
      await setToggle(page, "#toggleSignalFeedStrip", true);
      await sleep(page, 1000);
      await setToggle(page, "#toggleSopCorpusStrip", true);
      await sleep(page, 900);
      await setToggle(page, "#toggleRoutingPreviewStrip", true);
      await sleep(page, 900);
      await setToggle(page, "#toggleMultiHazardStrip", true);
      await sleep(page, 900);
      await setToggle(page, "#toggleShelterFleetStrip", true);
      await sleep(page, 900);
      await setToggle(page, "#toggleEocStrip", true);
      await sleep(page, 1400);
      await setToggle(page, "#toggleSignalFeedStrip", false);
      await setToggle(page, "#toggleSopCorpusStrip", false);
      await setToggle(page, "#toggleRoutingPreviewStrip", false);
      await setToggle(page, "#toggleScenarioStrip", false);
      await setToggle(page, "#toggleShelterFleetStrip", false);
      await setToggle(page, "#toggleEocStrip", false);
    },
  },
  {
    id: "pipeline",
    durationSec: 24,
    text: "Level two Prepare. Clicking Run Pipeline — Monitor, Triage, and Action fire in sequence. Tools run first: signals, dispatch, flood stack, and SOP RAG. The LLM enriches narrative only; ranks and map pins stay deterministic.",
    async run(page) {
      await page.click("#runPipeline");
      await page.waitForFunction(
        () => !document.getElementById("runPipeline")?.disabled,
        { timeout: 120000 }
      );
      await sleep(page, 800);
    },
  },
  {
    id: "map",
    durationSec: 32,
    segments: [
      {
        durationSec: 16,
        text: "Command map of New Providence. Three flood layers: solid blue is agency confirmed, dashed is GloFAS river model, dotted violet is urban commercial pluvial. Agency GIS always wins on overlap.",
      },
      {
        durationSec: 16,
        text: "Wind gust bands, CAD units, fire and police from the EOC, ranked dialysis trips, and restricted corridors. Legend toggles each layer. Hazard fusion briefs trips that sit in more than one risk.",
      },
    ],
    async run(page) {
      const host = page.locator("#mapScrollHost");
      await host.hover();
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 90);
        await sleep(page, 280);
      }
      await sleep(page, 600);
      const legend = page.locator("#mapLegend");
      await legend.scrollIntoViewIfNeeded().catch(() => {});
      await page.locator('[data-layer="flood-glofas"]').click();
      await sleep(page, 700);
      await page.locator('[data-layer="flood-glofas"]').click();
      await sleep(page, 500);
      await page.locator('[data-layer="flood-commercial"]').click();
      await sleep(page, 700);
      await page.locator('[data-layer="flood-commercial"]').click();
      await sleep(page, 400);
      await page.locator('[data-layer="wind-hurricane"]').click();
      await sleep(page, 500);
      await page.locator('[data-layer="wind-hurricane"]').click();
      await page.mouse.wheel(0, -200);
    },
  },
  {
    id: "fusion",
    durationSec: 16,
    text: "Hazard fusion opens fused trip briefings — flood, wind, and routing stacked on the same P-one run. Operators see why a corridor is unsafe before anyone rolls.",
    async run(page) {
      await setToggle(page, "#toggleMultiHazardStrip", true);
      await sleep(page, 400);
      const fused = page.locator("#toggleFusedTrips");
      if (await fused.count()) {
        await fused.click();
        await sleep(page, 1800);
        await fused.click();
      }
    },
  },
  {
    id: "monitor",
    durationSec: 16,
    text: "Ops Output — Monitor tab. Situation brief cites operator SOPs, GloFAS and urban flood attribution, and the current Prepare level. Nothing leaves this desk without a human.",
    async run(page) {
      await page.click("#tabMonitor");
      await sleep(page, 800);
      await page.evaluate(() => {
        const el = document.getElementById("opsPanelBody");
        if (el) el.scrollTop = el.scrollHeight / 3;
      });
      await sleep(page, 1200);
      await page.evaluate(() => {
        const el = document.getElementById("opsPanelBody");
        if (el) el.scrollTop = 0;
      });
    },
  },
  {
    id: "triage-action",
    durationSec: 24,
    segments: [
      {
        durationSec: 12,
        text: "Triage ranks P-one trips across hospital partners, flags corridor conflicts, and drives map sync automatically.",
      },
      {
        durationSec: 12,
        text: "Action drafts COMMS-zero-three bulletins, a dispatch checklist, and driver SMS. Everything is draft — nothing auto-sends.",
      },
    ],
    async run(page) {
      await page.click("#tabTriage");
      await sleep(page, 1400);
      await page.evaluate(() => {
        const el = document.getElementById("opsPanelBody");
        if (el) el.scrollTop = el.scrollHeight / 3;
      });
      await sleep(page, 900);
      await page.click("#tabAction");
      await sleep(page, 1400);
      await page.evaluate(() => {
        const el = document.getElementById("opsPanelBody");
        if (el) el.scrollTop = el.scrollHeight / 2;
      });
    },
  },
  {
    id: "transport",
    durationSec: 16,
    text: "Transport desk is a separate write-back from COMMS approval. Expanding the handoff queue and accepting the next EMS to NEMT transfer — hospital pressure into assigned runs.",
    async run(page) {
      await page.locator("#toggleHandoffQueue").click();
      await sleep(page, 1600);
      await page.locator("#demoHandoffAccept").click();
      await sleep(page, 1400);
      await page.locator("#toggleHandoffQueue").click();
    },
  },
  {
    id: "hitl",
    durationSec: 50,
    segments: [
      {
        durationSec: 10,
        text: "Extended human-in-the-loop — five agencies. Maria Clarke, NEMT Dispatch, reviews COMMS-zero-three and approves.",
      },
      {
        durationSec: 10,
        text: "James Rolle at Princess Margaret Hospital signs the bulletin for clinical transport.",
      },
      {
        durationSec: 10,
        text: "Doctor Elaine Moss completes Doctor's Hospital liaison approval.",
      },
      {
        durationSec: 10,
        text: "Keisha Bain, Shelter Coordinator at National Gymnasium, clears evacuee routing.",
      },
      {
        durationSec: 10,
        text: "Marcus Edgecombe, Fleet Logistics, is the fifth signature. Multi-agency SOP before any release.",
      },
    ],
    async run(page) {
      const roles = [
        "#btnNemtReview",
        "#btnPmhReview",
        "#btnDoctorsReview",
        "#btnShelterReview",
        "#btnFleetReview",
      ];
      for (const sel of roles) {
        await approveHitlRole(page, sel);
      }
    },
  },
  {
    id: "audit",
    durationSec: 18,
    text: "Audit Trail on — pipeline steps, SOP citations, flood-stack attribution, and named approvers with timestamps. EOC briefing export is one click. Audit-first by design.",
    async run(page) {
      await setToggle(page, "#toggleAuditTrail", true);
      await sleep(page, 1000);
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => {
          const list = document.getElementById("auditTrailList");
          if (list) list.scrollTop += 110;
        });
        await sleep(page, 450);
      }
    },
  },
  {
    id: "close",
    durationSec: 16,
    text: "Tool-first agents, measured efficiency, and humans on the gate — so emergency personnel can move the right patients, on the right corridors, in time. KnightRoad Veritas — empower your business with predictive analytics.",
    async run(page) {
      const released = page.locator("#hitlReleasedBanner");
      if (await released.isVisible()) {
        await released.scrollIntoViewIfNeeded();
      }
      await sleep(page, 2500);
    },
  },
];

function ttsSave(text, file, options = {}) {
  const { voice = VOICE, rate = "-6%" } = options;
  execFileSync(
    "py",
    ["-m", "edge_tts", "--voice", voice, "--rate", rate, "--text", text, "--write-media", file],
    { stdio: "inherit" }
  );
}

const END_SCREEN_SEC = 5;

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
  for (let i = 0; i < 40; i++) {
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
      ttsSave(seg.text, rawPath, VOICE_OPTS);
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
  console.log("  Downloading professional/technical background track…");
  execFileSync("curl.exe", ["-sL", "-o", MUSIC_SOURCE, MUSIC_URL], { stdio: "inherit" });
  if (!fs.existsSync(MUSIC_SOURCE) || fs.statSync(MUSIC_SOURCE).size < 100_000) {
    throw new Error("Failed to download background music — place an MP3 at docs/assets/demo-music-source.mp3");
  }
  return MUSIC_SOURCE;
}

function generateBackgroundMusic(durationSec) {
  const src = ensureMusicSource();
  const bgPath = path.join(OUT_DIR, "background.mp3");
  const fadeOut = Math.max(0, durationSec - 4);

  console.log(`  Looping music track to ${durationSec}s…`);
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
  ff([
    "-y",
    "-i", voPath,
    "-i", bgPath,
    "-filter_complex",
    [
      `[0:a]aresample=44100,apad=whole_dur=${durationSec},volume=1.15[voice]`,
      "[1:a]aresample=44100,volume=0.38[music]",
      "[voice][music]amix=inputs=2:duration=longest:dropout_transition=0:weights=1.0 0.48",
      "loudnorm=I=-14:TP=-1.0:LRA=8[out]",
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
