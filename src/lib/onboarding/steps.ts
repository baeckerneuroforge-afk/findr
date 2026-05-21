export interface OnboardingStep {
  id: "connect_data" | "first_analysis" | "setup_slack";
  title: string;
  description: string;
  href: string;
  cta_label: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: "connect_data",
    title: "Connect your CRM or call source",
    description:
      "Sync deals from Hubspot or import calls from Gong to start analyzing.",
    href: "/dashboard/integrations/hubspot",
    cta_label: "Connect Hubspot",
  },
  {
    id: "first_analysis",
    title: "Run your first risk analysis",
    description:
      "Analyze a deal to see risk signals, evidence, and recommendations.",
    href: "/dashboard",
    cta_label: "Go to pipeline",
  },
  {
    id: "setup_slack",
    title: "Get alerts in Slack",
    description: "Receive real-time alerts when deals show risk signals.",
    href: "/dashboard/integrations/slack",
    cta_label: "Set up Slack",
  },
];

export { STEPS as ONBOARDING_STEPS };
