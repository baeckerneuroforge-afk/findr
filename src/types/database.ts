// Hand-written to match supabase/migrations/20260518090000_initial_schema.sql
//
// Regenerate from a live Supabase project once the migration is applied:
//   pnpm dlx supabase gen types typescript --project-id <ref> > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          clerk_org_id: string;
          name: string;
          plan: Database["public"]["Enums"]["plan_tier"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_org_id: string;
          name: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_org_id?: string;
          name?: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          clerk_user_id: string;
          org_id: string;
          email: string;
          role: Database["public"]["Enums"]["user_role"];
          created_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          org_id: string;
          email: string;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          org_id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_connections: {
        Row: {
          id: string;
          org_id: string;
          provider: string;
          access_token: string;
          refresh_token: string | null;
          expires_at: string | null;
          scope: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          provider: string;
          access_token: string;
          refresh_token?: string | null;
          expires_at?: string | null;
          scope?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          provider?: string;
          access_token?: string;
          refresh_token?: string | null;
          expires_at?: string | null;
          scope?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_connections_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      deals: {
        Row: {
          id: string;
          org_id: string;
          external_id: string;
          source: string;
          name: string;
          amount: number | null;
          stage: string | null;
          owner_email: string | null;
          closed_at: string | null;
          loss_reason: string | null;
          raw_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          external_id: string;
          source: string;
          name: string;
          amount?: number | null;
          stage?: string | null;
          owner_email?: string | null;
          closed_at?: string | null;
          loss_reason?: string | null;
          raw_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          external_id?: string;
          source?: string;
          name?: string;
          amount?: number | null;
          stage?: string | null;
          owner_email?: string | null;
          closed_at?: string | null;
          loss_reason?: string | null;
          raw_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deals_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      calls: {
        Row: {
          id: string;
          org_id: string;
          deal_id: string | null;
          source: string;
          recording_url: string | null;
          transcript: string | null;
          duration_seconds: number | null;
          participants: Json | null;
          recorded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          deal_id?: string | null;
          source: string;
          recording_url?: string | null;
          transcript?: string | null;
          duration_seconds?: number | null;
          participants?: Json | null;
          recorded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          deal_id?: string | null;
          source?: string;
          recording_url?: string | null;
          transcript?: string | null;
          duration_seconds?: number | null;
          participants?: Json | null;
          recorded_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calls_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      risk_scores: {
        Row: {
          id: string;
          org_id: string;
          call_id: string | null;
          deal_id: string | null;
          score: number;
          signals: Json | null;
          model_version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          call_id?: string | null;
          deal_id?: string | null;
          score: number;
          signals?: Json | null;
          model_version: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          call_id?: string | null;
          deal_id?: string | null;
          score?: number;
          signals?: Json | null;
          model_version?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "risk_scores_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_scores_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_scores_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      interviews: {
        Row: {
          id: string;
          org_id: string;
          deal_id: string | null;
          type: string;
          status: Database["public"]["Enums"]["interview_status"];
          scheduled_at: string | null;
          completed_at: string | null;
          transcript: string | null;
          recording_url: string | null;
          vapi_call_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          deal_id?: string | null;
          type: string;
          status?: Database["public"]["Enums"]["interview_status"];
          scheduled_at?: string | null;
          completed_at?: string | null;
          transcript?: string | null;
          recording_url?: string | null;
          vapi_call_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          deal_id?: string | null;
          type?: string;
          status?: Database["public"]["Enums"]["interview_status"];
          scheduled_at?: string | null;
          completed_at?: string | null;
          transcript?: string | null;
          recording_url?: string | null;
          vapi_call_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interviews_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interviews_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
        ];
      };
      findings: {
        Row: {
          id: string;
          org_id: string;
          deal_id: string | null;
          interview_id: string | null;
          category: string;
          severity: Database["public"]["Enums"]["finding_severity"];
          content: string;
          // pgvector columns are returned as JSON-encoded strings, e.g. "[0.1, 0.2, …]".
          // Parse with JSON.parse() to get number[] in app code.
          embeddings: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          deal_id?: string | null;
          interview_id?: string | null;
          category: string;
          severity: Database["public"]["Enums"]["finding_severity"];
          content: string;
          embeddings?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          deal_id?: string | null;
          interview_id?: string | null;
          category?: string;
          severity?: Database["public"]["Enums"]["finding_severity"];
          content?: string;
          embeddings?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "findings_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "findings_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "findings_interview_id_fkey";
            columns: ["interview_id"];
            isOneToOne: false;
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_org_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      plan_tier: "free" | "starter" | "pro" | "enterprise";
      user_role: "owner" | "admin" | "member";
      interview_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "failed";
      finding_severity: "low" | "medium" | "high" | "critical";
    };
    CompositeTypes: Record<string, never>;
  };
};

// ─── Convenience helpers ─────────────────────────────────────────────────────
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
