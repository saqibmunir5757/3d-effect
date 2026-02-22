import React, { useEffect, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { DashboardFlyIn } from "../../../src/DashboardFlyIn";
import { useGeneratorStore } from "../../store/generatorStore";

const COMP_WIDTH = 1280;
const COMP_HEIGHT = 720;
const DURATION_IN_FRAMES = 161; // 60 entrance + 30 hold + 50 flip + 21 idle (matches Root.tsx)
const FPS = 30;

export const PlayerWrapper: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const { imageUrl, accentColor, entranceDurationFrames, imageZoom } = useGeneratorStore();

  // Measure container width and update on resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 800;
      setContainerWidth(width);
    });
    observer.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  const scale = containerWidth / COMP_WIDTH;
  const scaledHeight = COMP_HEIGHT * scale;

  const inputProps = {
    imageUrl,
    accentColor,
    entranceDurationFrames,
    imageZoom,
    title: "",
    subtitle: "",
  };

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <div style={{
        width: containerWidth,
        height: scaledHeight,
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)",
      }}>
        <Player
          component={DashboardFlyIn}
          compositionWidth={COMP_WIDTH}
          compositionHeight={COMP_HEIGHT}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          style={{
            width: COMP_WIDTH,
            height: COMP_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          inputProps={inputProps}
          autoPlay
          loop
          controls
          clickToPlay={false}
        />
      </div>
    </div>
  );
};
