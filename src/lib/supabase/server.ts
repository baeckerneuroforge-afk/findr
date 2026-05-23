import "server-only";

import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "@/types/database";

/**
 * The service-role admin client lives in `./admin` (Next/Clerk-free, so seed
 * scripts can import it under plain tsx). Re-exported here so existing callers
 * importing it from `@/lib/supabase/server` keep working unchanged.
 */
export { createAdminSupabaseClient } from "./admin";

/**
 * Server-side Supabase client authenticated via Clerk's session token.
 * Use in Server Components, Route Handlers, and Server Actions for
 * operations that should respect the current user's RLS policies.
 */
export async function createServerSupabaseClient() {
  const { getToken } = await auth();

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return (await getToken()) ?? null;
      },
    },
  );
}
