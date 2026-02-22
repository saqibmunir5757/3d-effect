import React from "react";
import { ColorPicker } from "./ColorPicker";
import { DurationSlider } from "./DurationSlider";
import { ZoomSlider } from "./ZoomSlider";
import { CardScaleSlider } from "./CardScaleSlider";
import { GlowIntensitySlider } from "./GlowIntensitySlider";

const Divider = () => (
  <div style={{ borderTop: "1px solid var(--border)", margin: "16px 0" }} />
);

export const SettingsPanel: React.FC = () => {
  return (
    <div>
      <ColorPicker />
      <Divider />
      <DurationSlider />
      <Divider />
      <ZoomSlider />
      <Divider />
      <CardScaleSlider />
      <Divider />
      <GlowIntensitySlider />
    </div>
  );
};
