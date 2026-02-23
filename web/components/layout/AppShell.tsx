import React, { useState } from "react";
import { ImageUploadArea } from "../upload/ImageUploadArea";
import { SettingsPanel } from "../settings/SettingsPanel";
import { PreviewArea } from "../preview/PreviewArea";
import { ExportButton } from "../export/ExportButton";
import { HistoryPage } from "../history/HistoryPage";

export const AppShell: React.FC = () => {
  const [tab, setTab] = useState<"generator" | "history">("generator");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 8,
    cursor: "pointer",
    border: "none",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "white" : "var(--text-secondary)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{
        height: 56,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 12,
        flexShrink: 0,
        boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="4" width="12" height="8" rx="1.5" stroke="white" strokeWidth="1.5"/>
            <path d="M5 4V3a2 2 0 0 1 4 0v1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>
          Motion Studio
        </span>
        <span style={{
          marginLeft: 6,
          fontSize: 11,
          fontWeight: 500,
          color: "var(--accent)",
          background: "var(--accent-light)",
          padding: "2px 7px",
          borderRadius: 20,
          letterSpacing: "0.3px",
        }}>
          BETA
        </span>

        {/* Tabs */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button style={tabStyle(tab === "generator")} onClick={() => setTab("generator")}>Generator</button>
          <button style={tabStyle(tab === "history")} onClick={() => setTab("history")}>History</button>
        </div>
      </header>

      {/* History tab */}
      {tab === "history" && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <HistoryPage />
        </div>
      )}

      {/* Generator tab — two-column layout */}
      <div style={{ display: tab === "generator" ? "flex" : "none", flex: 1, overflow: "hidden" }}>
        {/* Left sidebar */}
        <aside style={{
          width: 340,
          flexShrink: 0,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}>
          <div style={{ padding: "20px 20px 0" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Image Source
            </p>
            <ImageUploadArea />
          </div>

          <div style={{ margin: "20px 0", borderTop: "1px solid var(--border)" }} />

          <div style={{ padding: "0 20px 0" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12 }}>
              Animation Settings
            </p>
            <SettingsPanel />
          </div>

          {/* Export — pinned to bottom of sidebar */}
          <div style={{ marginTop: "auto", padding: "20px", borderTop: "1px solid var(--border)" }}>
            <ExportButton />
          </div>
        </aside>

        {/* Right preview area */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <PreviewArea />
        </main>
      </div>
    </div>
  );
};
