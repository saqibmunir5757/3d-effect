import { create } from "zustand";

export type ExportStatus = "idle" | "rendering" | "done" | "error";

interface GeneratorState {
  // Image — data URL for live preview, raw File for server upload
  imageMode: "file" | "url";
  imageUrl: string;
  imageFile: File | null;

  // Composition props
  accentColor: string;
  entranceDurationFrames: number;
  imageZoom: number; // 1.0 = fit, >1 = zoom in

  // Export
  exportStatus: ExportStatus;
  exportError: string | null;
  renderFrame: number;
  renderTotalFrames: number;
  renderPercent: number;

  // Actions
  setImageFromFile: (file: File) => void;
  setImageFromUrl: (url: string) => void;
  setImageMode: (mode: "file" | "url") => void;
  updateProp: <K extends keyof Pick<GeneratorState, "accentColor" | "entranceDurationFrames" | "imageZoom">>(
    key: K,
    value: GeneratorState[K]
  ) => void;
  triggerRender: () => Promise<void>;
  resetExport: () => void;
}

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  imageMode: "file",
  imageUrl: "",
  imageFile: null,
  accentColor: "#6366f1",
  entranceDurationFrames: 60,
  imageZoom: 1.0,
  exportStatus: "idle",
  exportError: null,
  renderFrame: 0,
  renderTotalFrames: 0,
  renderPercent: 0,

  setImageFromFile: (file: File) => {
    set({ imageFile: file, imageMode: "file" });
    const reader = new FileReader();
    reader.onload = (e) => {
      set({ imageUrl: e.target?.result as string });
    };
    reader.readAsDataURL(file);
  },

  setImageFromUrl: (url: string) => {
    set({ imageUrl: url, imageFile: null, imageMode: "url" });
  },

  setImageMode: (mode) => {
    set({ imageMode: mode, imageUrl: "", imageFile: null });
  },

  updateProp: (key, value) => {
    set({ [key]: value } as Partial<GeneratorState>);
  },

  triggerRender: async () => {
    const { imageUrl, imageFile, imageMode, accentColor, entranceDurationFrames, imageZoom } = get();
    set({ exportStatus: "rendering", exportError: null, renderFrame: 0, renderTotalFrames: 0, renderPercent: 0 });

    try {
      let startRes: Response;
      if (imageMode === "file" && imageFile) {
        const form = new FormData();
        form.append("image", imageFile);
        form.append("accentColor", accentColor);
        form.append("entranceDurationFrames", String(entranceDurationFrames));
        form.append("imageZoom", String(imageZoom));
        startRes = await fetch("/api/render", { method: "POST", body: form });
      } else {
        startRes = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl, accentColor, entranceDurationFrames, imageZoom }),
        });
      }

      if (!startRes.ok) {
        const data = await startRes.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Server error ${startRes.status}`);
      }

      const { jobId } = (await startRes.json()) as { jobId: string };

      // SSE connects to same origin in production, direct to 3001 in dev
      const sseBase = window.location.port === "5173" || window.location.port === "5174" || window.location.port === "5175"
        ? "http://localhost:3001"
        : window.location.origin;

      await new Promise<void>((resolve, reject) => {
        const evtSource = new EventSource(`${sseBase}/api/render/progress/${jobId}`);

        evtSource.onmessage = async (e) => {
          const event = JSON.parse(e.data) as
            | { type: "progress"; frame: number; totalFrames: number; percent: number }
            | { type: "done"; downloadUrl: string }
            | { type: "error"; message: string };

          if (event.type === "progress") {
            set({ renderFrame: event.frame, renderTotalFrames: event.totalFrames, renderPercent: event.percent });
          } else if (event.type === "done") {
            evtSource.close();
            set({ renderPercent: 100 });

            const downloadRes = await fetch(event.downloadUrl);
            if (!downloadRes.ok) { reject(new Error("Download failed")); return; }

            const blob = await downloadRes.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "animation.mp4";
            a.click();
            URL.revokeObjectURL(url);
            resolve();
          } else if (event.type === "error") {
            evtSource.close();
            reject(new Error(event.message));
          }
        };

        evtSource.onerror = () => {
          evtSource.close();
          reject(new Error("Connection to render server lost"));
        };
      });

      set({ exportStatus: "done" });
      setTimeout(() => set({ exportStatus: "idle", renderPercent: 0 }), 4000);
    } catch (err) {
      set({ exportStatus: "error", exportError: String(err) });
    }
  },

  resetExport: () => set({ exportStatus: "idle", exportError: null, renderFrame: 0, renderTotalFrames: 0, renderPercent: 0 }),
}));
