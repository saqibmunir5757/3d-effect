import express from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const app = express();
app.use(express.json());

// Allow browser to connect directly to this server for SSE (bypasses Vite proxy buffering)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// Serve uploaded files over HTTP so Remotion's headless browser can load them.
app.use("/tmp-assets", express.static(os.tmpdir()));

// Serve built Vite frontend (production only — in dev, Vite runs separately)
const DIST_WEB = path.resolve(process.cwd(), "dist/web");
if (fs.existsSync(DIST_WEB)) {
  app.use(express.static(DIST_WEB));
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(DIST_WEB, "index.html")));
}

const PORT = 3001;
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

// ── SSE job registry ──────────────────────────────────────────────────────
// Each render gets a unique jobId. SSE clients subscribe and receive progress.
type ProgressEvent =
  | { type: "progress"; frame: number; totalFrames: number; percent: number }
  | { type: "done"; downloadUrl: string }
  | { type: "error"; message: string };

// Map of jobId → list of SSE response objects listening for that job
const sseClients = new Map<string, express.Response[]>();

function pushEvent(jobId: string, event: ProgressEvent) {
  const clients = sseClients.get(jobId) ?? [];
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(payload);
    if (event.type === "done" || event.type === "error") {
      client.end();
    }
  }
  if (event.type === "done" || event.type === "error") {
    sseClients.delete(jobId);
  }
}

// ── SSE subscribe endpoint ────────────────────────────────────────────────
app.get("/api/render/progress/:jobId", (req, res) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Register client
  const existing = sseClients.get(jobId) ?? [];
  existing.push(res);
  sseClients.set(jobId, existing);

  // Remove on disconnect
  req.on("close", () => {
    const list = sseClients.get(jobId);
    if (list) {
      const updated = list.filter((c) => c !== res);
      if (updated.length === 0) sseClients.delete(jobId);
      else sseClients.set(jobId, updated);
    }
  });
});

// ── Async render function ─────────────────────────────────────────────────
async function doRender(
  jobId: string,
  imageUrl: string,
  accentColor: string,
  entranceDurationFrames: number,
  imageZoom: number,
  cardScale: number,
  glowIntensity: number,
  uploadedFilePath?: string
) {
  const outPath = path.join(os.tmpdir(), `render-${jobId}.mp4`);

  try {
    const bundlePath = await getBundle();
    const inputProps = { imageUrl, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity, title: "", subtitle: "" };

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
        gl: process.platform === "linux" ? "swiftshader" : "angle",
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

    // Push download URL — client fetches it to get the file
    pushEvent(jobId, { type: "done", downloadUrl: `/api/render/download/${jobId}` });

    // Store the output path for the download endpoint (cleaned up after download)
    renderOutputs.set(jobId, { outPath, uploadedFilePath });
  } catch (err) {
    console.error(`Render error [${jobId}]:`, err);
    pushEvent(jobId, { type: "error", message: String(err) });
    fs.unlink(outPath, () => {});
    if (uploadedFilePath) fs.unlink(uploadedFilePath, () => {});
  }
}

// ── Download endpoint (called after SSE "done") ───────────────────────────
const renderOutputs = new Map<string, { outPath: string; uploadedFilePath?: string }>();

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
    fs.unlink(output.outPath, () => {});
    if (output.uploadedFilePath) fs.unlink(output.uploadedFilePath, () => {});
  });
});

// ── Render start endpoint ─────────────────────────────────────────────────
// Returns immediately with a jobId. Client subscribes to SSE for progress.
app.post("/api/render", upload.any(), async (req, res) => {
  const accentColor = (req.body.accentColor as string) ?? "#6366f1";
  const entranceDurationFrames = Number(req.body.entranceDurationFrames ?? 60);
  const imageZoom = Number(req.body.imageZoom ?? 1.0);
  const cardScale = Number(req.body.cardScale ?? 0.7);
  const glowIntensity = Number(req.body.glowIntensity ?? 1.0);
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const files = req.files as Express.Multer.File[] | undefined;
  const uploadedFile = files?.find((f) => f.fieldname === "image");

  let imageUrl: string;

  if (uploadedFile) {
    const filename = path.basename(uploadedFile.path);
    imageUrl = `http://localhost:${PORT}/tmp-assets/${filename}`;
    doRender(jobId, imageUrl, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity, uploadedFile.path);
  } else {
    const body = req.body as { imageUrl?: string };
    if (!body.imageUrl) {
      res.status(400).json({ error: "imageUrl or image file is required" });
      return;
    }
    imageUrl = body.imageUrl;
    doRender(jobId, imageUrl, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity);
  }

  // Return the jobId immediately so client can subscribe to progress
  res.json({ jobId });
});

app.listen(PORT, () => {
  console.log(`🚀 Render server running at http://localhost:${PORT}`);
});
