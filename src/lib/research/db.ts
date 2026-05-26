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
 *     recording_url, transcript_source)
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
  account_id: string | null;
  completed_at: string | null;
  conversation: Json;
  created_at: string;
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
};

type InterviewSessionsInsert = {
  access_token: string;
  account_id?: string | null;
  completed_at?: string | null;
  conversation?: Json;
  created_at?: string;
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
};

type InterviewSessionsUpdate = {
  access_token?: string;
  account_id?: string | null;
  completed_at?: string | null;
  conversation?: Json;
  created_at?: string;
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
};

// ── research_plans ─────────────────────────────────────────────────────────

type ResearchPlanStatus = "draft" | "active" | "completed" | "archived";

export type ResearchPlanRow = {
  id: string;
  org_id: string | null;
  title: string;
  objective: string;
  topic_script: Json;
  persona: string | null;
  sample_target: number | null;
  status: ResearchPlanStatus;
  created_at: string;
};

type ResearchPlanInsert = {
  id?: string;
  org_id?: string | null;
  title: string;
  objective: string;
  topic_script?: Json;
  persona?: string | null;
  sample_target?: number | null;
  status?: ResearchPlanStatus;
  created_at?: string;
};

type ResearchPlanUpdate = {
  id?: string;
  org_id?: string | null;
  title?: string;
  objective?: string;
  topic_script?: Json;
  persona?: string | null;
  sample_target?: number | null;
  status?: ResearchPlanStatus;
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

export type ResearchInviteRow = {
  id: string;
  plan_id: string;
  org_id: string | null;
  contact_label: string;
  contact_email: string | null;
  mode_preference: ResearchInviteModePreference;
  status: ResearchInviteStatus;
  scheduled_at: string | null;
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
  created_at?: string;
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
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
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
