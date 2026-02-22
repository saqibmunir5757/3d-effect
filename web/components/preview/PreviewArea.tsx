import React from "react";
import { PlayerWrapper } from "./PlayerWrapper";
import { useGeneratorStore } from "../../store/generatorStore";

export const PreviewArea: React.FC = () => {
  const { imageUrl } = useGeneratorStore();
  const hasImage = imageUrl.length > 0;

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: hasImage ? "flex-start" : "center",
      padding: 32,
      gap: 20,
      overflow: "auto",
      background: "var(--bg)",
    }}>
      {hasImage ? (
        <>
          <div style={{ width: "100%", maxWidth: 960 }}>
            <PlayerWrapper />
          </div>
        </>
      ) : (
        /* Placeholder */
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "48px 40px",
          borderRadius: "var(--radius-xl)",
          border: "2px dashed var(--border)",
          background: "var(--surface)",
          maxWidth: 380,
          textAlign: "center",
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "var(--radius-lg)",
            background: "var(--accent-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <rect x="2" y="6" width="22" height="15" rx="2.5" stroke="var(--accent)" strokeWidth="1.8"/>
              <path d="M10 13.5l3-3 3 3M13 10.5v6" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", marginBottom: 5 }}>
              Upload an image to get started
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Your image will fly in with a cinematic 3D animation. Use the panel on the left to customize the look.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
