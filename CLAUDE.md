# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — runs Vite (port 5173) **and** the Express render server (`tsx watch server/index.ts`) concurrently. This is the normal development entry point.
- `npm run web:dev` / `npm run server` — run only the frontend or only the API server.
- `npm run start` — opens **Remotion Studio** (`npx remotion studio`) for editing/previewing the `DashboardFlyIn` composition standalone, independent of the web UI.
- `npm run build` — renders the composition directly to `out/video.mp4` via the Remotion CLI (no server, no web UI).
- `npm run build:prod` — produces `dist/web` (Vite build) **and** `dist/server` (compiled Express server with `tsconfig.server.json`).
- `npm run serve:prod` — runs the compiled production server, which both exposes the API and serves `dist/web` as static files (single-port deploy).

There is no test runner, lint script, or typecheck script configured. Each TS surface uses its own tsconfig — `tsconfig.json` (web + src), `tsconfig.remotion.json` (Remotion CLI), `tsconfig.server.json` (server build only).

Docker: `docker-compose up` builds the production image (Chromium + headless GL deps preinstalled) and listens on port 3001. `REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium` is set so Remotion uses the system browser.

## Architecture

Three TypeScript surfaces share the repo, each with a separate tsconfig and a different runtime:

1. **`src/`** — the Remotion composition (`DashboardFlyIn.tsx`, registered in `Root.tsx`/`index.ts`). Pure React + Remotion primitives (`spring`, `interpolate`, `delayRender`, `Img`, `staticFile`). Props are validated by a Zod schema (`DashboardFlyInSchema`) which is also the contract used by Remotion Studio's controls.
2. **`web/`** — Vite-served React frontend ("Motion Studio"). State lives in a single Zustand store (`web/store/generatorStore.ts`) holding image, animation, and background props plus the export state machine. The store also drives a live `<Player>` (`@remotion/player`) that **imports `DashboardFlyIn` directly from `src/`** — so the same component renders in the browser preview and in the headless server-side video.
3. **`server/index.ts`** — Express API that uses `@remotion/bundler` + `@remotion/renderer` to render videos headlessly. The bundle is created lazily on first request and cached in a module-level variable (`bundleCache`); subsequent renders reuse it.

### Render flow

`POST /api/render` (multipart) → server saves uploaded image to `os.tmpdir()`, exposes it via `app.use("/tmp-assets", express.static(os.tmpdir()))`, and kicks off `doRender(jobId, ...)` **without awaiting**. The client then polls `GET /api/render/status/:jobId` every 2 s (see `triggerRender` in the store). When done, the client fetches `/api/render/download/:jobId` (one-shot — entry is deleted from `renderOutputs` after streaming) and triggers a browser download.

Two in-memory `Map`s coordinate jobs: `jobStatuses` (pending/progress/done/error) and `renderOutputs` (jobId → outPath). They are **not persisted** — restarting the server loses in-flight jobs.

Files in `os.tmpdir()` follow a naming convention used by the API:
- `upload-*` — source images (deleted after their render finishes)
- `bg-*` — background images uploaded via `/api/backgrounds/upload` (persistent; listed/deleted via `/api/backgrounds`)
- `render-*.mp4` — completed renders (persistent; listed by `/api/renders`, downloaded via `/api/render/download-file/:filename`, deleted via `/api/render/delete-file/:filename`). The History tab consumes these endpoints.

In Docker, `/tmp` is bind-mounted to `/hdd/3d-out` so renders survive container restarts.

### Port wiring (gotcha)

`vite.config.ts` proxies `/api/*` to `http://localhost:3001`, but `server/index.ts` defaults to `process.env.PORT ?? 3004`. For local dev to work end-to-end you must run the server with `PORT=3001` (or change the proxy). In production (Docker) `PORT=3001` is set in `docker-compose.yml` and the same Express process serves the built frontend, so no proxy is involved.

### Composition timing

The total `durationInFrames` is computed in `src/Root.tsx` as `60 + 30 + 50 + round(0.7 * 30) = 161` (entrance spring + hold + flip spring + idle float). **`web/components/preview/PlayerWrapper.tsx` hardcodes `DURATION_IN_FRAMES = 161`** — if you change the timing constants in `Root.tsx` or `DashboardFlyIn.tsx` (`HOLD_FRAMES`, the flip duration, the float tail), update both places.

`DashboardFlyIn` uses `delayRender`/`continueRender` keyed off a `useRef` of the current `imageUrl`, so changing the image during a render correctly blocks the frame until the new image loads. The "3D thickness" effect is purely CSS — a single `<Img>` with a multi-step `box-shadow` stack (`SLAB_DEPTH` × `SLAB_Z_STEP`) — chosen so Chromium decodes the image once per frame instead of once per slab layer.

### Adding a new composition

`web/templates/registry.ts` exists as the future hook for multi-template support but is not yet consumed — the web UI currently hardcodes `DashboardFlyIn`. To add a real second template you would: register a new `<Composition>` in `src/Root.tsx`, import the component into `PlayerWrapper.tsx` (or make it data-driven from the registry), and update the server's `selectComposition({ id: "DashboardFlyIn" })` call to pick the right id.
