import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@web": path.resolve(__dirname, "web"),
    },
  },
  build: {
    outDir: "dist/web",
  },
  server: {
    proxy: {
      // SSE progress endpoint — disable buffering so events stream through live
      "/api/render/progress": {
        target: "http://localhost:3001",
        changeOrigin: true,
        headers: { "Cache-Control": "no-cache" },
      },
      // All other API calls
      "/api": "http://localhost:3001",
    },
  },
});
