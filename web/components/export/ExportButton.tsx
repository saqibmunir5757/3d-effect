import React from "react";
import { useGeneratorStore, ExportStatus } from "../../store/generatorStore";

const LABEL: Record<ExportStatus, string> = {
  idle: "Download 720p MP4",
  rendering: "Rendering…",
  done: "Downloaded!",
  error: "Retry",
};

const BG: Record<ExportStatus, string> = {
  idle: "#18181f",
  rendering: "#3b3b52",
  done: "#10b981",
  error: "#ef4444",
};

export const ExportButton: React.FC = () => {
  const {
    imageUrl,
    exportStatus,
    exportError,
    renderFrame,
    renderTotalFrames,
    renderPercent,
    triggerRender,
    resetExport,
  } = useGeneratorStore();

  const disabled = !imageUrl || exportStatus === "rendering";
  const isRendering = exportStatus === "rendering";

  const handleClick = () => {
    if (exportStatus === "error") { resetExport(); return; }
    triggerRender();
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "13px 0",
          borderRadius: "var(--radius-md)",
          border: "none",
          background: disabled && exportStatus === "idle" ? "#c8c8d8" : BG[exportStatus],
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.1px",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "background 0.2s",
        }}
      >
        {isRendering && <Spinner />}
        {exportStatus === "done" && <CheckIcon />}
        {exportStatus === "idle" && !disabled && <DownloadIcon />}
        {LABEL[exportStatus]}
      </button>

      {/* Progress bar + frame counter */}
      {isRendering && (
        <div style={{ marginTop: 10 }}>
          {/* Track */}
          <div style={{
            width: "100%",
            height: 6,
            borderRadius: 99,
            background: "var(--border)",
            overflow: "hidden",
          }}>
            {/* Fill */}
            <div style={{
              height: "100%",
              width: `${renderPercent}%`,
              borderRadius: 99,
              background: "var(--accent)",
              transition: "width 0.3s ease",
            }} />
          </div>

          {/* Labels row */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 5,
          }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {renderTotalFrames > 0
                ? `Frame ${renderFrame} / ${renderTotalFrames}`
                : "Starting…"}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)" }}>
              {renderPercent}%
            </span>
          </div>
        </div>
      )}

      {exportStatus === "error" && exportError && (
        <p style={{ marginTop: 6, fontSize: 11, color: "#ef4444", textAlign: "center" }}>
          {exportError}
        </p>
      )}

      {!imageUrl && (
        <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-tertiary)", textAlign: "center" }}>
          Upload an image first
        </p>
      )}
    </div>
  );
};

const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
    <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1v8M4 6l3 3 3-3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 11h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 7l3.5 3.5 5.5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
