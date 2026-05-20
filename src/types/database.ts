export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_history: {
        Row: {
          alert_type: string
          channel_id: string
          deal_id: string
          error_message: string | null
          id: string
          org_id: string
          payload: Json
          risk_score_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          alert_type: string
          channel_id: string
          deal_id: string
          error_message?: string | null
          id?: string
          org_id: string
          payload: Json
          risk_score_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          alert_type?: string
          channel_id?: string
          deal_id?: string
          error_message?: string | null
          id?: string
          org_id?: string
          payload?: Json
          risk_score_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_risk_score_id_fkey"
            columns: ["risk_score_id"]
            isOneToOne: false
            referencedRelation: "risk_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      call_speakers: {
        Row: {
          call_id: string
          created_at: string | null
          id: string
          name: string
          organization: string | null
          role: string
          speaker_type: string
          talk_time_seconds: number | null
        }
        Insert: {
          call_id: string
          created_at?: string | null
          id?: string
          name: string
          organization?: string | null
          role: string
          speaker_type: string
          talk_time_seconds?: number | null
        }
        Update: {
          call_id?: string
          created_at?: string | null
          id?: string
          name?: string
          organization?: string | null
          role?: string
          speaker_type?: string
          talk_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_speakers_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          analyzed_at: string | null
          call_type: string | null
          created_at: string
          deal_id: string | null
          duration_seconds: number | null
          id: string
          org_id: string
          participants: Json | null
          recorded_at: string | null
          recording_url: string | null
          source: string
          transcript: string | null
          transcript_summary: string | null
        }
        Insert: {
          analyzed_at?: string | null
          call_type?: string | null
          created_at?: string
          deal_id?: string | null
          duration_seconds?: number | null
          id?: string
          org_id: string
          participants?: Json | null
          recorded_at?: string | null
          recording_url?: string | null
          source: string
          transcript?: string | null
          transcript_summary?: string | null
        }
        Update: {
          analyzed_at?: string | null
          call_type?: string | null
          created_at?: string
          deal_id?: string | null
          duration_seconds?: number | null
          id?: string
          org_id?: string
          participants?: Json | null
          recorded_at?: string | null
          recording_url?: string | null
          source?: string
          transcript?: string | null
          transcript_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          org_id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          org_id: string
          provider: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          org_id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number | null
          closed_at: string | null
          company_name: string | null
          created_at: string
          currency: string
          data_source: string
          external_id: string
          hubspot_deal_id: string | null
          hubspot_last_synced_at: string | null
          id: string
          last_activity_at: string | null
          loss_reason: string | null
          name: string
          org_id: string
          owner_email: string | null
          owner_name: string | null
          raw_data: Json | null
          source: string
          stage: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          closed_at?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string
          data_source?: string
          external_id: string
          hubspot_deal_id?: string | null
          hubspot_last_synced_at?: string | null
          id?: string
          last_activity_at?: string | null
          loss_reason?: string | null
          name: string
          org_id: string
          owner_email?: string | null
          owner_name?: string | null
          raw_data?: Json | null
          source: string
          stage?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          closed_at?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string
          data_source?: string
          external_id?: string
          hubspot_deal_id?: string | null
          hubspot_last_synced_at?: string | null
          id?: string
          last_activity_at?: string | null
          loss_reason?: string | null
          name?: string
          org_id?: string
          owner_email?: string | null
          owner_name?: string | null
          raw_data?: Json | null
          source?: string
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          category: string
          content: string
          created_at: string
          deal_id: string | null
          embeddings: string | null
          id: string
          interview_id: string | null
          org_id: string
          severity: Database["public"]["Enums"]["finding_severity"]
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          deal_id?: string | null
          embeddings?: string | null
          id?: string
          interview_id?: string | null
          org_id: string
          severity: Database["public"]["Enums"]["finding_severity"]
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          deal_id?: string | null
          embeddings?: string | null
          id?: string
          interview_id?: string | null
          org_id?: string
          severity?: Database["public"]["Enums"]["finding_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "findings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hubspot_integrations: {
        Row: {
          access_token: string
          created_at: string | null
          enabled: boolean
          hubspot_portal_id: string
          hubspot_user_id: string | null
          id: string
          last_synced_at: string | null
          org_id: string
          refresh_token: string
          sync_error: string | null
          sync_status: "idle" | "syncing" | "failed"
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          enabled?: boolean
          hubspot_portal_id: string
          hubspot_user_id?: string | null
          id?: string
          last_synced_at?: string | null
          org_id: string
          refresh_token: string
          sync_error?: string | null
          sync_status?: "idle" | "syncing" | "failed"
          token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          enabled?: boolean
          hubspot_portal_id?: string
          hubspot_user_id?: string | null
          id?: string
          last_synced_at?: string | null
          org_id?: string
          refresh_token?: string
          sync_error?: string | null
          sync_status?: "idle" | "syncing" | "failed"
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hubspot_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          completed_at: string | null
          created_at: string
          deal_id: string | null
          id: string
          org_id: string
          recording_url: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["interview_status"]
          transcript: string | null
          type: string
          updated_at: string
          vapi_call_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          org_id: string
          recording_url?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          transcript?: string | null
          type: string
          updated_at?: string
          vapi_call_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          org_id?: string
          recording_url?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          transcript?: string | null
          type?: string
          updated_at?: string
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          clerk_org_id: string
          created_at: string
          id: string
          name: string
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          clerk_org_id: string
          created_at?: string
          id?: string
          name: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          clerk_org_id?: string
          created_at?: string
          id?: string
          name?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          org_id: string
          provider: string
          state: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          org_id: string
          provider: string
          state: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          org_id?: string
          provider?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_scores: {
        Row: {
          analyzed_at: string | null
          created_at: string | null
          deal_id: string
          id: string
          org_id: string
          overall_reasoning: string
          recommendations: string[] | null
          risk_level: string
          risk_score: number
          signals: Json
        }
        Insert: {
          analyzed_at?: string | null
          created_at?: string | null
          deal_id: string
          id?: string
          org_id: string
          overall_reasoning: string
          recommendations?: string[] | null
          risk_level: string
          risk_score: number
          signals: Json
        }
        Update: {
          analyzed_at?: string | null
          created_at?: string | null
          deal_id?: string
          id?: string
          org_id?: string
          overall_reasoning?: string
          recommendations?: string[] | null
          risk_level?: string
          risk_score?: number
          signals?: Json
        }
        Relationships: []
      }
      slack_integrations: {
        Row: {
          alert_on_critical_only: boolean
          alert_threshold: number
          channel_id: string
          channel_name: string
          created_at: string | null
          enabled: boolean
          id: string
          org_id: string
          updated_at: string | null
          webhook_url: string
          workspace_name: string | null
        }
        Insert: {
          alert_on_critical_only?: boolean
          alert_threshold?: number
          channel_id: string
          channel_name: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          org_id: string
          updated_at?: string | null
          webhook_url: string
          workspace_name?: string | null
        }
        Update: {
          alert_on_critical_only?: boolean
          alert_threshold?: number
          channel_id?: string
          channel_name?: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          org_id?: string
          updated_at?: string | null
          webhook_url?: string
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slack_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_segments: {
        Row: {
          call_id: string
          created_at: string | null
          end_seconds: number
          id: string
          signals: string[] | null
          speaker_id: string
          start_seconds: number
          text: string
        }
        Insert: {
          call_id: string
          created_at?: string | null
          end_seconds: number
          id?: string
          signals?: string[] | null
          speaker_id: string
          start_seconds: number
          text: string
        }
        Update: {
          call_id?: string
          created_at?: string | null
          end_seconds?: number
          id?: string
          signals?: string[] | null
          speaker_id?: string
          start_seconds?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_segments_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "call_speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          clerk_user_id: string
          created_at: string
          email: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          email: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          email?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
    }
    Enums: {
      finding_severity: "low" | "medium" | "high" | "critical"
      interview_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "failed"
      plan_tier: "free" | "starter" | "pro" | "enterprise"
      user_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      finding_severity: ["low", "medium", "high", "critical"],
      interview_status: [
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
        "failed",
      ],
      plan_tier: ["free", "starter", "pro", "enterprise"],
      user_role: ["owner", "admin", "member"],
    },
  },
} as const
