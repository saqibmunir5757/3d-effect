import React, { useRef, useState } from "react";
import { useGeneratorStore, BgType } from "../../store/generatorStore";

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
interface BgPreset {
  label: string;
  bgType: BgType;
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  bgPatternSize: number;
}

const PRESETS: BgPreset[] = [
  // Solids
  { label: "Black",       bgType: "solid", bgColor1: "#000000", bgColor2: "", bgAngle: 0, bgPatternSize: 30 },
  { label: "Dark Navy",   bgType: "solid", bgColor1: "#0a0a14", bgColor2: "", bgAngle: 0, bgPatternSize: 30 },
  { label: "Charcoal",    bgType: "solid", bgColor1: "#1a1a2e", bgColor2: "", bgAngle: 0, bgPatternSize: 30 },
  { label: "White",       bgType: "solid", bgColor1: "#ffffff", bgColor2: "", bgAngle: 0, bgPatternSize: 30 },
  { label: "Off White",   bgType: "solid", bgColor1: "#f0f0f0", bgColor2: "", bgAngle: 0, bgPatternSize: 30 },
  // Gradients
  { label: "Dark Default",bgType: "linear-gradient", bgColor1: "#0a0a14", bgColor2: "#0e1628", bgAngle: 135, bgPatternSize: 30 },
  { label: "Midnight",    bgType: "linear-gradient", bgColor1: "#0f0c29", bgColor2: "#302b63", bgAngle: 135, bgPatternSize: 30 },
  { label: "Ocean",       bgType: "linear-gradient", bgColor1: "#0f2027", bgColor2: "#2c5364", bgAngle: 135, bgPatternSize: 30 },
  { label: "Sunset",      bgType: "linear-gradient", bgColor1: "#2d1b69", bgColor2: "#6b2fa0", bgAngle: 135, bgPatternSize: 30 },
  { label: "Rose",        bgType: "linear-gradient", bgColor1: "#1a0a0a", bgColor2: "#4a1528", bgAngle: 135, bgPatternSize: 30 },
  { label: "Forest",      bgType: "linear-gradient", bgColor1: "#0a1a0a", bgColor2: "#1a4a28", bgAngle: 135, bgPatternSize: 30 },
  { label: "Radial Dark", bgType: "radial-gradient", bgColor1: "#1a1a2e", bgColor2: "#000000", bgAngle: 0, bgPatternSize: 30 },
  { label: "Radial Blue", bgType: "radial-gradient", bgColor1: "#1a2a4e", bgColor2: "#0a0a14", bgAngle: 0, bgPatternSize: 30 },
  // Patterns
  { label: "Grid Dark",   bgType: "grid", bgColor1: "#0a0a14", bgColor2: "#ffffff", bgAngle: 0, bgPatternSize: 30 },
  { label: "Grid Light",  bgType: "grid", bgColor1: "#f0f0f0", bgColor2: "#cccccc", bgAngle: 0, bgPatternSize: 30 },
  { label: "Dots Dark",   bgType: "dots", bgColor1: "#0a0a14", bgColor2: "#ffffff", bgAngle: 0, bgPatternSize: 20 },
  { label: "Dots Light",  bgType: "dots", bgColor1: "#f0f0f0", bgColor2: "#999999", bgAngle: 0, bgPatternSize: 20 },
];

// ---------------------------------------------------------------------------
// Thumbnail preview style (matches getBgStyle in DashboardFlyIn)
// ---------------------------------------------------------------------------
function thumbStyle(type: BgType, c1: string, c2: string, angle: number, size: number, imgUrl?: string): React.CSSProperties {
  switch (type) {
    case "solid":
      return { background: c1 };
    case "linear-gradient":
      return { background: `linear-gradient(${angle}deg, ${c1}, ${c2})` };
    case "radial-gradient":
      return { background: `radial-gradient(ellipse at center, ${c1}, ${c2})` };
    case "grid":
      return {
        backgroundColor: c1,
        backgroundImage: `linear-gradient(${c2}40 1px, transparent 1px), linear-gradient(90deg, ${c2}40 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      };
    case "dots":
      return {
        backgroundColor: c1,
        backgroundImage: `radial-gradient(circle, ${c2}60 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      };
    case "image":
      return { backgroundImage: `url(${imgUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
    default:
      return { background: "#0a0a14" };
  }
}

// ---------------------------------------------------------------------------
// Type tab labels
// ---------------------------------------------------------------------------
const TYPE_TABS: { label: string; value: BgType | "presets" }[] = [
  { label: "Presets", value: "presets" },
  { label: "Solid", value: "solid" },
  { label: "Gradient", value: "linear-gradient" },
  { label: "Grid", value: "grid" },
  { label: "Dots", value: "dots" },
  { label: "Image", value: "image" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const BackgroundPicker: React.FC = () => {
  const {
    bgType, bgColor1, bgColor2, bgAngle, bgPatternSize, bgImageUrl,
    savedBackgrounds, updateProp, setBgFromFile, saveCurrentBg, deleteSavedBg,
  } = useGeneratorStore();

  const [activeTab, setActiveTab] = useState<BgType | "presets">("presets");
  const [saveLabel, setSaveLabel] = useState("");
  const bgFileRef = useRef<HTMLInputElement>(null);

  const applyPreset = (p: BgPreset) => {
    updateProp("bgType", p.bgType);
    updateProp("bgColor1", p.bgColor1);
    updateProp("bgColor2", p.bgColor2);
    updateProp("bgAngle", p.bgAngle);
    updateProp("bgPatternSize", p.bgPatternSize);
    updateProp("bgImageUrl", "");
  };

  const isActivePreset = (p: BgPreset) =>
    bgType === p.bgType && bgColor1 === p.bgColor1 && bgColor2 === p.bgColor2 && bgAngle === p.bgAngle;

  // Section label style
  const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Background</span>
      </div>

      {/* Type tabs */}
      <div style={{ display: "flex", gap: 3, marginBottom: 12, flexWrap: "wrap" }}>
        {TYPE_TABS.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                border: active ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                background: active ? "var(--accent-light)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: 500,
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Presets tab ─────────────────────────────────────────────── */}
      {activeTab === "presets" && (
        <div>
          <div style={sectionLabel}>Presets</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 12 }}>
            {PRESETS.map((p, i) => (
              <button
                key={i}
                title={p.label}
                onClick={() => applyPreset(p)}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: 6,
                  border: isActivePreset(p) ? "2px solid var(--accent)" : "2px solid var(--border)",
                  cursor: "pointer",
                  ...thumbStyle(p.bgType, p.bgColor1, p.bgColor2, p.bgAngle, p.bgPatternSize),
                }}
              />
            ))}
          </div>

          {/* Saved custom backgrounds */}
          {savedBackgrounds.length > 0 && (
            <>
              <div style={sectionLabel}>Saved</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 12 }}>
                {savedBackgrounds.map((s, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <button
                      title={s.label}
                      onClick={() => {
                        updateProp("bgType", s.bgType);
                        updateProp("bgColor1", s.bgColor1);
                        updateProp("bgColor2", s.bgColor2);
                        updateProp("bgAngle", s.bgAngle);
                        updateProp("bgPatternSize", s.bgPatternSize);
                        updateProp("bgImageUrl", s.bgImageUrl);
                      }}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        borderRadius: 6,
                        border: "2px solid var(--border)",
                        cursor: "pointer",
                        ...thumbStyle(s.bgType, s.bgColor1, s.bgColor2, s.bgAngle, s.bgPatternSize, s.bgImageUrl),
                      }}
                    />
                    <button
                      onClick={() => deleteSavedBg(i)}
                      title="Delete"
                      style={{
                        position: "absolute", top: -4, right: -4,
                        width: 14, height: 14, borderRadius: "50%",
                        background: "rgba(0,0,0,0.7)", color: "#fff",
                        border: "none", fontSize: 9, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        lineHeight: 1,
                      }}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Solid tab ───────────────────────────────────────────────── */}
      {activeTab === "solid" && (
        <div>
          <div style={sectionLabel}>Color</div>
          <input
            type="color"
            value={bgColor1}
            onChange={(e) => { updateProp("bgType", "solid"); updateProp("bgColor1", e.target.value); }}
            style={{ width: "100%", height: 36, border: "none", borderRadius: 6, cursor: "pointer" }}
          />
        </div>
      )}

      {/* ── Gradient tab ────────────────────────────────────────────── */}
      {(activeTab === "linear-gradient" || activeTab === "radial-gradient") && (
        <div>
          {/* Linear / Radial toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {(["linear-gradient", "radial-gradient"] as const).map((t) => {
              const active = bgType === t;
              return (
                <button
                  key={t}
                  onClick={() => { updateProp("bgType", t); setActiveTab(t); }}
                  style={{
                    flex: 1, padding: "5px 0", borderRadius: "var(--radius-sm)",
                    border: active ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                    background: active ? "var(--accent-light)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    fontWeight: 500, fontSize: 11, cursor: "pointer",
                  }}
                >
                  {t === "linear-gradient" ? "Linear" : "Radial"}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={sectionLabel}>Color 1</div>
              <input
                type="color" value={bgColor1}
                onChange={(e) => updateProp("bgColor1", e.target.value)}
                style={{ width: "100%", height: 32, border: "none", borderRadius: 6, cursor: "pointer" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={sectionLabel}>Color 2</div>
              <input
                type="color" value={bgColor2}
                onChange={(e) => updateProp("bgColor2", e.target.value)}
                style={{ width: "100%", height: 32, border: "none", borderRadius: 6, cursor: "pointer" }}
              />
            </div>
          </div>

          {bgType === "linear-gradient" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Angle</span>
                <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{bgAngle}°</span>
              </div>
              <input
                type="range" min={0} max={360} step={5} value={bgAngle}
                onChange={(e) => updateProp("bgAngle", Number(e.target.value))}
                style={{ width: "100%", height: 4, accentColor: "var(--accent)", cursor: "pointer" }}
              />
            </div>
          )}

          {/* Preview */}
          <div style={{
            height: 32, borderRadius: 6, marginTop: 10,
            ...thumbStyle(bgType, bgColor1, bgColor2, bgAngle, bgPatternSize),
          }} />
        </div>
      )}

      {/* ── Grid tab ────────────────────────────────────────────────── */}
      {activeTab === "grid" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={sectionLabel}>Background</div>
              <input
                type="color" value={bgColor1}
                onChange={(e) => { updateProp("bgType", "grid"); updateProp("bgColor1", e.target.value); }}
                style={{ width: "100%", height: 32, border: "none", borderRadius: 6, cursor: "pointer" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={sectionLabel}>Lines</div>
              <input
                type="color" value={bgColor2}
                onChange={(e) => { updateProp("bgType", "grid"); updateProp("bgColor2", e.target.value); }}
                style={{ width: "100%", height: 32, border: "none", borderRadius: 6, cursor: "pointer" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Grid Size</span>
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{bgPatternSize}px</span>
          </div>
          <input
            type="range" min={10} max={80} step={2} value={bgPatternSize}
            onChange={(e) => { updateProp("bgType", "grid"); updateProp("bgPatternSize", Number(e.target.value)); }}
            style={{ width: "100%", height: 4, accentColor: "var(--accent)", cursor: "pointer" }}
          />
          <div style={{
            height: 48, borderRadius: 6, marginTop: 10,
            ...thumbStyle("grid", bgColor1, bgColor2, 0, bgPatternSize),
          }} />
        </div>
      )}

      {/* ── Dots tab ────────────────────────────────────────────────── */}
      {activeTab === "dots" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={sectionLabel}>Background</div>
              <input
                type="color" value={bgColor1}
                onChange={(e) => { updateProp("bgType", "dots"); updateProp("bgColor1", e.target.value); }}
                style={{ width: "100%", height: 32, border: "none", borderRadius: 6, cursor: "pointer" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={sectionLabel}>Dots</div>
              <input
                type="color" value={bgColor2}
                onChange={(e) => { updateProp("bgType", "dots"); updateProp("bgColor2", e.target.value); }}
                style={{ width: "100%", height: 32, border: "none", borderRadius: 6, cursor: "pointer" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Dot Spacing</span>
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>{bgPatternSize}px</span>
          </div>
          <input
            type="range" min={8} max={60} step={2} value={bgPatternSize}
            onChange={(e) => { updateProp("bgType", "dots"); updateProp("bgPatternSize", Number(e.target.value)); }}
            style={{ width: "100%", height: 4, accentColor: "var(--accent)", cursor: "pointer" }}
          />
          <div style={{
            height: 48, borderRadius: 6, marginTop: 10,
            ...thumbStyle("dots", bgColor1, bgColor2, 0, bgPatternSize),
          }} />
        </div>
      )}

      {/* ── Image tab ───────────────────────────────────────────────── */}
      {activeTab === "image" && (
        <div>
          <button
            onClick={() => bgFileRef.current?.click()}
            style={{
              width: "100%", padding: "10px 0", borderRadius: "var(--radius-sm)",
              border: "2px dashed var(--border)", background: "var(--surface-raised)",
              color: "var(--text-secondary)", fontWeight: 500, fontSize: 12,
              cursor: "pointer", marginBottom: 8,
            }}
          >
            Upload Background Image
          </button>
          <input
            ref={bgFileRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setBgFromFile(f); }}
          />
          {bgImageUrl && bgType === "image" && (
            <div style={{
              height: 80, borderRadius: 6, marginBottom: 8,
              ...thumbStyle("image", "", "", 0, 0, bgImageUrl),
            }} />
          )}
        </div>
      )}

      {/* ── Save current as preset ──────────────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 10 }}>
        <div style={sectionLabel}>Save Current Background</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            placeholder="Name..."
            value={saveLabel}
            onChange={(e) => setSaveLabel(e.target.value)}
            style={{
              flex: 1, padding: "6px 8px", borderRadius: "var(--radius-sm)",
              border: "1.5px solid var(--border)", fontSize: 11,
              color: "var(--text-primary)", outline: "none",
            }}
          />
          <button
            onClick={() => { if (saveLabel.trim()) { saveCurrentBg(saveLabel.trim()); setSaveLabel(""); } }}
            style={{
              padding: "6px 12px", borderRadius: "var(--radius-sm)",
              border: "none", background: "var(--accent)", color: "#fff",
              fontWeight: 600, fontSize: 11, cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
