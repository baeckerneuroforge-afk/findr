import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { DEV_ORG_ID } from "@/lib/auth/dev-org";
import { MOCK_DEALS } from "@/lib/deals/mock-data";
import type { Database, Json } from "@/types/database";

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

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const now = new Date();

  for (const deal of MOCK_DEALS) {
    const baseScore = Math.floor(Math.random() * 60) + 30;

    for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);

      const variance = Math.floor(Math.random() * 20) - 10;
      const score = Math.max(
        0,
        Math.min(100, baseScore + variance + (14 - daysAgo) * 2),
      );

      let level: "low" | "medium" | "high" | "critical" = "low";
      if (score >= 80) level = "critical";
      else if (score >= 60) level = "high";
      else if (score >= 40) level = "medium";

      const { error } = await supabase.from("risk_scores").insert({
        org_id: DEV_ORG_ID,
        deal_id: deal.id,
        risk_score: score,
        risk_level: level,
        overall_reasoning: `Historical data point ${daysAgo} days ago`,
        recommendations: [],
        signals: [] as unknown as Json,
        analyzed_at: date.toISOString(),
      });

      if (error) {
        throw new Error(`${deal.name}: ${error.message}`);
      }
    }

    console.log(`Seeded 14 days history for ${deal.name}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
