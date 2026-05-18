"use client";

import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client, authenticated via Clerk's session token.
 * Requires Clerk's native Supabase third-party auth integration to be enabled
 * (or a Clerk JWT template configured for Supabase).
 *
 * Use this in client components to read/write with the user's RLS context.
 */
export function useSupabaseClient() {
  const { getToken } = useAuth();

  return useMemo(
    () =>
      createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          async accessToken() {
            return (await getToken()) ?? null;
          },
        },
      ),
    [getToken],
  );
}
