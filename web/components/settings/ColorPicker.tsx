import React, { useRef } from "react";
import { useGeneratorStore } from "../../store/generatorStore";

const PRESETS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Rose",   value: "#f43f5e" },
  { label: "Amber",  value: "#f59e0b" },
  { label: "Emerald",value: "#10b981" },
  { label: "Sky",    value: "#0ea5e9" },
];

export const ColorPicker: React.FC = () => {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const { accentColor, updateProp } = useGeneratorStore();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          Accent Glow
        </span>
        <span style={{
          marginLeft: "auto",
          fontSize: 11,
          color: "var(--text-secondary)",
          fontFamily: "monospace",
          letterSpacing: "0.5px",
        }}>
          {accentColor.toUpperCase()}
        </span>
      </div>

      {/* Preset swatches */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {PRESETS.map((preset) => {
          const active = accentColor.toLowerCase() === preset.value.toLowerCase();
          return (
            <button
              key={preset.value}
              title={preset.label}
              onClick={() => updateProp("accentColor", preset.value)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: active ? "3px solid var(--text-primary)" : "3px solid transparent",
                background: preset.value,
                outline: active ? "2px solid white" : "2px solid transparent",
                outlineOffset: "-4px",
                transition: "transform 0.1s",
                cursor: "pointer",
              }}
            />
          );
        })}

        {/* Custom color */}
        <button
          title="Custom color"
          onClick={() => colorInputRef.current?.click()}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2px dashed var(--border)",
            background: "var(--surface-raised)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            ref={colorInputRef}
            type="color"
            value={accentColor}
            onChange={(e) => updateProp("accentColor", e.target.value)}
            style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
          />
        </button>
      </div>

      {/* Live preview bar */}
      <div style={{
        height: 4,
        borderRadius: 99,
        background: `linear-gradient(90deg, ${accentColor}22, ${accentColor}, ${accentColor}22)`,
        boxShadow: `0 0 12px 2px ${accentColor}66`,
        transition: "all 0.2s",
      }} />
    </div>
  );
};
