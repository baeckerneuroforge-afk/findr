/**
 * Onboarding steps — STRUCTURAL only (id + target route). The id is the stable
 * key; the user-facing title / description / CTA label live in the i18n catalog
 * under `common.onboarding.steps.<id>` and are resolved in OnboardingChecklist
 * via useTranslations (so this module stays i18n-free and server-safe — it's
 * imported by status.ts under "server-only"). Order is meaningful: it drives
 * next_step selection in status.ts.
 */
export interface OnboardingStep {
  id: "connect_data" | "first_analysis" | "setup_slack";
  href: string;
}

const STEPS: OnboardingStep[] = [
  { id: "connect_data", href: "/dashboard/data-sources" },
  { id: "first_analysis", href: "/dashboard" },
  { id: "setup_slack", href: "/dashboard/integrations/slack" },
];

export { STEPS as ONBOARDING_STEPS };
