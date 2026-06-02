import type { PanelCompletion } from "@/lib/research/panel";

export const PANEL_PROVIDER_KEYS = ["prolific"] as const;
export type PanelProviderKey = (typeof PANEL_PROVIDER_KEYS)[number];

export interface PanelCredentialValidationSuccess {
  ok: true;
  providerUserId: string;
  providerUserEmail: string | null;
}

export interface PanelCredentialValidationFailure {
  ok: false;
  reason: "invalid" | "unavailable";
}

export type PanelCredentialValidationResult =
  | PanelCredentialValidationSuccess
  | PanelCredentialValidationFailure;

export interface CreatePanelStudyDraftInput {
  name: string;
  description: string;
  externalStudyUrl: string;
  totalAvailablePlaces: number;
  estimatedCompletionTime: number;
  rewardCents: number;
  screenoutRewardCents: number;
  screenoutSlots: number;
}

export interface PanelStudyDraft {
  provider: PanelProviderKey;
  providerStudyId: string;
  status: string;
  externalStudyUrl: string;
  completion: PanelCompletion;
}

export interface PanelProvider {
  key: PanelProviderKey;
  validateCredentials(apiToken: string): Promise<PanelCredentialValidationResult>;
  getCompletionUrls(codes: {
    completeCode: string;
    screenoutCode: string;
  }): PanelCompletion;
  createStudyDraft(
    apiToken: string,
    input: CreatePanelStudyDraftInput,
  ): Promise<PanelStudyDraft>;
}
