/**
 * Seed-Script: writes mock calls + speakers + transcript segments into Supabase
 * for every Deal in MOCK_DEALS.
 *
 * Prerequisites:
 *   1. Run supabase/migrations/20260519000000_calls_pipeline.sql
 *   2. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   3. Have rows in the `deals` table whose ids match MOCK_DEALS[].id
 *      (the FK calls.deal_id → deals.id is enforced)
 *
 * Run with: pnpm tsx src/scripts/seed-calls.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { MOCK_DEALS } from "@/lib/deals/mock-data";
import { generateCallsForDeal } from "@/lib/calls/mock-call-generator";
import { DEV_ORG_ID } from "@/lib/auth/dev-org";

loadEnv({ path: ".env.local" });
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedCalls() {
  console.log(`Seeding mock calls for ${MOCK_DEALS.length} deals...`);

  for (const deal of MOCK_DEALS) {
    const calls = generateCallsForDeal(deal, 3);

    for (const mockCall of calls) {
      const { data: callRecord, error: callError } = await supabase
        .from("calls")
        .insert({
          org_id: DEV_ORG_ID,
          deal_id: mockCall.deal_id,
          transcript: mockCall.transcript,
          transcript_summary: mockCall.transcript_summary,
          duration_seconds: mockCall.duration_seconds,
          recorded_at: mockCall.recorded_at,
          source: "mock",
          call_type: mockCall.call_type,
        } as never)
        .select()
        .single();

      if (callError || !callRecord) {
        console.error(`✗ insert call failed for ${deal.name}:`, callError?.message);
        continue;
      }

      const speakerIds: string[] = [];
      for (const speaker of mockCall.speakers) {
        const { data: speakerRecord, error: speakerErr } = await supabase
          .from("call_speakers" as never)
          .insert({
            call_id: (callRecord as { id: string }).id,
            name: speaker.name,
            role: speaker.role,
            organization: speaker.organization,
            speaker_type: speaker.speaker_type,
          } as never)
          .select()
          .single();

        if (speakerErr || !speakerRecord) {
          console.error(`  ✗ speaker insert failed:`, speakerErr?.message);
          continue;
        }
        speakerIds.push((speakerRecord as { id: string }).id);
      }

      const segmentsToInsert = mockCall.segments.map((s) => ({
        call_id: (callRecord as { id: string }).id,
        speaker_id: speakerIds[s.speaker_index],
        start_seconds: s.start_seconds,
        end_seconds: s.end_seconds,
        text: s.text,
        signals: s.signals,
      }));

      const { error: segErr } = await supabase
        .from("transcript_segments" as never)
        .insert(segmentsToInsert as never);

      if (segErr) {
        console.error(`  ✗ segment insert failed:`, segErr.message);
        continue;
      }

      console.log(`✓ ${deal.name} → ${mockCall.call_type} (${mockCall.segments.length} segs)`);
    }
  }

  console.log("Done seeding calls.");
}

seedCalls().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
