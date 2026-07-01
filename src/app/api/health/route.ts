import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { readFreshDbCheck, storeDbCheck } from "./db-memo";

/**
 * GET /api/health — public, side-effect-free liveness/readiness probe for uptime
 * monitors. Does ONE lightweight DB round-trip (HEAD count, no rows returned) to
 * confirm the app can reach Postgres, and reports only a COARSE status — never
 * any data, counts, env names, or error internals (it is public). Returns 200
 * when healthy, 503 when the DB is unreachable.
 */

// A health probe must always run at request time, never be prerendered/cached.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  // 10s-Memo gegen anonyme DB-Query-Amplifikation — Details in ./db-memo.ts.
  let dbOk: boolean;
  const memoized = readFreshDbCheck();
  if (memoized !== null) {
    dbOk = memoized;
  } else {
    try {
      const supabase = createAdminSupabaseClient();
      const { error } = await supabase
        .from("organizations")
        .select("id", { count: "exact", head: true });
      dbOk = !error;
    } catch {
      dbOk = false;
    }
    storeDbCheck(dbOk);
  }

  return NextResponse.json(
    {
      status: dbOk ? "ok" : "degraded",
      db: dbOk ? "up" : "down",
      time: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}
