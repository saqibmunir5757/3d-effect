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
  cardScale: number; // 0.3–1.0, fraction of frame width
  glowIntensity: number; // 0.0 = no glow, 1.0 = normal, 2.0 = max
  imageAspectRatio: number; // width / height of the uploaded image

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
  updateProp: <K extends keyof Pick<GeneratorState, "accentColor" | "entranceDurationFrames" | "imageZoom" | "cardScale" | "glowIntensity" | "imageAspectRatio">>(
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
  accentColor: "#ffffff",
  entranceDurationFrames: 60,
  imageZoom: 1.0,
  cardScale: 0.7,
  glowIntensity: 1.0,
  imageAspectRatio: 16 / 9,
  exportStatus: "idle",
  exportError: null,
  renderFrame: 0,
  renderTotalFrames: 0,
  renderPercent: 0,

  setImageFromFile: (file: File) => {
    set({ imageFile: file, imageMode: "file" });
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      set({ imageUrl: dataUrl });
      const img = new Image();
      img.onload = () => {
        set({ imageAspectRatio: img.naturalWidth / img.naturalHeight });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  },

  setImageFromUrl: (url: string) => {
    set({ imageUrl: url, imageFile: null, imageMode: "url" });
    const img = new Image();
    img.onload = () => {
      set({ imageAspectRatio: img.naturalWidth / img.naturalHeight });
    };
    img.src = url;
  },

  setImageMode: (mode) => {
    set({ imageMode: mode, imageUrl: "", imageFile: null });
  },

  updateProp: (key, value) => {
    set({ [key]: value } as Partial<GeneratorState>);
  },

  triggerRender: async () => {
    const { imageUrl, imageFile, imageMode, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity, imageAspectRatio } = get();
    set({ exportStatus: "rendering", exportError: null, renderFrame: 0, renderTotalFrames: 0, renderPercent: 0 });

    try {
      let startRes: Response;
      if (imageMode === "file" && imageFile) {
        const form = new FormData();
        form.append("image", imageFile);
        form.append("accentColor", accentColor);
        form.append("entranceDurationFrames", String(entranceDurationFrames));
        form.append("imageZoom", String(imageZoom));
        form.append("cardScale", String(cardScale));
        form.append("glowIntensity", String(glowIntensity));
        form.append("imageAspectRatio", String(imageAspectRatio));
        startRes = await fetch("/api/render", { method: "POST", body: form });
      } else {
        startRes = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity, imageAspectRatio }),
        });
      }

      if (!startRes.ok) {
        const data = await startRes.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Server error ${startRes.status}`);
      }

      const { jobId } = (await startRes.json()) as { jobId: string };

      await new Promise<void>((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const res = await fetch(`/api/render/status/${jobId}`);
            if (!res.ok) { clearInterval(interval); reject(new Error("Status check failed")); return; }

            const status = await res.json() as
              | { state: "pending" }
              | { state: "progress"; frame: number; totalFrames: number; percent: number }
              | { state: "done"; downloadUrl: string }
              | { state: "error"; message: string };

            if (status.state === "progress") {
              set({ renderFrame: status.frame, renderTotalFrames: status.totalFrames, renderPercent: status.percent });
            } else if (status.state === "done") {
              clearInterval(interval);
              set({ renderPercent: 100 });

              const downloadRes = await fetch(status.downloadUrl);
              if (!downloadRes.ok) { reject(new Error("Download failed")); return; }

              const blob = await downloadRes.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "animation.mp4";
              a.click();
              URL.revokeObjectURL(url);
              resolve();
            } else if (status.state === "error") {
              clearInterval(interval);
              reject(new Error(status.message));
            }
          } catch (err) {
            clearInterval(interval);
            reject(new Error("Connection to render server lost"));
          }
        }, 2000);
      });

      set({ exportStatus: "done" });
      setTimeout(() => set({ exportStatus: "idle", renderPercent: 0 }), 4000);
    } catch (err) {
      set({ exportStatus: "error", exportError: String(err) });
    }
  },

  resetExport: () => set({ exportStatus: "idle", exportError: null, renderFrame: 0, renderTotalFrames: 0, renderPercent: 0 }),
}));
