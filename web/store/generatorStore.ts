import { create } from "zustand";

export type ExportStatus = "idle" | "rendering" | "done" | "error";

export type BgType = "solid" | "linear-gradient" | "radial-gradient" | "grid" | "dots" | "image";

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

  // Background
  bgType: BgType;
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  bgPatternSize: number;
  bgImageUrl: string;
  bgImageFile: File | null;
  savedBackgrounds: Array<{ label: string; bgType: BgType; bgColor1: string; bgColor2: string; bgAngle: number; bgPatternSize: number; bgImageUrl: string }>;

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
  updateProp: <K extends keyof Pick<GeneratorState, "accentColor" | "entranceDurationFrames" | "imageZoom" | "cardScale" | "glowIntensity" | "imageAspectRatio" | "bgType" | "bgColor1" | "bgColor2" | "bgAngle" | "bgPatternSize" | "bgImageUrl">>(
    key: K,
    value: GeneratorState[K]
  ) => void;
  setBgFromFile: (file: File) => void;
  saveCurrentBg: (label: string) => void;
  deleteSavedBg: (index: number) => void;
  loadSavedBackgrounds: () => void;
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
  bgType: "linear-gradient" as BgType,
  bgColor1: "#0a0a14",
  bgColor2: "#0e1628",
  bgAngle: 135,
  bgPatternSize: 30,
  bgImageUrl: "",
  bgImageFile: null,
  savedBackgrounds: JSON.parse(localStorage.getItem("savedBackgrounds") ?? "[]"),
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

  setBgFromFile: (file: File) => {
    set({ bgImageFile: file, bgType: "image" as BgType });
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      set({ bgImageUrl: dataUrl });
      // Upload to server for persistent storage
      const form = new FormData();
      form.append("image", file);
      fetch("/api/backgrounds/upload", { method: "POST", body: form })
        .then((res) => res.json())
        .then((data: { url?: string }) => {
          if (data.url) set({ bgImageUrl: data.url });
        })
        .catch(() => {});
    };
    reader.readAsDataURL(file);
  },

  saveCurrentBg: (label: string) => {
    const { bgType, bgColor1, bgColor2, bgAngle, bgPatternSize, bgImageUrl, savedBackgrounds } = get();
    const newBg = { label, bgType, bgColor1, bgColor2, bgAngle, bgPatternSize, bgImageUrl };
    const updated = [...savedBackgrounds, newBg];
    set({ savedBackgrounds: updated });
    localStorage.setItem("savedBackgrounds", JSON.stringify(updated));
  },

  deleteSavedBg: (index: number) => {
    const { savedBackgrounds } = get();
    const updated = savedBackgrounds.filter((_, i) => i !== index);
    set({ savedBackgrounds: updated });
    localStorage.setItem("savedBackgrounds", JSON.stringify(updated));
  },

  loadSavedBackgrounds: () => {
    const saved = JSON.parse(localStorage.getItem("savedBackgrounds") ?? "[]");
    set({ savedBackgrounds: saved });
  },

  triggerRender: async () => {
    const { imageUrl, imageFile, imageMode, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity, imageAspectRatio, bgType, bgColor1, bgColor2, bgAngle, bgPatternSize, bgImageUrl, bgImageFile } = get();
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
        form.append("bgType", bgType);
        form.append("bgColor1", bgColor1);
        form.append("bgColor2", bgColor2);
        form.append("bgAngle", String(bgAngle));
        form.append("bgPatternSize", String(bgPatternSize));
        form.append("bgImageUrl", bgImageUrl);
        if (bgImageFile && bgType === "image") form.append("bgImage", bgImageFile);
        startRes = await fetch("/api/render", { method: "POST", body: form });
      } else {
        startRes = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl, accentColor, entranceDurationFrames, imageZoom, cardScale, glowIntensity, imageAspectRatio, bgType, bgColor1, bgColor2, bgAngle, bgPatternSize, bgImageUrl }),
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
