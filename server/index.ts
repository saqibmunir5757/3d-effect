import express from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const app = express();
app.use(express.json());

// Allow browser to connect directly to this server (bypasses Vite proxy buffering)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// Serve uploaded files over HTTP so Remotion's headless browser can load them.
app.use("/tmp-assets", express.static(os.tmpdir()));

const PORT = Number(process.env.PORT ?? 3004);
const ENTRY_POINT = path.resolve(process.cwd(), "src/index.ts");

// ── Tunables ───────────────────────────────────────────────────────────────
const MAX_RENDERS_KEPT = 50;             // disk retention cap for render-*.mp4
const MAX_CONCURRENT_RENDERS = 2;        // cap on parallel renderMedia jobs
const JOB_STATE_TTL_MS = 60 * 60 * 1000; // 1 hour: drop abandoned client jobs
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LIST_CACHE_TTL_MS = 2_000;         // 2 s cache for /api/renders & /api/backgrounds

const SERVER_STARTED_AT = Date.now();

// Multer: save uploaded image to OS temp dir, keep original extension
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `upload-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

let bundleCache: string | null = null;

async function getBundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  console.log("⏳ Bundling composition (first render only)...");
  bundleCache = await bundle({ entryPoint: ENTRY_POINT, outDir: undefined });
  console.log("✅ Bundle ready");
  return bundleCache;
}

getBundle().catch(() => {});

// ── Job status registry ────────────────────────────────────────────────────
type ProgressEvent =
  | { type: "progress"; frame: number; totalFrames: number; percent: number }
  | { type: "done"; downloadUrl: string }
  | { type: "error"; message: string };

type JobStatusBase =
  | { state: "pending" }
  | { state: "progress"; frame: number; totalFrames: number; percent: number }
  | { state: "done"; downloadUrl: string }
  | { state: "error"; message: string };

type JobStatus = JobStatusBase & { lastUpdatedAt: number };

const jobStatuses = new Map<string, JobStatus>();

function setJobStatus(jobId: string, status: JobStatusBase) {
  jobStatuses.set(jobId, { ...status, lastUpdatedAt: Date.now() } as JobStatus);
}

function pushEvent(jobId: string, event: ProgressEvent) {
  if (event.type === "progress") {
    setJobStatus(jobId, { state: "progress", frame: event.frame, totalFrames: event.totalFrames, percent: event.percent });
  } else if (event.type === "done") {
    setJobStatus(jobId, { state: "done", downloadUrl: event.downloadUrl });
  } else if (event.type === "error") {
    setJobStatus(jobId, { state: "error", message: event.message });
  }
}

// ── Polling status endpoint ────────────────────────────────────────────────
app.get("/api/render/status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const status = jobStatuses.get(jobId) ?? ({ state: "pending", lastUpdatedAt: Date.now() } as JobStatus);
  if (status.state === "done" || status.state === "error") {
    jobStatuses.delete(jobId);
  }
  res.json(status);
});

// ── Render queue (semaphore) ───────────────────────────────────────────────
let activeRenders = 0;
const renderQueue: Array<() => void> = [];

async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    await new Promise<void>((resolve) => renderQueue.push(resolve));
  }
  activeRenders++;
  try {
    return await fn();
  } finally {
    activeRenders--;
    const next = renderQueue.shift();
    if (next) next();
  }
}

// ── Disk retention: keep only the newest MAX_RENDERS_KEPT render-*.mp4 ────
const RENDER_FILE_RE = /^render-(.+)\.mp4$/;

function pruneOldRenders(cap: number) {
  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir)
      .filter((f) => RENDER_FILE_RE.test(f))
      .map((f) => {
        const full = path.join(tmpDir, f);
        const stat = fs.statSync(full);
        return { f, full, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (let i = cap; i < files.length; i++) {
      const { f, full } = files[i];
      try { fs.unlinkSync(full); } catch { /* ignore */ }
      const m = f.match(RENDER_FILE_RE);
      if (m) renderOutputs.delete(m[1]);
    }
    if (files.length > cap) {
      console.log(`🧹 Pruned ${files.length - cap} old renders (kept newest ${cap})`);
    }
  } catch (err) {
    console.error("pruneOldRenders error:", err);
  }
}

// ── Async render function ─────────────────────────────────────────────────
interface BgProps {
  bgType: string;
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  bgPatternSize: number;
  bgImageUrl: string;
}

async function doRender(
  jobId: string,
  imageUrl: string,
  accentColor: string,
  entranceDurationFrames: number,
  imageZoom: number,
  cardScale: number,
  glowIntensity: number,
  imageAspectRatio: number,
  bg: BgProps,
  uploadedFilePath?: string
) {
  const outPath = path.join(os.tmpdir(), `render-${jobId}.mp4`);

  await withRenderSlot(async () => {
    try {
      const bundlePath = await getBundle();
      const inputProps = { imageUrl, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity, imageAspectRatio, ...bg, title: "", subtitle: "" };

      const composition = await selectComposition({
        serveUrl: bundlePath,
        id: "DashboardFlyIn",
        inputProps,
      });

      const totalFrames = composition.durationInFrames;
      console.log(`🎬 [${jobId}] Rendering ${composition.id} @ 1280×720 (${totalFrames} frames)...`);

      await renderMedia({
        composition,
        serveUrl: bundlePath,
        codec: "h264",
        outputLocation: outPath,
        inputProps,
        concurrency: Math.max(1, os.cpus().length - 1),
        chromiumOptions: {
          gl: "angle",
          disableWebSecurity: true,
          ignoreCertificateErrors: true,
        },
        browserExecutable: process.env.REMOTION_CHROME_EXECUTABLE || undefined,
        onProgress: ({ renderedFrames, progress }) => {
          const frame = renderedFrames ?? Math.round(progress * totalFrames);
          pushEvent(jobId, {
            type: "progress",
            frame,
            totalFrames,
            percent: Math.round(progress * 100),
          });
          process.stdout.write(`\r   [${jobId}] ${frame}/${totalFrames} frames (${Math.round(progress * 100)}%)`);
        },
      });

      console.log(`\n✅ [${jobId}] Done → ${outPath}`);

      // Clean up uploaded source image immediately — mp4 is kept for History
      if (uploadedFilePath) fs.unlink(uploadedFilePath, () => {});
      pushEvent(jobId, { type: "done", downloadUrl: `/api/render/download/${jobId}` });
      renderOutputs.set(jobId, { outPath });

      // Enforce disk retention cap after every successful render
      pruneOldRenders(MAX_RENDERS_KEPT);
    } catch (err) {
      console.error(`Render error [${jobId}]:`, err);
      pushEvent(jobId, { type: "error", message: String(err) });
      fs.unlink(outPath, () => {});
      if (uploadedFilePath) fs.unlink(uploadedFilePath, () => {});
    }
  });
}

// ── Download endpoint ─────────────────────────────────────────────────────
const renderOutputs = new Map<string, { outPath: string }>();

function streamFile(req: express.Request, res: express.Response, filePath: string) {
  const stream = fs.createReadStream(filePath);
  stream.on("error", (err) => {
    console.error("download stream error:", err);
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });
  req.on("close", () => stream.destroy());
  stream.pipe(res);
}

app.get("/api/render/download/:jobId", (req, res) => {
  const { jobId } = req.params;
  const output = renderOutputs.get(jobId);
  if (!output) {
    res.status(404).json({ error: "Render output not found or already downloaded" });
    return;
  }
  renderOutputs.delete(jobId);

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", 'attachment; filename="animation.mp4"');
  streamFile(req, res, output.outPath);
});

// ── List all rendered videos (cached) ──────────────────────────────────────
interface RenderListEntry { jobId: string; filename: string; downloadUrl: string; createdAt: number; size: number }
let rendersCache: { at: number; payload: RenderListEntry[] } | null = null;

function listRenderFiles(): RenderListEntry[] {
  const tmpDir = os.tmpdir();
  return fs.readdirSync(tmpDir)
    .filter((f) => RENDER_FILE_RE.test(f))
    .map((f) => {
      const stat = fs.statSync(path.join(tmpDir, f));
      const jobId = f.replace("render-", "").replace(".mp4", "");
      return { jobId, filename: f, downloadUrl: `/api/render/download-file/${f}`, createdAt: stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

app.get("/api/renders", (_req, res) => {
  const now = Date.now();
  if (!rendersCache || now - rendersCache.at > LIST_CACHE_TTL_MS) {
    rendersCache = { at: now, payload: listRenderFiles() };
  }
  res.json(rendersCache.payload);
});

// ── Download by filename (persistent, does not delete file) ───────────────
app.get("/api/render/download-file/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(os.tmpdir(), filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  streamFile(req, res, filePath);
});

// ── Delete a rendered video ────────────────────────────────────────────────
app.delete("/api/render/delete-file/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(os.tmpdir(), filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  fs.unlink(filePath, (err) => {
    if (err) { res.status(500).json({ error: "Failed to delete file" }); return; }
    rendersCache = null;
    res.json({ success: true });
  });
});

// ── Background image upload (persistent) ──────────────────────────────────
const BG_FILE_RE = /^bg-.+\.(png|jpe?g|webp|gif|bmp|svg)$/i;

app.post("/api/backgrounds/upload", upload.single("image"), (req, res) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "No image provided" }); return; }
  // Rename with bg- prefix so it persists and is distinguishable
  const ext = path.extname(file.originalname) || ".png";
  const bgName = `bg-${Date.now()}${ext}`;
  const newPath = path.join(os.tmpdir(), bgName);
  fs.rename(file.path, newPath, (err) => {
    if (err) { res.status(500).json({ error: "Failed to save background" }); return; }
    backgroundsCache = null;
    res.json({ url: `/tmp-assets/${bgName}`, filename: bgName });
  });
});

interface BgListEntry { filename: string; url: string; createdAt: number }
let backgroundsCache: { at: number; payload: BgListEntry[] } | null = null;

function listBackgroundFiles(): BgListEntry[] {
  const tmpDir = os.tmpdir();
  return fs.readdirSync(tmpDir)
    .filter((f) => BG_FILE_RE.test(f))
    .map((f) => {
      const stat = fs.statSync(path.join(tmpDir, f));
      return { filename: f, url: `/tmp-assets/${f}`, createdAt: stat.mtimeMs };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

app.get("/api/backgrounds", (_req, res) => {
  const now = Date.now();
  if (!backgroundsCache || now - backgroundsCache.at > LIST_CACHE_TTL_MS) {
    backgroundsCache = { at: now, payload: listBackgroundFiles() };
  }
  res.json(backgroundsCache.payload);
});

app.delete("/api/backgrounds/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.startsWith("bg-")) { res.status(400).json({ error: "Invalid background file" }); return; }
  const filePath = path.join(os.tmpdir(), filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found" }); return; }
  fs.unlink(filePath, (err) => {
    if (err) { res.status(500).json({ error: "Failed to delete" }); return; }
    backgroundsCache = null;
    res.json({ success: true });
  });
});

// ── Render start endpoint ─────────────────────────────────────────────────
app.post("/api/render", upload.any(), async (req, res) => {
  const accentColor = (req.body.accentColor as string) ?? "#6366f1";
  const entranceDurationFrames = Number(req.body.entranceDurationFrames ?? 60);
  const imageZoom = Number(req.body.imageZoom ?? 1.0);
  const cardScale = Number(req.body.cardScale ?? 0.7);
  const glowIntensity = Number(req.body.glowIntensity ?? 1.0);
  const imageAspectRatio = Number(req.body.imageAspectRatio ?? 16 / 9);

  // Background props
  const bg: BgProps = {
    bgType: (req.body.bgType as string) ?? "linear-gradient",
    bgColor1: (req.body.bgColor1 as string) ?? "#0a0a14",
    bgColor2: (req.body.bgColor2 as string) ?? "#0e1628",
    bgAngle: Number(req.body.bgAngle ?? 135),
    bgPatternSize: Number(req.body.bgPatternSize ?? 30),
    bgImageUrl: (req.body.bgImageUrl as string) ?? "",
  };

  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  setJobStatus(jobId, { state: "pending" });

  const files = req.files as Express.Multer.File[] | undefined;
  const uploadedFile = files?.find((f) => f.fieldname === "image");

  // If a background image was uploaded, resolve its URL
  const bgImageFile = files?.find((f) => f.fieldname === "bgImage");
  if (bgImageFile) {
    const bgFilename = path.basename(bgImageFile.path);
    bg.bgImageUrl = `http://localhost:${PORT}/tmp-assets/${bgFilename}`;
  }

  let imageUrl: string;

  if (uploadedFile) {
    const filename = path.basename(uploadedFile.path);
    imageUrl = `http://localhost:${PORT}/tmp-assets/${filename}`;
    doRender(jobId, imageUrl, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity, imageAspectRatio, bg, uploadedFile.path);
  } else {
    const body = req.body as { imageUrl?: string };
    if (!body.imageUrl) {
      res.status(400).json({ error: "imageUrl or image file is required" });
      return;
    }
    imageUrl = body.imageUrl;
    doRender(jobId, imageUrl, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity, imageAspectRatio, bg);
  }

  res.json({ jobId });
});

// ── Stats / health endpoint (remote observability) ─────────────────────────
app.get("/api/stats", (_req, res) => {
  const tmpDir = os.tmpdir();
  let renderCount = 0;
  let renderBytes = 0;
  let oldestRenderMtime: number | null = null;
  let bgCount = 0;
  let bgBytes = 0;

  try {
    for (const f of fs.readdirSync(tmpDir)) {
      const full = path.join(tmpDir, f);
      if (RENDER_FILE_RE.test(f)) {
        const stat = fs.statSync(full);
        renderCount++;
        renderBytes += stat.size;
        if (oldestRenderMtime === null || stat.mtimeMs < oldestRenderMtime) oldestRenderMtime = stat.mtimeMs;
      } else if (BG_FILE_RE.test(f)) {
        const stat = fs.statSync(full);
        bgCount++;
        bgBytes += stat.size;
      }
    }
  } catch (err) {
    console.error("stats scan error:", err);
  }

  let tmpFreeBytes: number | null = null;
  try {
    const sf = (fs as unknown as { statfsSync?: (p: string) => { bavail: bigint; bsize: bigint } }).statfsSync;
    if (sf) {
      const s = sf(tmpDir);
      tmpFreeBytes = Number(s.bavail * s.bsize);
    }
  } catch {
    tmpFreeBytes = null;
  }

  res.json({
    uptimeSeconds: Math.round((Date.now() - SERVER_STARTED_AT) / 1000),
    memory: process.memoryUsage(),
    config: {
      maxRendersKept: MAX_RENDERS_KEPT,
      maxConcurrentRenders: MAX_CONCURRENT_RENDERS,
      jobStateTtlMs: JOB_STATE_TTL_MS,
    },
    jobStatusesSize: jobStatuses.size,
    renderOutputsSize: renderOutputs.size,
    activeRenders,
    queuedRenders: renderQueue.length,
    renderFiles: {
      count: renderCount,
      totalBytes: renderBytes,
      oldestMtime: oldestRenderMtime ? new Date(oldestRenderMtime).toISOString() : null,
    },
    bgFiles: { count: bgCount, totalBytes: bgBytes },
    tmpFreeBytes,
  });
});

// ── Periodic sweeper: drop stale jobStatuses / renderOutputs entries ──────
const sweeper = setInterval(() => {
  const now = Date.now();

  for (const [jobId, status] of jobStatuses) {
    if (now - status.lastUpdatedAt > JOB_STATE_TTL_MS) {
      jobStatuses.delete(jobId);
    }
  }

  for (const [jobId, { outPath }] of renderOutputs) {
    let drop = false;
    if (!fs.existsSync(outPath)) {
      drop = true;
    } else if (!jobStatuses.has(jobId)) {
      try {
        const stat = fs.statSync(outPath);
        if (now - stat.mtimeMs > JOB_STATE_TTL_MS) drop = true;
      } catch { drop = true; }
    }
    if (drop) renderOutputs.delete(jobId);
  }
}, SWEEP_INTERVAL_MS);
sweeper.unref();

// Self-heal disk on startup so a server that comes back to a too-full /tmp recovers.
pruneOldRenders(MAX_RENDERS_KEPT);

// Serve built Vite frontend (production only — must be AFTER all API routes)
const DIST_WEB = path.resolve(process.cwd(), "dist/web");
if (fs.existsSync(DIST_WEB)) {
  app.use(express.static(DIST_WEB));
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(DIST_WEB, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Render server running at http://0.0.0.0:${PORT}`);
});
