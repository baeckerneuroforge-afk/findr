import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  ONBOARDING_STEPS,
  type OnboardingStep,
} from "@/lib/onboarding/steps";

export interface OnboardingStatus {
  has_deals: boolean;
  has_risk_analysis: boolean;
  has_integration: boolean;
  has_slack: boolean;
  completed_steps: number;
  total_steps: number;
  is_complete: boolean;
  next_step?: OnboardingStep;
}

export interface OnboardingSignals {
  dealCount: number;
  riskCount: number;
  hasHubspot: boolean;
  hasGong: boolean;
  hasSlack: boolean;
}

export function deriveOnboardingStatus(
  signals: OnboardingSignals,
): OnboardingStatus {
  const has_deals = signals.dealCount > 0;
  const has_risk_analysis = signals.riskCount > 0;
  const has_integration = signals.hasHubspot || signals.hasGong;
  const has_slack = signals.hasSlack;

  const completed_steps = [
    has_integration,
    has_risk_analysis,
    has_slack,
  ].filter(Boolean).length;

  let next_step: OnboardingStep | undefined;
  if (!has_integration) next_step = ONBOARDING_STEPS[0];
  else if (!has_risk_analysis) next_step = ONBOARDING_STEPS[1];
  else if (!has_slack) next_step = ONBOARDING_STEPS[2];

  return {
    has_deals,
    has_risk_analysis,
    has_integration,
    has_slack,
    completed_steps,
    total_steps: ONBOARDING_STEPS.length,
    is_complete: completed_steps === ONBOARDING_STEPS.length,
    next_step,
  };
}

export async function getOnboardingStatus(
  orgId: string,
): Promise<OnboardingStatus> {
  const supabase = createAdminSupabaseClient();

  const [
    { count: dealCount },
    { count: riskCount },
    { data: hubspot },
    { data: gong },
    { data: slack },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("risk_scores")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("hubspot_integrations")
      .select("id")
      .eq("org_id", orgId)
      .eq("enabled", true)
      .maybeSingle(),
    supabase
      .from("gong_integrations")
      .select("id")
      .eq("org_id", orgId)
      .eq("enabled", true)
      .maybeSingle(),
    supabase
      .from("slack_integrations")
      .select("webhook_url")
      .eq("org_id", orgId)
      .eq("enabled", true)
      .maybeSingle(),
  ]);

  return deriveOnboardingStatus({
    dealCount: dealCount ?? 0,
    riskCount: riskCount ?? 0,
    hasHubspot: Boolean(hubspot),
    hasGong: Boolean(gong),
    hasSlack: Boolean(slack?.webhook_url),
  });
}

export type { OnboardingStep };
