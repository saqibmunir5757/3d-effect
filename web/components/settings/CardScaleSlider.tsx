import React from "react";
import { useGeneratorStore } from "../../store/generatorStore";

const MIN = 0.3;
const MAX = 1.0;
const STEP = 0.05;

export const CardScaleSlider: React.FC = () => {
  const { cardScale, updateProp } = useGeneratorStore();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          Card Size
        </span>
        <span style={{
          marginLeft: "auto",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--accent)",
        }}>
          {Math.round(cardScale * 100)}%
        </span>
      </div>

      <input
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={cardScale}
        onChange={(e) => updateProp("cardScale", Number(e.target.value))}
        style={{
          width: "100%",
          height: 4,
          accentColor: "var(--accent)",
          cursor: "pointer",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>30% (small)</span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>100% (full)</span>
      </div>
    </div>
  );
};
