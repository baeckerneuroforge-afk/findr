import "server-only";

import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import type { Database } from "@/types/database";

/**
 * The service-role admin client lives in `./admin` (Next/auth-free, so seed
 * scripts can import it under plain tsx). Re-exported here so existing callers
 * importing it from `@/lib/supabase/server` keep working unchanged.
 */
export { createAdminSupabaseClient } from "./admin";

/**
 * Server-side Supabase client authenticated via the Zitadel token (NextAuth
 * session). Forwards the Zitadel ID token as the Supabase access token for RLS.
 *
 * NOTE (Schritt 2, Q1 = "nur de-Clerken"): this is currently FORWARD-COMPAT.
 * Nothing calls this client today — all data access goes through the service-
 * role admin client, and Supabase Third-Party Auth for the Zitadel issuer is not
 * yet registered. Org isolation is enforced at the app layer (requireOrgId). To
 * actually exercise RLS, register Zitadel as a Supabase TPA provider and ensure
 * the ID token carries role='authenticated' + org_id (a separate step).
 */
export async function createServerSupabaseClient() {
  const session = await auth();
  const token = session?.idToken ?? null;

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return token;
      },
    },
  );
}
