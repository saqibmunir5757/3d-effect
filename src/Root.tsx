import { Composition } from "remotion";
import { DashboardFlyIn, DashboardFlyInSchema } from "./DashboardFlyIn";

const FPS = 30;
// 60-frame entrance + 30-frame hold + 50-frame flip + 0.7 s idle float
const DURATION = 60 + 30 + 50 + Math.round(0.7 * FPS);

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DashboardFlyIn"
      component={DashboardFlyIn}
      schema={DashboardFlyInSchema}
      durationInFrames={DURATION}
      fps={FPS}
      width={1280}
      height={720}
      defaultProps={{
        imageUrl: "dashboard.png",
        title: "Dashboard Overview",
        subtitle: "Q1 2025 • Live Metrics",
        accentColor: "#6366f1",
        entranceDurationFrames: 60,
      }}
    />
  );
};
