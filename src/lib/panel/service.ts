import "server-only";

import { researchOpenLinkUrl } from "@/lib/email/research-invite";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  getOpenLinkForPlan,
  updateOpenLinkPanelCompletion,
} from "@/lib/research/open-links";
import {
  deletePanelCredential,
  getPanelCredentialSummary,
  getPanelCredentialToken,
  updatePanelCredentialValidation,
  upsertPanelCredential,
  type PanelCredentialSummary,
} from "./credentials";
import { buildProlificExternalStudyUrl, prolificProvider } from "./prolific";
import type { PanelStudyDraft } from "./providers";

const PROVIDER = "prolific" as const;

export type ProlificConnectionStatus =
  | { ok: true; summary: PanelCredentialSummary }
  | { ok: false; reason: "invalid" | "unavailable" | "missing_token" };

export async function getProlificCredentialSummary(orgId: string) {
  return getPanelCredentialSummary(orgId, PROVIDER);
}

export async function saveProlificCredential(
  orgId: string,
  apiToken: string,
): Promise<ProlificConnectionStatus> {
  const validation = await prolificProvider.validateCredentials(apiToken);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  const summary = await upsertPanelCredential({
    orgId,
    provider: PROVIDER,
    apiToken,
    status: "connected",
    providerUserId: validation.providerUserId,
    providerUserEmail: validation.providerUserEmail,
  });
  return { ok: true, summary };
}

export async function revalidateProlificCredential(
  orgId: string,
): Promise<ProlificConnectionStatus> {
  const token = await getPanelCredentialToken(orgId, PROVIDER);
  if (!token) return { ok: false, reason: "missing_token" };

  const validation = await prolificProvider.validateCredentials(token);
  if (!validation.ok) {
    const summary = await updatePanelCredentialValidation({
      orgId,
      provider: PROVIDER,
      status: validation.reason === "invalid" ? "invalid" : "unknown",
      validationError: validation.reason,
    });
    if (!summary) return { ok: false, reason: validation.reason };
    return { ok: false, reason: validation.reason };
  }

  const summary = await updatePanelCredentialValidation({
    orgId,
    provider: PROVIDER,
    status: "connected",
    providerUserId: validation.providerUserId,
    providerUserEmail: validation.providerUserEmail,
  });
  if (!summary) return { ok: false, reason: "missing_token" };
  return { ok: true, summary };
}

export async function disconnectProlificCredential(orgId: string): Promise<void> {
  await deletePanelCredential(orgId, PROVIDER);
}

export interface CreateProlificDraftInput {
  name: string;
  description: string;
  totalAvailablePlaces: number;
  estimatedCompletionTime: number;
  rewardCents: number;
  screenoutRewardCents: number;
  screenoutSlots: number;
}

export interface CreateProlificDraftResult {
  draft: PanelStudyDraft;
  panelCompletionWritten: boolean;
}

export type ProlificDraftErrorCode =
  | "missing_credentials"
  | "plan_not_found"
  | "open_link_missing"
  | "open_link_disabled"
  | "completion_write_failed";

export class ProlificDraftError extends Error {
  constructor(public code: ProlificDraftErrorCode) {
    super(code);
    this.name = "ProlificDraftError";
  }
}

/**
 * Create an unpublished Prolific draft and wire its completion paths back into
 * research_open_links.panel_completion. This does not call the Prolific
 * transition endpoint and never publishes or funds a study.
 */
export async function createProlificDraftForPlan(
  orgId: string,
  planId: string,
  input: CreateProlificDraftInput,
): Promise<CreateProlificDraftResult> {
  const [token, plan, openLink] = await Promise.all([
    getPanelCredentialToken(orgId, PROVIDER),
    getResearchPlan(orgId, planId),
    getOpenLinkForPlan(orgId, planId),
  ]);

  if (!token) throw new ProlificDraftError("missing_credentials");
  if (!plan) throw new ProlificDraftError("plan_not_found");
  if (!openLink) throw new ProlificDraftError("open_link_missing");
  if (openLink.status !== "active") {
    throw new ProlificDraftError("open_link_disabled");
  }

  const externalStudyUrl = buildProlificExternalStudyUrl(
    researchOpenLinkUrl(openLink.access_token),
  );
  const draft = await prolificProvider.createStudyDraft(token, {
    ...input,
    externalStudyUrl,
  });

  const updated = await updateOpenLinkPanelCompletion(
    orgId,
    openLink.id,
    draft.completion,
  );
  if (!updated) throw new ProlificDraftError("completion_write_failed");

  return { draft, panelCompletionWritten: true };
}
