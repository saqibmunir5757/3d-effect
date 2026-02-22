import React from "react";
import { useGeneratorStore } from "../../store/generatorStore";

const FPS = 30;
const MIN = 20;
const MAX = 120;

export const DurationSlider: React.FC = () => {
  const { entranceDurationFrames, updateProp } = useGeneratorStore();
  const seconds = (entranceDurationFrames / FPS).toFixed(1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          Entrance Duration
        </span>
        <span style={{
          marginLeft: "auto",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--accent)",
        }}>
          {seconds}s
        </span>
      </div>

      <input
        type="range"
        min={MIN}
        max={MAX}
        step={5}
        value={entranceDurationFrames}
        onChange={(e) => updateProp("entranceDurationFrames", Number(e.target.value))}
        style={{
          width: "100%",
          height: 4,
          accentColor: "var(--accent)",
          cursor: "pointer",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{(MIN / FPS).toFixed(1)}s</span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{(MAX / FPS).toFixed(1)}s</span>
      </div>
    </div>
  );
};
