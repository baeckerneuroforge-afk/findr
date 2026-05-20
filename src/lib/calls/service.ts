import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";

export interface CallSpeakerRow {
  id: string;
  name: string;
  role: string;
  organization: string | null;
  speaker_type: "sales_rep" | "buyer" | "buyer_team" | "champion";
  talk_time_seconds: number | null;
}

export interface TranscriptSegmentRow {
  id: string;
  call_id: string;
  speaker_id: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
  signals: string[];
}

export interface CallRow {
  id: string;
  deal_id: string | null;
  call_type: string | null;
  duration_seconds: number | null;
  recorded_at: string | null;
  source: string | null;
  transcript: string | null;
  transcript_summary: string | null;
  call_speakers: CallSpeakerRow[];
  transcript_segments: TranscriptSegmentRow[];
}

export async function getCallsByDealId(
  orgId: string,
  dealId: string,
): Promise<CallRow[]> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("calls")
    .select(
      `
      id, deal_id, call_type, duration_seconds, recorded_at, source,
      transcript, transcript_summary,
      call_speakers(*),
      transcript_segments(*)
    `,
    )
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("recorded_at", { ascending: false });

  if (error) {
    console.error("Error fetching calls:", error.message);
    return [];
  }

  return (data ?? []) as CallRow[];
}

export async function getCallById(
  orgId: string,
  callId: string,
): Promise<CallRow | null> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("calls")
    .select(
      `
      id, deal_id, call_type, duration_seconds, recorded_at, source,
      transcript, transcript_summary,
      call_speakers(*),
      transcript_segments(*)
    `,
    )
    .eq("org_id", orgId)
    .eq("id", callId)
    .single();

  if (error) {
    console.error("Error fetching call:", error.message);
    return null;
  }

  return data as CallRow;
}
