"use client";

import { createClient } from "@supabase/supabase-js";
import { getSession } from "next-auth/react";
import { useMemo } from "react";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client, authenticated via the Zitadel token (NextAuth
 * session). The accessToken callback fetches the current session on each call
 * (getSession hits /api/auth/session, which returns the freshly-rotated token),
 * forwarding the Zitadel ID token as the Supabase access token for RLS.
 *
 * NOTE (Schritt 2, Q1 = "nur de-Clerken"): FORWARD-COMPAT. Nothing uses this
 * client today (all reads go through the service-role admin client), and
 * Supabase Third-Party Auth for the Zitadel issuer is not yet registered. See
 * src/lib/supabase/server.ts for what enabling RLS would require.
 */
export function useSupabaseClient() {
  return useMemo(
    () =>
      createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          async accessToken() {
            const session = await getSession();
            return session?.idToken ?? null;
          },
        },
      ),
    [],
  );
}
