import React from "react";
import { useGeneratorStore } from "../../store/generatorStore";

const MIN = 0.0;
const MAX = 2.0;
const STEP = 0.05;

export const GlowIntensitySlider: React.FC = () => {
  const { glowIntensity, accentColor, updateProp } = useGeneratorStore();

  const label =
    glowIntensity === 0 ? "Off" :
    glowIntensity <= 0.5 ? "Subtle" :
    glowIntensity <= 1.0 ? "Normal" :
    glowIntensity <= 1.5 ? "Strong" : "Intense";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          Glow Intensity
        </span>
        <span style={{
          marginLeft: "auto",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--accent)",
        }}>
          {label}
        </span>
      </div>

      <input
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={glowIntensity}
        onChange={(e) => updateProp("glowIntensity", Number(e.target.value))}
        style={{
          width: "100%",
          height: 4,
          accentColor: "var(--accent)",
          cursor: "pointer",
        }}
      />

      {/* Live glow preview bar */}
      <div style={{
        height: 4,
        borderRadius: 99,
        marginTop: 8,
        background: `linear-gradient(90deg, ${accentColor}11, ${accentColor}, ${accentColor}11)`,
        boxShadow: `0 0 ${Math.round(glowIntensity * 12)}px ${Math.round(glowIntensity * 4)}px ${accentColor}${Math.round(glowIntensity * 0.5 * 255).toString(16).padStart(2, "0")}`,
        opacity: glowIntensity === 0 ? 0.15 : 1,
        transition: "all 0.15s",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Off</span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Intense</span>
      </div>
    </div>
  );
};
