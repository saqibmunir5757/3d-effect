import React, { memo, useCallback, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
export const DashboardFlyInSchema = z.object({
  imageUrl: z.string().url().or(z.string().min(1)),
  title: z.string().default("Dashboard Overview"),
  subtitle: z.string().default("Q1 2025 • Live Metrics"),
  accentColor: z.string().default("#ffffff"),
  entranceDurationFrames: z.number().int().positive().default(60),
  imageZoom: z.number().min(1).max(3).default(1.0),
  cardScale: z.number().min(0.3).max(1.0).default(0.7),
  glowIntensity: z.number().min(0).max(2).default(1.0),
});

export type DashboardFlyInProps = z.infer<typeof DashboardFlyInSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const START_ROTATE_X  =  55;
const START_ROTATE_Y  =  25;
const LAND_ROTATE_X   =  15;
const LAND_ROTATE_Y   = -10;
const FLIP_ROTATE_X   =  12;
const FLIP_ROTATE_Y   =  10;
const HOLD_FRAMES     =  30;

const FLOAT_AMPLITUDE_PX = 5;
const FLOAT_PERIOD_S     = 3.5;

// ---------------------------------------------------------------------------
// SlabLayers — memoized, only re-renders when src/cardW/cardH change.
// Uses CSS background-image instead of <Img> tags so the browser decodes
// the image once and reuses the GPU texture across all depth layers.
// ---------------------------------------------------------------------------
interface SlabLayersProps {
  src: string;
  boxShadow: string;
  zoom: number;
  onLoad: () => void;
  onError: () => void;
}

const SLAB_DEPTH = 4;   // number of CSS box-shadow "thickness" steps
const SLAB_Z_STEP = 0.5;

const SlabLayers: React.FC<SlabLayersProps> = memo(
  ({ src, boxShadow, zoom, onLoad, onError }) => {
    // Build a multi-layer box-shadow that simulates extruded thickness.
    // Each step is a tiny dark inset shadow offset behind the card.
    // This is pure CSS — zero extra image decodes.
    const thicknessShadow = useMemo(() => {
      const steps = Array.from({ length: SLAB_DEPTH }, (_, i) => {
        const z = (i + 1) * SLAB_Z_STEP;
        const alpha = (0.55 - i * 0.08).toFixed(2);
        // translateZ isn't available in box-shadow; we simulate depth
        // with progressively offset, darkening inset shadows on the edge.
        return `${z}px ${z}px 0px rgba(0,0,0,${alpha})`;
      });
      return steps.join(", ");
    }, []);

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          overflow: "hidden",
          // Combine the animated glow/drop shadow with the static thickness shadow
          boxShadow: `${boxShadow}, ${thicknessShadow}`,
        }}
      >
        {/* Single <Img> — decoded ONCE by Chromium, no duplicate texture loads */}
        <Img
          src={src}
          onLoad={onLoad}
          onError={onError}
          style={{
            width: `${zoom * 100}%`,
            height: `${zoom * 100}%`,
            objectFit: "cover",
            display: "block",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
    );
  },
  // Custom comparator — only re-render when src or shadow string actually changes
  (prev, next) =>
    prev.src === next.src &&
    prev.boxShadow === next.boxShadow &&
    prev.zoom === next.zoom
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const DashboardFlyInInner: React.FC<DashboardFlyInProps> = ({
  imageUrl,
  accentColor,
  entranceDurationFrames,
  imageZoom = 1.0,
  cardScale = 0.7,
  glowIntensity = 1.0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // ── delayRender / continueRender ─────────────────────────────────────────
  const handleRef = useRef<number | null>(null);
  const resolvedUrlRef = useRef<string>("");

  if (resolvedUrlRef.current !== imageUrl) {
    resolvedUrlRef.current = imageUrl;
    handleRef.current = delayRender(`Loading image: ${imageUrl}`);
  }

  const onImageLoad = useCallback(() => {
    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  }, []);

  const onImageError = useCallback(() => {
    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
    }
  }, []);

  // ── Phase 1: entrance spring ──────────────────────────────────────────────
  const entranceProgress = spring({
    frame,
    fps,
    durationInFrames: entranceDurationFrames,
    config: { damping: 14, stiffness: 100, mass: 1.4 },
  });

  // ── Phase 2: flip spring ──────────────────────────────────────────────────
  const flipStartFrame = entranceDurationFrames + HOLD_FRAMES;
  const flipProgress = spring({
    frame: frame - flipStartFrame,
    fps,
    durationInFrames: 50,
    config: { damping: 18, stiffness: 90, mass: 1.2 },
  });

  // ── Rotations ─────────────────────────────────────────────────────────────
  const rotateX = interpolate(entranceProgress, [0, 1], [START_ROTATE_X, LAND_ROTATE_X])
    + interpolate(flipProgress, [0, 1], [0, FLIP_ROTATE_X - LAND_ROTATE_X]);

  const rotateY = interpolate(entranceProgress, [0, 1], [START_ROTATE_Y, LAND_ROTATE_Y])
    + interpolate(flipProgress, [0, 1], [0, FLIP_ROTATE_Y - LAND_ROTATE_Y]);

  const scale = interpolate(entranceProgress, [0, 1], [0.5, 1.0]);

  // ── Glow + drop shadow ────────────────────────────────────────────────────
  const shadowBlur   = interpolate(entranceProgress, [0, 1], [100, 30]);
  const shadowY      = interpolate(entranceProgress, [0, 1], [80,  22]);
  const shadowSpread = interpolate(entranceProgress, [0, 1], [-20,  0]);
  const shadowAlpha  = interpolate(entranceProgress, [0, 1], [0.15, 0.5]);
  const glowAlpha    = interpolate(entranceProgress, [0, 1], [0, 0.75]) * glowIntensity;
  const glowSpread   = interpolate(entranceProgress, [0, 1], [0, 18])  * glowIntensity;
  const glowBlur     = interpolate(entranceProgress, [0, 1], [0, 40])  * glowIntensity;
  const glowFixed    = Math.min(glowIntensity, 1);

  const boxShadow = [
    `0 ${shadowY}px ${shadowBlur}px ${shadowSpread}px rgba(0,0,0,${shadowAlpha})`,
    `0 0 ${glowBlur}px ${glowSpread}px ${accentColor}${Math.round(Math.min(glowAlpha, 1) * 255).toString(16).padStart(2, "0")}`,
    `0 0 12px 2px ${accentColor}${Math.round(glowFixed * 0.33 * 255).toString(16).padStart(2, "0")}`,
  ].join(", ");

  // ── Idle float ────────────────────────────────────────────────────────────
  const floatBlend = interpolate(
    frame,
    [entranceDurationFrames * 0.9, entranceDurationFrames * 1.15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const floatY =
    Math.sin((frame / fps / FLOAT_PERIOD_S) * 2 * Math.PI) *
    FLOAT_AMPLITUDE_PX *
    floatBlend;

  // ── Resolve image src ─────────────────────────────────────────────────────
  const resolvedSrc = /^(https?|data|file):/.test(imageUrl) ? imageUrl : staticFile(imageUrl);

  // ── Card dimensions ───────────────────────────────────────────────────────
  const CARD_W = width * cardScale;
  const CARD_H = CARD_W * (9 / 16);

  const transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale}) translateY(${floatY}px)`;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a14 0%, #12121f 60%, #0e1628 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: "1200px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      {/* Ambient glow behind slab */}
      <div
        style={{
          position: "absolute",
          width: CARD_W * 1.3,
          height: CARD_H * 1.3,
          borderRadius: 60,
          background: `radial-gradient(ellipse at 40% 60%, ${accentColor}22 0%, transparent 68%)`,
          transform,
          opacity: entranceProgress * glowIntensity,
          transformStyle: "preserve-3d",
        }}
      />

      {/* Slab wrapper */}
      <div
        style={{
          position: "relative",
          width: CARD_W,
          height: CARD_H,
          transformStyle: "preserve-3d",
          transform,
        }}
      >
        {/* Single SlabLayers component — ONE image decode, CSS thickness illusion */}
        <SlabLayers
          src={resolvedSrc}
          boxShadow={boxShadow}
          zoom={imageZoom}
          onLoad={onImageLoad}
          onError={onImageError}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// React.memo — fast Studio scrubbing
// ---------------------------------------------------------------------------
export const DashboardFlyIn = memo(DashboardFlyInInner);
