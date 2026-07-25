/**
 * Capture silent landing clips + posters from live product routes.
 *
 *   # terminal A
 *   npm run dev
 *   # terminal B
 *   node scripts/capture-landing-clips.mjs
 *
 * Writes to public/landing/:
 *   hero.mp4, hero-poster.jpg
 *   family-poster.jpg, patient-poster.jpg, clinician-poster.jpg
 *
 * Assumes a server on PORT (default 3000). Uses Playwright video (webm) and
 * ffmpeg to produce H.264 mp4 when ffmpeg is on PATH; otherwise keeps webm
 * and copies it as hero.webm while still writing the poster.
 */
import { chromium } from "playwright";
import { mkdir, copyFile, access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
const OUT = path.resolve("public/landing");
const TMP = path.resolve(".landing-capture");

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function hasFfmpeg() {
  const r = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  return r.status === 0;
}

function webmToMp4(webm, mp4) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      webm,
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(r.stderr || "ffmpeg failed");
  }
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server not reachable at ${BASE}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(TMP, { recursive: true });
  await waitForServer();

  const browser = await chromium.launch();
  const ffmpeg = hasFfmpeg();

  // --- Posters (framed off so chrome doesn't dominate stills) ---
  const posters = [
    { route: "/family?frame=0&state=urgent", file: "family-poster.jpg", w: 390, h: 844 },
    { route: "/patient?frame=0", file: "patient-poster.jpg", w: 390, h: 844 },
    { route: "/clinician", file: "clinician-poster.jpg", w: 1280, h: 800 },
    { route: "/call?stage=checking", file: "hero-poster.jpg", w: 1280, h: 800 },
  ];

  for (const shot of posters) {
    const context = await browser.newContext({
      viewport: { width: shot.w, height: shot.h },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`${BASE}${shot.route}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT, shot.file),
      type: "jpeg",
      quality: 88,
    });
    await context.close();
    console.log("poster", shot.file);
  }

  // --- Hero clip: scroll the call stage briefly ---
  const videoDir = path.join(TMP, "hero-video");
  await mkdir(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/call?play=1&speed=2`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(6500);
  await context.close();

  // Playwright writes one webm in the dir
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(videoDir)).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) {
    throw new Error("No webm recorded for hero clip");
  }
  const webmPath = path.join(videoDir, files[0]);
  const webmOut = path.join(OUT, "hero.webm");
  await copyFile(webmPath, webmOut);

  const mp4Out = path.join(OUT, "hero.mp4");
  if (ffmpeg) {
    webmToMp4(webmPath, mp4Out);
    console.log("hero.mp4");
  } else {
    // Fallback: duplicate webm bytes won't play as mp4 — write a tiny note
    // and leave hero.webm for the page to prefer.
    await writeFile(
      path.join(OUT, "README.md"),
      "hero.webm captured without ffmpeg. Install ffmpeg and re-run to produce hero.mp4.\n",
    );
    console.warn("ffmpeg missing — wrote hero.webm only");
  }

  // Short phone clips for optional surface use
  for (const clip of [
    { route: "/family?frame=0&state=urgent", name: "family", w: 390, h: 844 },
    { route: "/patient?frame=0", name: "patient", w: 390, h: 844 },
  ]) {
    const dir = path.join(TMP, clip.name);
    await mkdir(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: clip.w, height: clip.h },
      recordVideo: { dir, size: { width: clip.w, height: clip.h } },
    });
    const p = await ctx.newPage();
    await p.goto(`${BASE}${clip.route}`, { waitUntil: "networkidle", timeout: 60000 });
    await p.waitForTimeout(2800);
    await ctx.close();
    const vids = (await readdir(dir)).filter((f) => f.endsWith(".webm"));
    if (vids[0]) {
      const src = path.join(dir, vids[0]);
      await copyFile(src, path.join(OUT, `${clip.name}.webm`));
      if (ffmpeg) {
        webmToMp4(src, path.join(OUT, `${clip.name}.mp4`));
      }
      console.log("clip", clip.name);
    }
  }

  await browser.close();
  console.log("done →", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
