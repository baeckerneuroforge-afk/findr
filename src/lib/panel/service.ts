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
import {
  getLatestPanelStudyForPlan,
  recordPanelStudyDraft,
  updatePanelStudySync,
  type PanelStudySummary,
} from "./studies";

const PROVIDER = "prolific" as const;

export type ProlificConnectionStatus =
  | { ok: true; summary: PanelCredentialSummary }
  | { ok: false; reason: "invalid" | "unavailable" | "missing_token" };

export async function getProlificCredentialSummary(orgId: string) {
  return getPanelCredentialSummary(orgId, PROVIDER);
}

/** Jüngster persistierter Prolific-Draft eines Plans (E4) — null, wenn nie
 *  einer angelegt wurde (oder die panel_studies-Migration noch fehlt). */
export async function getProlificStudyForPlan(
  orgId: string,
  planId: string,
): Promise<PanelStudySummary | null> {
  return getLatestPanelStudyForPlan(orgId, planId, PROVIDER);
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
  /** Persistierte panel_studies-Zeile (E4) — null, wenn die Persistenz
   *  fehlschlug (fail-open; der Prolific-Draft existiert trotzdem). */
  study: PanelStudySummary | null;
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

  // E4: Draft persistieren — provider_study_id war bis hier nur transienter
  // Client-State (Keystone-Lücke, Doppel-Draft-Risiko). Fail-open: der
  // Prolific-Draft EXISTIERT an diesem Punkt bereits; eine fehlgeschlagene
  // Persistenz (z. B. Migration noch nicht angewandt) darf den Erfolg nicht
  // in einen Fehler verwandeln, sonst legt der nächste Klick genau den
  // Doppel-Draft an, den E4 verhindert.
  const study = await recordPanelStudyDraft({
    orgId,
    planId,
    provider: PROVIDER,
    providerStudyId: draft.providerStudyId,
    status: draft.status,
    draftInput: { ...input, externalStudyUrl },
  });

  return { draft, panelCompletionWritten: true, study };
}

// ── E5: Status- + Submissions-Sync ───────────────────────────────────────────

export type ProlificSyncErrorCode =
  | "missing_credentials"
  | "study_not_found"
  | "sync_failed";

export class ProlificSyncError extends Error {
  constructor(public code: ProlificSyncErrorCode) {
    super(code);
    this.name = "ProlificSyncError";
  }
}

/**
 * Jüngsten persistierten Prolific-Draft eines Plans gegen die Prolific-API
 * abgleichen: Status (GET /studies/{id}/) + Submission-Zähler
 * (GET /studies/{id}/submissions/counts/), Ergebnis auf panel_studies
 * schreiben. Bewusst MANUELL angestoßen (Aktualisieren-Button) — kein Cron,
 * kein Webhook (Plan-Entscheidung E5). ProlificApiError aus dem Provider
 * (401/404/5xx) läuft unverändert zum Aufrufer durch; die Route mappt ihn
 * wie beim Draft-Anlegen.
 */
export async function syncProlificStudyForPlan(
  orgId: string,
  planId: string,
): Promise<PanelStudySummary> {
  const [token, study] = await Promise.all([
    getPanelCredentialToken(orgId, PROVIDER),
    getLatestPanelStudyForPlan(orgId, planId, PROVIDER),
  ]);
  if (!token) throw new ProlificSyncError("missing_credentials");
  if (!study) throw new ProlificSyncError("study_not_found");

  // Capability-Guard (Interface-Methoden sind optional, E8-Seam): der
  // Prolific-Provider implementiert beide; ein Provider ohne Sync-Fähigkeit
  // landet hier kontrolliert statt in einem TypeError.
  const { getStudy, listSubmissionCounts } = prolificProvider;
  if (!getStudy || !listSubmissionCounts) {
    throw new ProlificSyncError("sync_failed");
  }

  const [snapshot, counts] = await Promise.all([
    getStudy(token, study.providerStudyId),
    listSubmissionCounts(token, study.providerStudyId),
  ]);

  const updated = await updatePanelStudySync({
    orgId,
    provider: PROVIDER,
    providerStudyId: study.providerStudyId,
    status: snapshot.status,
    submissionCounts: counts,
  });
  if (!updated) throw new ProlificSyncError("sync_failed");
  return updated;
}
