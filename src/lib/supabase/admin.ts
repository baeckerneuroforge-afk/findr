import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Admin Supabase client using the service role key. Bypasses RLS — only use for
 * trusted server-side operations (cron jobs, webhooks, admin tasks, seed
 * scripts). NEVER expose to the client.
 *
 * Deliberately free of any Next.js / Clerk imports so it can be used from plain
 * Node/tsx scripts (run with --conditions=react-server) without dragging in
 * `next/navigation`, which fails outside the Next bundler. The request-scoped,
 * Clerk-authenticated client lives in `./server`, which re-exports this.
 */
export function createAdminSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin operations.",
    );
  }

  return createClient<Database>(
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
