export interface TemplateDefinition {
  id: string;
  label: string;
  compositionId: string;
  durationInFrames: number;
  defaultProps: Record<string, unknown>;
}

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [
  {
    id: "DashboardFlyIn",
    label: "Dashboard Fly-In",
    compositionId: "DashboardFlyIn",
    durationInFrames: 230,
    defaultProps: {
      accentColor: "#6366f1",
      entranceDurationFrames: 60,
      title: "",
      subtitle: "",
      imageUrl: "",
    },
  },
  // Add new templates here — nothing else needs to change
];

export const getTemplate = (id: string): TemplateDefinition | undefined =>
  TEMPLATE_REGISTRY.find((t) => t.id === id);
