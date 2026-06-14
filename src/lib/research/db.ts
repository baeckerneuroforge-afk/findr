import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";

/**
 * Local DB-type augmentation for the research layer. Same pattern as
 * product-discovery/service.ts: until src/types/database.ts is regenerated
 * post-migration, the Supabase client doesn't know about
 *
 *   - the new research_plans / research_invites tables
 *   - the new interview_sessions columns (flow, mode, plan_id, invite_id,
 *     recording_url, transcript_source, capture_source, visual_capture)
 *
 * Two reliable patterns to avoid: `Database & {...}` intersections (the
 * client's deep generics infer Insert as `never[]`), and `interface` types
 * (same issue). The generated Database uses inline object literals for
 * every table; mirror that flavor here for the augmented client.
 *
 * Once `supabase gen types` runs against the live schema, this whole file
 * collapses to: `export const createResearchSupabase = createAdminSupabaseClient`.
 */

// ── interview_sessions — extended with the new columns ─────────────────────

type Kind = "post_loss" | "checkin" | "research";
type Flow = "post_loss" | "checkin" | "research" | null;
type Mode = "text" | "voice" | "video";
type Status = "open" | "completed" | "abandoned";
type Language = "de" | "en";

type InterviewSessionsRow = {
  access_token: string;
  // Phase 4 screening — answers of the QUALIFIED participant, written at session
  // creation. Null for non-screened / post_loss / checkin sessions.
  screening_answers: Json | null;
  // Phase 4 Baustein 2 — Walk-in-Session-Attribution für den offenen Studien-
  // Link (20260629000000). NULL für jede per-Invite-/post_loss-/checkin-Session;
  // verdrahtet erst in E4 (in E1 ist die Spalte da, wird aber nie geschrieben).
  open_link_id: string | null;
  // Phase 4 Baustein 3 (Panel-Anbieter) — Inbound-Attribution der externen
  // Panel-Teilnehmer-ID (20260702000000). NULL für JEDE Nicht-Panel-Session;
  // gesetzt NUR auf dem Open-Link-Pfad, wenn ?PROLIFIC_PID= mitläuft. Form:
  // PanelContext (src/lib/research/panel.ts). Vor angewandter Migration liefert
  // select("*") die Spalte nicht → der Lese-Mapper defaultet undefined→null.
  panel_context: Json | null;
  // E0 Recht & Offenlegung (20260704000001) — DSGVO-Art.-7(1)-Nachweis der
  // Teilnehmer-Einwilligung. Server-gestempelt (nie client-geliefert), nur
  // einmal gesetzt (WHERE … IS NULL). consent_version referenziert den git-
  // historisierten i18n-Textstand. Vor angewandter Migration liefert
  // select("*") beide Spalten nicht → Lese-Mapper defaultet undefined→null.
  consent_accepted_at: string | null;
  consent_version: string | null;
  // E1 Turn-Signale (20260704000002) — Ergebnis des Signal-Sidecars
  // (TurnSignalsRecord, src/lib/schemas/turn-signals.ts). NULL für jede nie
  // analysierte Session (Toggle aus, kein Consent, Bestand). Vor angewandter
  // Migration liefert select("*") die Spalte nicht → Reads unverändert; der
  // Sidecar-Write schlägt fehl und wird geloggt (best-effort).
  turn_signals: Json | null;
  account_id: string | null;
  completed_at: string | null;
  conversation: Json;
  created_at: string;
  // "Room entered" timestamp (20260716000002) — stamped when the opening turn
  // is first persisted. Basis for the per-study time limit. Pre-migration
  // select("*") omits it → read mapper defaults undefined→null (no clock).
  started_at: string | null;
  deal_context: Json | null;
  deal_id: string | null;
  evidence: string | null;
  extracted_reason: string | null;
  flow: Flow;
  id: string;
  invite_id: string | null;
  invited_at: string | null;
  kind: Kind;
  language: Language;
  matched_risk_prediction: string | null;
  mode: Mode;
  model: string | null;
  org_id: string;
  plan_id: string | null;
  recording_url: string | null;
  result: Json | null;
  status: Status;
  transcript_source: string | null;
  capture_source: string | null;
  visual_capture: Json | null;
};

type InterviewSessionsInsert = {
  access_token: string;
  screening_answers?: Json | null;
  open_link_id?: string | null;
  panel_context?: Json | null;
  consent_accepted_at?: string | null;
  consent_version?: string | null;
  turn_signals?: Json | null;
  account_id?: string | null;
  completed_at?: string | null;
  conversation?: Json;
  created_at?: string;
  started_at?: string | null;
  deal_context?: Json | null;
  deal_id?: string | null;
  evidence?: string | null;
  extracted_reason?: string | null;
  flow?: Flow;
  id?: string;
  invite_id?: string | null;
  invited_at?: string | null;
  kind?: Kind;
  language?: Language;
  matched_risk_prediction?: string | null;
  mode?: Mode;
  model?: string | null;
  org_id: string;
  plan_id?: string | null;
  recording_url?: string | null;
  result?: Json | null;
  status?: Status;
  transcript_source?: string | null;
  capture_source?: string | null;
  visual_capture?: Json | null;
};

type InterviewSessionsUpdate = {
  access_token?: string;
  screening_answers?: Json | null;
  open_link_id?: string | null;
  panel_context?: Json | null;
  consent_accepted_at?: string | null;
  consent_version?: string | null;
  turn_signals?: Json | null;
  account_id?: string | null;
  completed_at?: string | null;
  conversation?: Json;
  created_at?: string;
  started_at?: string | null;
  deal_context?: Json | null;
  deal_id?: string | null;
  evidence?: string | null;
  extracted_reason?: string | null;
  flow?: Flow;
  id?: string;
  invite_id?: string | null;
  invited_at?: string | null;
  kind?: Kind;
  language?: Language;
  matched_risk_prediction?: string | null;
  mode?: Mode;
  model?: string | null;
  org_id?: string;
  plan_id?: string | null;
  recording_url?: string | null;
  result?: Json | null;
  status?: Status;
  transcript_source?: string | null;
  capture_source?: string | null;
  visual_capture?: Json | null;
};

// ── research_plans ─────────────────────────────────────────────────────────

type ResearchPlanStatus = "draft" | "active" | "completed" | "archived";

// Studientyp-Diskriminator (Phase M0, 20260630000000). Trennt Market Research
// von Product Discovery auf der GETEILTEN Engine — kein eigenes Schema (siehe
// docs/findr-market-research-separation-plan.md §5). Literal-Union wie
// ResearchPlanStatus; der DB-CHECK garantiert genau diese zwei Werte, der
// DEFAULT 'product_discovery' hält alle Bestandszeilen byte-identisch. In M0
// liest KEIN Verhaltenspfad diese Spalte scharf.
export type ResearchPlanStudyType = "product_discovery" | "market_research";

export type ResearchPlanUseCase =
  | "general_survey"
  | "brand_research"
  | "creative_test"
  | "concept_test";

// B2C/B2B audience type per study (20260715000000). Drives the interview
// Anrede (b2c → "du", b2b → "Sie") and the guide-generator example framing.
// NOT NULL DEFAULT 'b2b' in the DB; the read mapper (coerceAudience) defaults
// undefined→'b2b' so every legacy row + pre-migration read stays formal "Sie".
export type ResearchPlanAudience = "b2b" | "b2c";

export type ResearchPlanRow = {
  id: string;
  org_id: string | null;
  title: string;
  objective: string;
  topic_script: Json;
  // Screening-Fragen (Phase 4, 20260628000000). Weiches jsonb wie topic_script;
  // Form lebt im TS-Layer (src/lib/schemas/screening.ts), DB default '[]'.
  screening_questions: Json;
  persona: string | null;
  sample_target: number | null;
  status: ResearchPlanStatus;
  // Visual-Intelligence-Schalter pro Studie. DB: NOT NULL DEFAULT false.
  // Vor angewandter Migration liefert select("*") die Spalte nicht; der
  // Lese-Mapper defaultet undefined→false.
  visual_capture_enabled: boolean;
  // Voice-Schalter pro Studie. DB: NOT NULL DEFAULT false.
  // Vor angewandter Migration liefert select("*") die Spalte nicht; der
  // Lese-Mapper defaultet undefined→false.
  voice_enabled: boolean;
  // TTS-Schalter pro Studie. DB: NOT NULL DEFAULT false.
  // Vor angewandter Migration liefert select("*") die Spalte nicht; der
  // Lese-Mapper defaultet undefined→false.
  tts_enabled: boolean;
  // E1 Turn-Signale (20260704000002): per-Studie-Opt-in für die nachgelagerte
  // Affekt-/Direktheits-Analyse. DB: NOT NULL DEFAULT false; kein Backfill.
  // Vor angewandter Migration liefert select("*") die Spalte nicht; der
  // Lese-Mapper defaultet undefined→false → der Sidecar läuft nie.
  signals_enabled: boolean;
  // Market-Research-Use-Case. Nullable, no DB default/backfill. Before the
  // migration lands select("*") omits it; plans-service coerceUseCase maps that
  // to null so existing behavior stays unchanged.
  use_case: ResearchPlanUseCase | null;
  // B2C/B2B audience type (20260715000000). NOT NULL DEFAULT 'b2b'. Before the
  // migration lands select("*") omits it; the read mapper (coerceAudience)
  // defaults undefined→'b2b', so existing studies stay formal "Sie".
  audience_type: ResearchPlanAudience;
  // Optional single stimulus per study. All columns stay nullable and
  // stimulus_type intentionally remains free text so later asset types do not
  // require a DB enum migration.
  stimulus_url: string | null;
  stimulus_type: string | null;
  stimulus_description: string | null;
  // Stimulus-Analyse (Vision, 20260703000007). Beide nullable, kein DEFAULT/
  // CHECK. jsonb = versioniertes Envelope (stimulus-analysis.ts), status =
  // 'pending' | 'done' | 'failed' als freier Text. Vor angewandter Migration
  // liefert select("*") die Spalten nicht; die Lese-Mapper (plans-service →
  // coerceStimulusAnalysis*) defaulten undefined→null — byte-identisch.
  stimulus_analysis: Json | null;
  stimulus_analysis_status: string | null;
  // Studientyp (Phase M0, 20260630000000). NOT NULL DEFAULT 'product_discovery'
  // in der DB — nicht-nullbar getypt wie status. Vor angewandter Migration
  // liefert select("*") die Spalte nicht; der Lese-Mapper (plans-service
  // coerceStudyType) defaultet undefined→'product_discovery', sodass der Code
  // auch pre-migration byte-identisch bleibt.
  study_type: ResearchPlanStudyType;
  // F2 — per-study interview language (de/en). NOT NULL DEFAULT 'de'. Before the
  // migration lands select("*") omits it; the read mapper (coerceLanguage)
  // defaults undefined→'de', so existing studies stay German byte-identically.
  language: Language;
  // Per-study interview length — configurable agent-question UPPER BOUND
  // (20260716000000). NULL = system default (6 for non-stimulus research;
  // stimulus-SET studies keep stimulusSetCeiling regardless). Before the
  // migration lands select("*") omits it; the read mapper (coerceNullableInt)
  // defaults undefined→null → default-length behavior, byte-identical.
  max_rounds: number | null;
  // Per-study interview time limit in seconds (20260716000001). NULL = no
  // limit. Voice = hard (agent timer), Text = soft (countdown + close on next
  // send). Pre-migration select("*") omits it; read mapper (coerceNullableInt)
  // defaults undefined→null → no time limit, byte-identical.
  max_duration_seconds: number | null;
  created_at: string;
};

type ResearchPlanInsert = {
  id?: string;
  org_id?: string | null;
  title: string;
  objective: string;
  topic_script?: Json;
  screening_questions?: Json;
  persona?: string | null;
  sample_target?: number | null;
  status?: ResearchPlanStatus;
  visual_capture_enabled?: boolean;
  voice_enabled?: boolean;
  tts_enabled?: boolean;
  signals_enabled?: boolean;
  use_case?: ResearchPlanUseCase | null;
  // Optional beim Insert — nur der Market-Research-Pfad stempelt 'b2c' explizit;
  // sonst weggelassen → DB-DEFAULT 'b2b' (formal "Sie"), Discovery byte-identisch.
  audience_type?: ResearchPlanAudience;
  stimulus_url?: string | null;
  stimulus_type?: string | null;
  stimulus_description?: string | null;
  stimulus_analysis?: Json | null;
  stimulus_analysis_status?: string | null;
  // Optional beim Insert — wird heute NIE gesetzt (kein Write-Pfad in M0); der
  // DB-DEFAULT vergibt 'product_discovery'. Verdrahtung kommt in M1/M3.
  study_type?: ResearchPlanStudyType;
  language?: Language;
  // Optional beim Insert — nur gesetzt, wenn der Forscher eine Länge wählt;
  // sonst weggelassen → NULL → System-Default (byte-identisch).
  max_rounds?: number | null;
  max_duration_seconds?: number | null;
  created_at?: string;
};

type ResearchPlanUpdate = {
  id?: string;
  org_id?: string | null;
  title?: string;
  objective?: string;
  topic_script?: Json;
  screening_questions?: Json;
  persona?: string | null;
  sample_target?: number | null;
  status?: ResearchPlanStatus;
  visual_capture_enabled?: boolean;
  voice_enabled?: boolean;
  tts_enabled?: boolean;
  signals_enabled?: boolean;
  use_case?: ResearchPlanUseCase | null;
  audience_type?: ResearchPlanAudience;
  stimulus_url?: string | null;
  stimulus_type?: string | null;
  stimulus_description?: string | null;
  stimulus_analysis?: Json | null;
  stimulus_analysis_status?: string | null;
  study_type?: ResearchPlanStudyType;
  language?: Language;
  max_rounds?: number | null;
  max_duration_seconds?: number | null;
  created_at?: string;
};

// ── research_invites ───────────────────────────────────────────────────────

type ResearchInviteStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

type ResearchInviteModePreference = "text" | "voice" | "video";

// Note on the four "scheduling" columns below:
//   access_token / invited_at        — added by 20260615000000
//   reminder_24h_sent_at / reminder_1h_sent_at — added by 20260614000000
// Both migrations are additive `if not exists`; existing rows get NULL.
// The augmented type-side has to know about them so the scheduling +
// reminder-cron code can read/write them through this single shared client.
export type ResearchInviteRow = {
  id: string;
  plan_id: string;
  org_id: string | null;
  contact_label: string;
  contact_email: string | null;
  mode_preference: ResearchInviteModePreference;
  status: ResearchInviteStatus;
  scheduled_at: string | null;
  access_token: string | null;
  invited_at: string | null;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  language: Language;
  created_at: string;
};

type ResearchInviteInsert = {
  id?: string;
  plan_id: string;
  org_id?: string | null;
  contact_label: string;
  contact_email?: string | null;
  mode_preference?: ResearchInviteModePreference;
  status?: ResearchInviteStatus;
  scheduled_at?: string | null;
  access_token?: string | null;
  invited_at?: string | null;
  reminder_24h_sent_at?: string | null;
  reminder_1h_sent_at?: string | null;
  language?: Language;
  created_at?: string;
};

type ResearchInviteUpdate = {
  id?: string;
  plan_id?: string;
  org_id?: string | null;
  contact_label?: string;
  contact_email?: string | null;
  mode_preference?: ResearchInviteModePreference;
  status?: ResearchInviteStatus;
  scheduled_at?: string | null;
  access_token?: string | null;
  invited_at?: string | null;
  reminder_24h_sent_at?: string | null;
  reminder_1h_sent_at?: string | null;
  language?: Language;
  created_at?: string;
};

// ── study_synthesis ────────────────────────────────────────────────────────
//
// Per 20260617000000_study_synthesis.sql. UNIQUE(org_id, plan_id) — re-run
// is upsert, not history. The two JSONB columns hold the shapes recommended
// (not enforced) by the migration's column comments; we mirror that here as
// `Json` because the engine + the UI parse-narrow into their own typed
// shapes (src/lib/synthesis/service.ts → StudySynthesisRecord).
//
// May collide at merge with the synthesis engine branch (Terminal 1) which
// likely adds the same augmentation. Resolution: keep one copy — the rows
// below are derived directly from the migration so both branches should
// agree byte-for-byte.

type StudySynthesisRow = {
  id: string;
  org_id: string;
  plan_id: string;
  emergent_themes: Json;
  tensions: Json;
  overview: string | null;
  based_on_count: number;
  synthesized_at: string | null;
  model: string | null;
  created_at: string;
};

type StudySynthesisInsert = {
  id?: string;
  org_id: string;
  plan_id: string;
  emergent_themes?: Json;
  tensions?: Json;
  overview?: string | null;
  based_on_count?: number;
  synthesized_at?: string | null;
  model?: string | null;
  created_at?: string;
};

type StudySynthesisUpdate = {
  id?: string;
  org_id?: string;
  plan_id?: string;
  emergent_themes?: Json;
  tensions?: Json;
  overview?: string | null;
  based_on_count?: number;
  synthesized_at?: string | null;
  model?: string | null;
  created_at?: string;
};

// ── product_discovery_insights — narrow read-only view ───────────────────
//
// Minimal augmentation for the synthesis UI's "new insights since last
// synthesis"-count query. Only the four columns the count filter touches;
// the canonical full shape lives in src/lib/product-discovery/service.ts via
// its own augmented client (createPDSupabase). Once src/types/database.ts is
// regenerated the two narrow views collapse.

type ProductDiscoveryInsightsRow = {
  id: string;
  org_id: string;
  plan_id: string | null;
  analyzed_at: string;
};

type ProductDiscoveryInsightsInsert = {
  id?: string;
  org_id: string;
  plan_id?: string | null;
  analyzed_at?: string;
};

type ProductDiscoveryInsightsUpdate = {
  id?: string;
  org_id?: string;
  plan_id?: string | null;
  analyzed_at?: string;
};

// ── participant_pool ───────────────────────────────────────────────────────
//
// Per 20260620000000_participant_pool.sql. Org-weiter, wiederverwendbarer
// Teilnehmer-Stamm mit deterministischen Screening-Attributen (role/segment/
// tags). org_id NOT NULL (org-interner Pool); contact_email nullable wie bei
// research_invites. Dedup (email case-insensitive unique pro org) ist ein
// partial-unique-Index in der DB — der Insert/Update kann mit 23505 fehlen.

export type ParticipantPoolRow = {
  id: string;
  org_id: string;
  contact_label: string;
  contact_email: string | null;
  role: string | null;
  segment: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
};

type ParticipantPoolInsert = {
  id?: string;
  org_id: string;
  contact_label: string;
  contact_email?: string | null;
  role?: string | null;
  segment?: string | null;
  tags?: string[];
  notes?: string | null;
  created_at?: string;
};

type ParticipantPoolUpdate = {
  id?: string;
  org_id?: string;
  contact_label?: string;
  contact_email?: string | null;
  role?: string | null;
  segment?: string | null;
  tags?: string[];
  notes?: string | null;
  created_at?: string;
};

// ── participant_pool_invites ─────────────────────────────────────────────────
//
// Link Pool-Person ↔ research_invites-Zeile. UNIQUE(invite_id) +
// UNIQUE(plan_id, pool_member_id) — letzteres ist der Pool-Dedup ("eine Person
// höchstens einmal pro Studie aus dem Pool eingeladen").

export type ParticipantPoolInviteRow = {
  id: string;
  org_id: string;
  pool_member_id: string;
  plan_id: string;
  invite_id: string;
  created_at: string;
};

type ParticipantPoolInviteInsert = {
  id?: string;
  org_id: string;
  pool_member_id: string;
  plan_id: string;
  invite_id: string;
  created_at?: string;
};

type ParticipantPoolInviteUpdate = {
  id?: string;
  org_id?: string;
  pool_member_id?: string;
  plan_id?: string;
  invite_id?: string;
  created_at?: string;
};

// ── research_plan_quotas ─────────────────────────────────────────────────────
//
// Manuelle role-Quoten pro Studie. UNIQUE(plan_id, role) — Upsert statt
// Historie. Fortschritt wird app-seitig aus participant_pool_invites ⋈
// participant_pool.role berechnet (siehe participant-pool.ts).

export type ResearchPlanQuotaRow = {
  id: string;
  org_id: string;
  plan_id: string;
  role: string;
  target: number;
  created_at: string;
};

type ResearchPlanQuotaInsert = {
  id?: string;
  org_id: string;
  plan_id: string;
  role: string;
  target: number;
  created_at?: string;
};

type ResearchPlanQuotaUpdate = {
  id?: string;
  org_id?: string;
  plan_id?: string;
  role?: string;
  target?: number;
  created_at?: string;
};

// ── research_screening_responses ─────────────────────────────────────────────
//
// Per 20260628000000_screening.sql. ANONYME Quote pro Studie: nur plan_id +
// verdict + Zeitpunkt, KEIN invite_id, KEIN Profil, KEINE Antworten. Eine Zeile
// pro abgeschlossenem Screening (qualified beim Session-Anlegen, rejected beim
// Abweisen). org_isolation RLS; der service-role-Client schreibt sie.

export type ResearchScreeningResponseRow = {
  id: string;
  org_id: string;
  plan_id: string;
  verdict: "qualified" | "rejected";
  created_at: string;
};

type ResearchScreeningResponseInsert = {
  id?: string;
  org_id: string;
  plan_id: string;
  verdict: "qualified" | "rejected";
  created_at?: string;
};

type ResearchScreeningResponseUpdate = {
  id?: string;
  org_id?: string;
  plan_id?: string;
  verdict?: "qualified" | "rejected";
  created_at?: string;
};

// ── synthesis_shares ─────────────────────────────────────────────────────────
//
// Per 20260622000000_synthesis_shares.sql. Public read-only share links for a
// study synthesis. token = 256-bit capability credential (base64url), UNIQUE —
// the same access model as interview_sessions.access_token. org_id NOT NULL +
// org_isolation RLS for dashboard management; the PUBLIC read path goes through
// the service-role client by token (RLS bypassed). `language` drives the public
// subtree's locale (no cookie for an account-less stakeholder); `show_quotes`
// is the DSGVO opt-in for verbatim participant quotes (default false).

export type SynthesisShareRow = {
  id: string;
  token: string;
  org_id: string;
  plan_id: string;
  language: Language;
  show_quotes: boolean;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
};

type SynthesisShareInsert = {
  id?: string;
  token: string;
  org_id: string;
  plan_id: string;
  language?: Language;
  show_quotes?: boolean;
  expires_at?: string | null;
  revoked?: boolean;
  created_at?: string;
};

type SynthesisShareUpdate = {
  id?: string;
  token?: string;
  org_id?: string;
  plan_id?: string;
  language?: Language;
  show_quotes?: boolean;
  expires_at?: string | null;
  revoked?: boolean;
  created_at?: string;
};

// ── research_open_links ──────────────────────────────────────────────────────
//
// Per 20260629000000_open_link.sql. Offener, studienweiter Link für anonyme
// Walk-ins (Phase 4, Baustein 2). org_id NOT NULL — die zentrale Sicherheits-
// Aussage: auf dem Walk-in-Pfad existiert NIE eine null-org-Zeile, der bestehende
// !invite.org_id-Guard bleibt byte-identisch. access_token = 256-bit-Capability-
// Credential (sparse-unique, wie research_invites/synthesis_shares); status =
// active/disabled Kill-Switch; max_sessions/valid_until = additive Anti-Abuse-/
// Ablauf-Felder (Enforcement in späteren Etappen). org_isolation RLS; der public
// Eintritts-Pfad nutzt den service-role-Client (RLS bypassed, token-scoped).

export type ResearchOpenLinkRow = {
  id: string;
  org_id: string;
  plan_id: string;
  access_token: string;
  status: "active" | "disabled";
  max_sessions: number | null;
  valid_until: string | null;
  label: string | null;
  // Phase 4 Baustein 3 (Panel-Anbieter) E2 — pro-Link Completion-Return-URLs
  // (20260702000001). NULL = kein Panel-Completion konfiguriert. Form:
  // PanelCompletion (src/lib/research/panel.ts). Vor angewandter Migration
  // liefert select("*") die Spalte nicht → der Lese-Mapper defaultet undef→null.
  panel_completion: Json | null;
  created_at: string;
};

type ResearchOpenLinkInsert = {
  id?: string;
  org_id: string;
  plan_id: string;
  access_token: string;
  status?: "active" | "disabled";
  max_sessions?: number | null;
  valid_until?: string | null;
  label?: string | null;
  panel_completion?: Json | null;
  created_at?: string;
};

type ResearchOpenLinkUpdate = {
  id?: string;
  org_id?: string;
  plan_id?: string;
  access_token?: string;
  status?: "active" | "disabled";
  max_sessions?: number | null;
  valid_until?: string | null;
  label?: string | null;
  panel_completion?: Json | null;
  created_at?: string;
};

// ── research_plan_stimuli ────────────────────────────────────────────────────
//
// Multi-Stimulus E1 (20260714000000) — Stimulus-SET pro Studie (bis 5 Assets
// in fester position-Reihenfolge). Dual-Read mit den Legacy-Single-Spalten auf
// research_plans: Zeilen hier gewinnen, keine Zeilen → Legacy als 1-Element-
// Set (plans-service resolveStimulusSet). stimulus_type/analysis_status bleiben
// freie strings wie auf research_plans (kein DB-Enum).

export type ResearchPlanStimulusRow = {
  id: string;
  plan_id: string;
  org_id: string | null;
  position: number;
  stimulus_type: string;
  url: string;
  storage_path: string | null;
  label: string | null;
  description: string | null;
  analysis: Json | null;
  analysis_status: string | null;
  created_at: string;
};

type ResearchPlanStimulusInsert = {
  id?: string;
  plan_id: string;
  org_id?: string | null;
  position: number;
  stimulus_type: string;
  url: string;
  storage_path?: string | null;
  label?: string | null;
  description?: string | null;
  analysis?: Json | null;
  analysis_status?: string | null;
  created_at?: string;
};

type ResearchPlanStimulusUpdate = {
  id?: string;
  plan_id?: string;
  org_id?: string | null;
  position?: number;
  stimulus_type?: string;
  url?: string;
  storage_path?: string | null;
  label?: string | null;
  description?: string | null;
  analysis?: Json | null;
  analysis_status?: string | null;
  created_at?: string;
};

// ── panel_provider_credentials ───────────────────────────────────────────────
//
// Phase 4 Baustein 3 (Panel-Anbieter) E3 — per-org provider credentials. This
// table deliberately does NOT mirror the older HubSpot/Gong/Slack plaintext
// token columns; Prolific tokens can create studies and are money-adjacent after
// a researcher publishes in Prolific, so E3 stores them encrypted at rest. The
// older integrations remain a separate hardening backlog item, not part of E3.

export type PanelProviderCredentialRow = {
  id: string;
  org_id: string;
  provider: "prolific";
  encrypted_api_token: string;
  token_iv: string;
  token_auth_tag: string;
  encryption_key_id: string | null;
  token_hint: string | null;
  status: "connected" | "invalid" | "unknown";
  provider_user_id: string | null;
  provider_user_email: string | null;
  last_validated_at: string | null;
  validation_error: string | null;
  created_at: string;
  updated_at: string;
};

type PanelProviderCredentialInsert = {
  id?: string;
  org_id: string;
  provider: "prolific";
  encrypted_api_token: string;
  token_iv: string;
  token_auth_tag: string;
  encryption_key_id?: string | null;
  token_hint?: string | null;
  status?: "connected" | "invalid" | "unknown";
  provider_user_id?: string | null;
  provider_user_email?: string | null;
  last_validated_at?: string | null;
  validation_error?: string | null;
  created_at?: string;
  updated_at?: string;
};

type PanelProviderCredentialUpdate = {
  id?: string;
  org_id?: string;
  provider?: "prolific";
  encrypted_api_token?: string;
  token_iv?: string;
  token_auth_tag?: string;
  encryption_key_id?: string | null;
  token_hint?: string | null;
  status?: "connected" | "invalid" | "unknown";
  provider_user_id?: string | null;
  provider_user_email?: string | null;
  last_validated_at?: string | null;
  validation_error?: string | null;
  created_at?: string;
  updated_at?: string;
};

// ── panel_studies ────────────────────────────────────────────────────────────
//
// Panel-E4 — persistierte Provider-Studien (Drafts) pro Plan. status trägt das
// Provider-Vokabular (Prolific: UNPUBLISHED, ACTIVE, …) und bleibt deshalb ein
// freier string; submission_counts/total_cost_cents/last_synced_at werden erst
// ab E5/E6 befüllt.

export type PanelStudyRow = {
  id: string;
  org_id: string;
  plan_id: string;
  provider: "prolific";
  provider_study_id: string;
  status: string;
  draft_input: Json | null;
  submission_counts: Json | null;
  total_cost_cents: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

type PanelStudyInsert = {
  id?: string;
  org_id: string;
  plan_id: string;
  provider: "prolific";
  provider_study_id: string;
  status: string;
  draft_input?: Json | null;
  submission_counts?: Json | null;
  total_cost_cents?: number | null;
  last_synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type PanelStudyUpdate = {
  id?: string;
  org_id?: string;
  plan_id?: string;
  provider?: "prolific";
  provider_study_id?: string;
  status?: string;
  draft_input?: Json | null;
  submission_counts?: Json | null;
  total_cost_cents?: number | null;
  last_synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

// ── Augmented Database type ────────────────────────────────────────────────

export type DatabaseWithResearch = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Omit<Database["public"]["Tables"], "interview_sessions"> & {
      interview_sessions: {
        Row: InterviewSessionsRow;
        Insert: InterviewSessionsInsert;
        Update: InterviewSessionsUpdate;
        Relationships: [];
      };
      research_plans: {
        Row: ResearchPlanRow;
        Insert: ResearchPlanInsert;
        Update: ResearchPlanUpdate;
        Relationships: [];
      };
      research_invites: {
        Row: ResearchInviteRow;
        Insert: ResearchInviteInsert;
        Update: ResearchInviteUpdate;
        Relationships: [];
      };
      research_plan_stimuli: {
        Row: ResearchPlanStimulusRow;
        Insert: ResearchPlanStimulusInsert;
        Update: ResearchPlanStimulusUpdate;
        Relationships: [];
      };
      study_synthesis: {
        Row: StudySynthesisRow;
        Insert: StudySynthesisInsert;
        Update: StudySynthesisUpdate;
        Relationships: [];
      };
      product_discovery_insights: {
        Row: ProductDiscoveryInsightsRow;
        Insert: ProductDiscoveryInsightsInsert;
        Update: ProductDiscoveryInsightsUpdate;
        Relationships: [];
      };
      participant_pool: {
        Row: ParticipantPoolRow;
        Insert: ParticipantPoolInsert;
        Update: ParticipantPoolUpdate;
        Relationships: [];
      };
      participant_pool_invites: {
        Row: ParticipantPoolInviteRow;
        Insert: ParticipantPoolInviteInsert;
        Update: ParticipantPoolInviteUpdate;
        Relationships: [];
      };
      research_plan_quotas: {
        Row: ResearchPlanQuotaRow;
        Insert: ResearchPlanQuotaInsert;
        Update: ResearchPlanQuotaUpdate;
        Relationships: [];
      };
      research_screening_responses: {
        Row: ResearchScreeningResponseRow;
        Insert: ResearchScreeningResponseInsert;
        Update: ResearchScreeningResponseUpdate;
        Relationships: [];
      };
      synthesis_shares: {
        Row: SynthesisShareRow;
        Insert: SynthesisShareInsert;
        Update: SynthesisShareUpdate;
        Relationships: [];
      };
      research_open_links: {
        Row: ResearchOpenLinkRow;
        Insert: ResearchOpenLinkInsert;
        Update: ResearchOpenLinkUpdate;
        Relationships: [];
      };
      panel_provider_credentials: {
        Row: PanelProviderCredentialRow;
        Insert: PanelProviderCredentialInsert;
        Update: PanelProviderCredentialUpdate;
        Relationships: [];
      };
      panel_studies: {
        Row: PanelStudyRow;
        Insert: PanelStudyInsert;
        Update: PanelStudyUpdate;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    // Perf: list_sessions_for_plan berechnet turnCount + Vorschau server-seitig
    // (Migration 20260715000000), damit die MR-Übersicht nicht mehr das volle
    // conversation-JSONB jeder Session lädt. Chirurgisch hier ergänzt statt die
    // ganze database.ts neu zu generieren (vermeidet fremde Typ-Drift).
    Functions: Database["public"]["Functions"] & {
      list_sessions_for_plan: {
        Args: { p_org_id: string; p_plan_id: string; p_limit?: number };
        Returns: {
          id: string;
          status: string;
          mode: string;
          created_at: string;
          completed_at: string | null;
          turn_count: number;
          preview: string | null;
        }[];
      };
    };
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

/**
 * Construct a SupabaseClient typed against DatabaseWithResearch. Service-role
 * key by design (the same access model the existing voice-agent + PD services
 * use). Once src/types/database.ts is regenerated, this helper can be replaced
 * by createAdminSupabaseClient() directly.
 */
export function createResearchSupabase(): SupabaseClient<DatabaseWithResearch> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }
  return createClient<DatabaseWithResearch>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
