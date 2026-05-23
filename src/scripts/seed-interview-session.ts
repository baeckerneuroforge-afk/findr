/**
 * Seed a TEST post-loss interview session (no real deal needed) and print the
 * public link to click through locally.
 *
 * Prereqs: migration 20260529000000_interview_sessions applied; .env.local has
 * SUPABASE_* and ANTHROPIC_API_KEY. The session's opening question is generated
 * by Opus, so this makes one Claude call (~$0.02).
 *
 * Imports are kept Next-free (admin Supabase client, not the Clerk-backed one)
 * so nothing pulls in `next/navigation`. The --conditions=react-server flag is
 * still required because the chain uses `server-only` modules (no-op under that
 * condition, throws otherwise).
 *
 * Run (foreground):
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server src/scripts/seed-interview-session.ts
 */

import { config } from "dotenv";

import { DEV_ORG_ID } from "@/lib/auth/dev-org";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { InterviewInput } from "@/lib/voice-agent/interviewer";
import { createInterviewSession } from "@/lib/voice-agent/session-service";

async function main(): Promise<void> {
  config({ path: ".env.local" });

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY not set. Run with: env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server src/scripts/seed-interview-session.ts",
    );
    process.exit(1);
  }

  // org_id must reference a real organizations row (FK). Prefer the first org;
  // fall back to the dev org UUID.
  const supabase = createAdminSupabaseClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .limit(1)
    .maybeSingle();
  const orgId = org?.id ?? DEV_ORG_ID;

  const dealContext: InterviewInput = {
    deal: {
      dealName: "Q2 Renewal (test)",
      company: "Nordwind Logistik GmbH",
      contactName: "Anna Berg",
      amount: 64000,
      currency: "EUR",
    },
    riskAnalysis: {
      riskScore: 78,
      riskLevel: "high",
      signals: [
        {
          type: "CHAMPION_LOSS",
          confidence: 0.86,
          reasoning: "The internal champion appeared to be leaving.",
          quotes: [],
        },
      ],
      overallReasoning:
        "Suspected champion departure put the renewal at risk.",
      recommendations: [],
    },
  };

  const session = await createInterviewSession({
    orgId,
    dealId: null,
    dealContext,
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log("\n  Test interview session created");
  console.log(
    `  org_id : ${orgId} ${org?.id ? "(first org)" : "(DEV_ORG_ID fallback)"}`,
  );
  console.log(`  token  : ${session.accessToken}`);
  console.log(`  open   : ${base}/interview/${session.accessToken}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
