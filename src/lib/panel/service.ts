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
import { getPanelProvider } from "./registry";
import type { PanelProviderKey, PanelStudyDraft } from "./providers";
import type { PanelTestStudy } from "./study-snapshot";
import {
  getLatestPanelStudyForPlan,
  recordPanelStudyDraft,
  updatePanelStudySync,
  type PanelStudySummary,
} from "./studies";

/**
 * Panel-Service — seit E8 intern auf (orgId, provider, …) generalisiert:
 * der Provider wird über die Registry (registry.ts) aufgelöst, alle
 * Kern-Funktionen sind anbieter-neutral. Die exportierten Prolific-Wrapper
 * darunter behalten ihre Signaturen BYTE-IDENTISCH — Routen und Seiten
 * bleiben unberührt; ein zweiter Anbieter braucht nur Registry-Eintrag +
 * eigene Wrapper (Selector-UI laut Plan erst, wenn er real ist).
 */

const PROVIDER = "prolific" as const;

export type ProlificConnectionStatus =
  | { ok: true; summary: PanelCredentialSummary }
  | { ok: false; reason: "invalid" | "unavailable" | "missing_token" };

// ── Credentials (generisch) ──────────────────────────────────────────────────

async function saveCredentialForProvider(
  orgId: string,
  provider: PanelProviderKey,
  apiToken: string,
): Promise<ProlificConnectionStatus> {
  const validation = await getPanelProvider(provider).validateCredentials(
    apiToken,
  );
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  const summary = await upsertPanelCredential({
    orgId,
    provider,
    apiToken,
    status: "connected",
    providerUserId: validation.providerUserId,
    providerUserEmail: validation.providerUserEmail,
  });
  return { ok: true, summary };
}

async function revalidateCredentialForProvider(
  orgId: string,
  provider: PanelProviderKey,
): Promise<ProlificConnectionStatus> {
  const token = await getPanelCredentialToken(orgId, provider);
  if (!token) return { ok: false, reason: "missing_token" };

  const validation = await getPanelProvider(provider).validateCredentials(token);
  if (!validation.ok) {
    const summary = await updatePanelCredentialValidation({
      orgId,
      provider,
      status: validation.reason === "invalid" ? "invalid" : "unknown",
      validationError: validation.reason,
    });
    if (!summary) return { ok: false, reason: validation.reason };
    return { ok: false, reason: validation.reason };
  }

  const summary = await updatePanelCredentialValidation({
    orgId,
    provider,
    status: "connected",
    providerUserId: validation.providerUserId,
    providerUserEmail: validation.providerUserEmail,
  });
  if (!summary) return { ok: false, reason: "missing_token" };
  return { ok: true, summary };
}

export async function getProlificCredentialSummary(orgId: string) {
  return getPanelCredentialSummary(orgId, PROVIDER);
}

export async function saveProlificCredential(
  orgId: string,
  apiToken: string,
): Promise<ProlificConnectionStatus> {
  return saveCredentialForProvider(orgId, PROVIDER, apiToken);
}

export async function revalidateProlificCredential(
  orgId: string,
): Promise<ProlificConnectionStatus> {
  return revalidateCredentialForProvider(orgId, PROVIDER);
}

export async function disconnectProlificCredential(orgId: string): Promise<void> {
  await deletePanelCredential(orgId, PROVIDER);
}

/** Jüngster persistierter Prolific-Draft eines Plans (E4) — null, wenn nie
 *  einer angelegt wurde (oder die panel_studies-Migration noch fehlt). */
export async function getProlificStudyForPlan(
  orgId: string,
  planId: string,
): Promise<PanelStudySummary | null> {
  return getLatestPanelStudyForPlan(orgId, planId, PROVIDER);
}

// ── Draft-Anlage ─────────────────────────────────────────────────────────────

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
   *  fehlschlug (fail-open; der Provider-Draft existiert trotzdem). */
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

async function createPanelDraftForPlan(
  orgId: string,
  provider: PanelProviderKey,
  planId: string,
  input: CreateProlificDraftInput,
): Promise<CreateProlificDraftResult> {
  const [token, plan, openLink] = await Promise.all([
    getPanelCredentialToken(orgId, provider),
    getResearchPlan(orgId, planId),
    getOpenLinkForPlan(orgId, planId),
  ]);

  if (!token) throw new ProlificDraftError("missing_credentials");
  if (!plan) throw new ProlificDraftError("plan_not_found");
  if (!openLink) throw new ProlificDraftError("open_link_missing");
  if (openLink.status !== "active") {
    throw new ProlificDraftError("open_link_disabled");
  }

  const providerImpl = getPanelProvider(provider);
  const externalStudyUrl = providerImpl.buildExternalStudyUrl(
    researchOpenLinkUrl(openLink.access_token),
  );
  const draft = await providerImpl.createStudyDraft(token, {
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
  // Provider-Draft EXISTIERT an diesem Punkt bereits; eine fehlgeschlagene
  // Persistenz darf den Erfolg nicht in einen Fehler verwandeln, sonst legt
  // der nächste Klick genau den Doppel-Draft an, den E4 verhindert.
  const study = await recordPanelStudyDraft({
    orgId,
    planId,
    provider,
    providerStudyId: draft.providerStudyId,
    status: draft.status,
    draftInput: { ...input, externalStudyUrl },
  });

  return { draft, panelCompletionWritten: true, study };
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
  return createPanelDraftForPlan(orgId, PROVIDER, planId, input);
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

async function syncPanelStudyForPlan(
  orgId: string,
  provider: PanelProviderKey,
  planId: string,
): Promise<PanelStudySummary> {
  const [token, study] = await Promise.all([
    getPanelCredentialToken(orgId, provider),
    getLatestPanelStudyForPlan(orgId, planId, provider),
  ]);
  if (!token) throw new ProlificSyncError("missing_credentials");
  if (!study) throw new ProlificSyncError("study_not_found");

  // Capability-Guard (Interface-Methoden sind optional): ein Provider ohne
  // Sync-Fähigkeit landet hier kontrolliert statt in einem TypeError.
  const { getStudy, listSubmissionCounts, getStudyCost } =
    getPanelProvider(provider);
  if (!getStudy || !listSubmissionCounts) {
    throw new ProlificSyncError("sync_failed");
  }

  // E6: projizierte Kosten laufen im Sync mit — aber FAIL-SOFT (null bei
  // Fehler): Status+Zähler sind der Kern des Syncs und sollen nicht an
  // einem optionalen Kosten-Read scheitern; total_cost_cents behält dann
  // einfach seinen letzten Stand.
  const [snapshot, counts, cost] = await Promise.all([
    getStudy(token, study.providerStudyId),
    listSubmissionCounts(token, study.providerStudyId),
    getStudyCost
      ? getStudyCost(token, study.providerStudyId, { projected: true }).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);

  const updated = await updatePanelStudySync({
    orgId,
    provider,
    providerStudyId: study.providerStudyId,
    status: snapshot.status,
    submissionCounts: counts,
    ...(cost ? { totalCostCents: cost.totalCents } : {}),
  });
  if (!updated) throw new ProlificSyncError("sync_failed");
  return updated;
}

/**
 * Jüngsten persistierten Prolific-Draft eines Plans gegen die Prolific-API
 * abgleichen: Status + Submission-Zähler (+ projizierte Kosten, fail-soft),
 * Ergebnis auf panel_studies schreiben. Bewusst MANUELL angestoßen
 * (Aktualisieren-Button) — kein Cron, kein Webhook (Plan-Entscheidung E5).
 */
export async function syncProlificStudyForPlan(
  orgId: string,
  planId: string,
): Promise<PanelStudySummary> {
  return syncPanelStudyForPlan(orgId, PROVIDER, planId);
}

// ── E6: Kostenvorschau ───────────────────────────────────────────────────────

export type ProlificEstimateErrorCode = "missing_credentials" | "estimate_failed";

export class ProlificEstimateError extends Error {
  constructor(public code: ProlificEstimateErrorCode) {
    super(code);
    this.name = "ProlificEstimateError";
  }
}

async function estimatePanelStudyCost(
  orgId: string,
  provider: PanelProviderKey,
  input: { rewardCents: number; totalAvailablePlaces: number },
): Promise<number> {
  const token = await getPanelCredentialToken(orgId, provider);
  if (!token) throw new ProlificEstimateError("missing_credentials");

  const { estimateCost } = getPanelProvider(provider);
  if (!estimateCost) throw new ProlificEstimateError("estimate_failed");

  return estimateCost(token, input);
}

/**
 * Kostenvorschau VOR der Draft-Anlage: Gesamtkosten in Cents inkl. Fees+VAT
 * laut Provider-Account-Einstellungen, in der Account-Währung (die Antwort
 * trägt keinen Währungscode — die UI sagt das ehrlich dazu). Der Kalkulator
 * kennt nur reward × places; das Screen-out-Budget ist NICHT enthalten.
 */
export async function estimateProlificStudyCost(
  orgId: string,
  input: { rewardCents: number; totalAvailablePlaces: number },
): Promise<number> {
  return estimatePanelStudyCost(orgId, PROVIDER, input);
}

// ── E7: Publish + Test-Studie ────────────────────────────────────────────────

export type ProlificPublishErrorCode =
  | "missing_credentials"
  | "study_not_found"
  | "open_link_missing"
  | "open_link_disabled"
  | "completion_not_wired"
  | "not_unpublished"
  | "publish_failed";

export class ProlificPublishError extends Error {
  constructor(
    public code: ProlificPublishErrorCode,
    /** Bei not_unpublished: der tatsächliche Live-Status der Studie. */
    public providerStatus?: string,
  ) {
    super(code);
    this.name = "ProlificPublishError";
  }
}

export interface PublishProlificStudyResult {
  /** Status aus der Publish-Antwort (i. d. R. ACTIVE oder PUBLISHING). */
  status: string;
  /** Persistierter Stand nach Best-effort-Sync — null, wenn der Sync nach
   *  erfolgreichem Publish scheiterte (Publish gilt trotzdem). */
  study: PanelStudySummary | null;
}

/**
 * Gemeinsame Preconditions für Publish UND Test-Studie (beide machen den
 * Draft für Teilnehmer erlebbar): Credential verbunden, persistierter
 * Draft, Open-Link aktiv, BEIDE Completion-URLs verdrahtet — und der
 * LIVE-Status beim Provider ist UNPUBLISHED (frisch geprüft, nicht der
 * lokale Stand: schützt vor Doppel-Publish aus staler UI / zweitem Tab).
 */
async function requirePublishablePanelStudy(
  orgId: string,
  provider: PanelProviderKey,
  planId: string,
): Promise<{ token: string; study: PanelStudySummary }> {
  const [token, study, openLink] = await Promise.all([
    getPanelCredentialToken(orgId, provider),
    getLatestPanelStudyForPlan(orgId, planId, provider),
    getOpenLinkForPlan(orgId, planId),
  ]);

  if (!token) throw new ProlificPublishError("missing_credentials");
  if (!study) throw new ProlificPublishError("study_not_found");
  if (!openLink) throw new ProlificPublishError("open_link_missing");
  if (openLink.status !== "active") {
    throw new ProlificPublishError("open_link_disabled");
  }
  const completion = openLink.panel_completion;
  if (!completion?.complete_url || !completion?.screenout_url) {
    throw new ProlificPublishError("completion_not_wired");
  }

  const { getStudy } = getPanelProvider(provider);
  if (!getStudy) throw new ProlificPublishError("publish_failed");

  const live = await getStudy(token, study.providerStudyId);
  if (live.status !== "UNPUBLISHED") {
    throw new ProlificPublishError("not_unpublished", live.status);
  }

  return { token, study };
}

async function publishPanelStudyForPlan(
  orgId: string,
  provider: PanelProviderKey,
  planId: string,
): Promise<PublishProlificStudyResult> {
  const { token, study } = await requirePublishablePanelStudy(
    orgId,
    provider,
    planId,
  );

  const { publishStudy } = getPanelProvider(provider);
  if (!publishStudy) throw new ProlificPublishError("publish_failed");

  const published = await publishStudy(token, study.providerStudyId);

  // Best-effort: frischen Stand (Status/Zähler/Kosten) persistieren. Ein
  // Fehler hier darf den erfolgten Publish nicht als Fehler maskieren —
  // Fallback ist ein minimales Status-Update, notfalls null.
  let summary: PanelStudySummary | null = null;
  try {
    summary = await syncPanelStudyForPlan(orgId, provider, planId);
  } catch {
    summary = await updatePanelStudySync({
      orgId,
      provider,
      providerStudyId: study.providerStudyId,
      status: published.status,
      submissionCounts: study.submissionCounts ?? {},
    });
  }

  return { status: published.status, study: summary };
}

/**
 * Persistierten Prolific-Draft eines Plans live schalten — die einzige
 * GELD-NAHE Aktion der Panel-Integration: Prolific finanziert die Studie
 * beim Publish aus dem Workspace-Guthaben des verbundenen Accounts. findr
 * ruft das NIE automatisch auf; die Route hängt an einem expliziten
 * Confirm-Schritt in der UI. Ohne Guthaben schlägt die Transition beim
 * Provider fehl; die Begründung läuft als providerMessage zur UI durch.
 */
export async function publishProlificStudyForPlan(
  orgId: string,
  planId: string,
): Promise<PublishProlificStudyResult> {
  return publishPanelStudyForPlan(orgId, PROVIDER, planId);
}

async function createPanelTestStudyForPlan(
  orgId: string,
  provider: PanelProviderKey,
  planId: string,
): Promise<PanelTestStudy> {
  const { token, study } = await requirePublishablePanelStudy(
    orgId,
    provider,
    planId,
  );

  const { createTestStudy } = getPanelProvider(provider);
  if (!createTestStudy) throw new ProlificPublishError("publish_failed");

  return createTestStudy(token, study.providerStudyId);
}

/**
 * Test-Studie aus dem Draft klonen + an die Test-Teilnehmer des Workspace
 * publizieren — verbraucht laut Provider-Doku KEINE Credits. Die geklonte
 * Test-Studie wird BEWUSST NICHT in panel_studies persistiert: sie ist
 * nicht der Rekrutierungs-Draft, und die Karte soll weiter den echten
 * Draft zeigen. Preconditions identisch zum Publish (gleicher Helper);
 * Workspace-Anforderungen des Providers (≥1 Test-Teilnehmer, Feature
 * freigeschaltet) meldet der Provider selbst als Fehler-Envelope.
 */
export async function createProlificTestStudyForPlan(
  orgId: string,
  planId: string,
): Promise<PanelTestStudy> {
  return createPanelTestStudyForPlan(orgId, PROVIDER, planId);
}
