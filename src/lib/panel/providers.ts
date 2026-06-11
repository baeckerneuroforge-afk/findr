import type { PanelCompletion } from "@/lib/research/panel";
import type {
  PanelStudyCost,
  PanelStudySnapshot,
  PanelTestStudy,
} from "./study-snapshot";

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
  /** Open-Link-URL um die provider-spezifischen Tracking-Platzhalter
   *  erweitern (E8: vorher Prolific-Spezialfall im Service). */
  buildExternalStudyUrl(openLinkUrl: string): string;
  createStudyDraft(
    apiToken: string,
    input: CreatePanelStudyDraftInput,
  ): Promise<PanelStudyDraft>;
  // ── Optionale Capabilities (E5+) ──────────────────────────────────────
  // Bewusst optional: künftige Provider müssen nur den Draft-Kern können;
  // der Service prüft die Capability vor Gebrauch (Architektur-Seam aus dem
  // Panel-Plan — E6 estimateCost? / E7 publishStudy? folgen hier).
  /** Aktuellen Studien-Stand abrufen (E5: Status). */
  getStudy?(
    apiToken: string,
    providerStudyId: string,
  ): Promise<PanelStudySnapshot>;
  /** Submission-Zähler je Provider-Status-Bucket (E5). */
  listSubmissionCounts?(
    apiToken: string,
    providerStudyId: string,
  ): Promise<Record<string, number>>;
  /** Kostenvorschau VOR Anlage (E6) — Gesamtkosten in Cents inkl. Fees/VAT
   *  laut Provider-Account-Einstellungen, in der Account-Währung. */
  estimateCost?(
    apiToken: string,
    input: { rewardCents: number; totalAvailablePlaces: number },
  ): Promise<number>;
  /** Kosten einer EXISTIERENDEN Studie (E6; projected = Hochrechnung für
   *  noch nicht abgeschlossene/angelaufene Studien). */
  getStudyCost?(
    apiToken: string,
    providerStudyId: string,
    options: { projected: boolean },
  ): Promise<PanelStudyCost>;
  /** Studie live schalten (E7) — GELD-NAH: macht den Draft für Teilnehmer
   *  sichtbar und finanziert ihn aus dem Provider-Guthaben des Accounts.
   *  Wird NIE automatisch aufgerufen, nur auf explizite Nutzer-Bestätigung. */
  publishStudy?(
    apiToken: string,
    providerStudyId: string,
  ): Promise<PanelStudySnapshot>;
  /** Test-Studie aus dem Draft klonen + an die Test-Teilnehmer des
   *  Workspace publizieren — verbraucht laut Provider-Doku KEINE Credits. */
  createTestStudy?(
    apiToken: string,
    providerStudyId: string,
  ): Promise<PanelTestStudy>;
}
