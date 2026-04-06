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

type JobStatus =
  | { state: "pending" }
  | { state: "progress"; frame: number; totalFrames: number; percent: number }
  | { state: "done"; downloadUrl: string }
  | { state: "error"; message: string };

const jobStatuses = new Map<string, JobStatus>();

function pushEvent(jobId: string, event: ProgressEvent) {
  if (event.type === "progress") {
    jobStatuses.set(jobId, { state: "progress", frame: event.frame, totalFrames: event.totalFrames, percent: event.percent });
  } else if (event.type === "done") {
    jobStatuses.set(jobId, { state: "done", downloadUrl: event.downloadUrl });
  } else if (event.type === "error") {
    jobStatuses.set(jobId, { state: "error", message: event.message });
  }
}

// ── Polling status endpoint ────────────────────────────────────────────────
app.get("/api/render/status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const status = jobStatuses.get(jobId) ?? { state: "pending" };
  if (status.state === "done" || status.state === "error") {
    jobStatuses.delete(jobId);
  }
  res.json(status);
});

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
  } catch (err) {
    console.error(`Render error [${jobId}]:`, err);
    pushEvent(jobId, { type: "error", message: String(err) });
    fs.unlink(outPath, () => {});
    if (uploadedFilePath) fs.unlink(uploadedFilePath, () => {});
  }
}

// ── Download endpoint ─────────────────────────────────────────────────────
const renderOutputs = new Map<string, { outPath: string }>();

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

  const stream = fs.createReadStream(output.outPath);
  stream.pipe(res);
  stream.on("close", () => {
    // Keep the render mp4 so it appears in History (uploaded source already deleted after render)
  });
});

// ── List all rendered videos ───────────────────────────────────────────────
app.get("/api/renders", (_req, res) => {
  const tmpDir = os.tmpdir();
  const files = fs.readdirSync(tmpDir)
    .filter(f => f.startsWith("render-") && f.endsWith(".mp4"))
    .map(f => {
      const stat = fs.statSync(path.join(tmpDir, f));
      const jobId = f.replace("render-", "").replace(".mp4", "");
      return { jobId, filename: f, downloadUrl: `/api/render/download-file/${f}`, createdAt: stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(files);
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
  fs.createReadStream(filePath).pipe(res);
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
    res.json({ success: true });
  });
});

// ── Background image upload (persistent) ──────────────────────────────────
app.post("/api/backgrounds/upload", upload.single("image"), (req, res) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "No image provided" }); return; }
  // Rename with bg- prefix so it persists and is distinguishable
  const ext = path.extname(file.originalname) || ".png";
  const bgName = `bg-${Date.now()}${ext}`;
  const newPath = path.join(os.tmpdir(), bgName);
  fs.rename(file.path, newPath, (err) => {
    if (err) { res.status(500).json({ error: "Failed to save background" }); return; }
    res.json({ url: `/tmp-assets/${bgName}`, filename: bgName });
  });
});

app.get("/api/backgrounds", (_req, res) => {
  const tmpDir = os.tmpdir();
  const files = fs.readdirSync(tmpDir)
    .filter(f => f.startsWith("bg-") && /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f))
    .map(f => {
      const stat = fs.statSync(path.join(tmpDir, f));
      return { filename: f, url: `/tmp-assets/${f}`, createdAt: stat.mtimeMs };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(files);
});

app.delete("/api/backgrounds/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.startsWith("bg-")) { res.status(400).json({ error: "Invalid background file" }); return; }
  const filePath = path.join(os.tmpdir(), filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found" }); return; }
  fs.unlink(filePath, (err) => {
    if (err) { res.status(500).json({ error: "Failed to delete" }); return; }
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

  jobStatuses.set(jobId, { state: "pending" });

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

// Serve built Vite frontend (production only — must be AFTER all API routes)
const DIST_WEB = path.resolve(process.cwd(), "dist/web");
if (fs.existsSync(DIST_WEB)) {
  app.use(express.static(DIST_WEB));
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(DIST_WEB, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Render server running at http://0.0.0.0:${PORT}`);
});
