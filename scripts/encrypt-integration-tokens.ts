import { config } from "dotenv";

// Load env before any client is built (.env.local first, then .env), matching
// the smoke/eval runners. Needs NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY and PANEL_CREDENTIALS_ENCRYPTION_KEY.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { encryptSecret, isEncryptedSecret } from "@/lib/crypto/secret-cipher";

/**
 * One-time, idempotent backfill: encrypt the integration credentials that
 * pre-date S4 (HubSpot/Gong OAuth tokens, Slack webhook URLs). Already-encrypted
 * values (enc:v1: prefix) are skipped, so re-running is safe. Run once in Prod
 * after deploying the encrypt/decrypt code:
 *
 *   pnpm tsx --conditions=react-server scripts/encrypt-integration-tokens.ts
 *
 * HubSpot/Gong tokens also self-heal on the next OAuth refresh, but Slack
 * webhook URLs are never rewritten — so this backfill is required to remove the
 * last plaintext secrets at rest.
 */

const TARGETS: Array<{ table: string; columns: string[] }> = [
  { table: "hubspot_integrations", columns: ["access_token", "refresh_token"] },
  { table: "gong_integrations", columns: ["access_token", "refresh_token"] },
  { table: "slack_integrations", columns: ["webhook_url"] },
];

// Minimal structural view of the service-role client for the few dynamic,
// table-name-driven calls below (the generated per-table generics don't model a
// runtime table variable cleanly). Service role bypasses RLS by design.
interface LooseDb {
  from: (table: string) => {
    select: (columns: string) => Promise<{
      data: Array<Record<string, string | null>> | null;
      error: { message: string } | null;
    }>;
    update: (values: Record<string, string>) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
}

async function main() {
  const db = createAdminSupabaseClient() as unknown as LooseDb;
  let scannedTotal = 0;
  let encryptedTotal = 0;

  for (const { table, columns } of TARGETS) {
    const { data, error } = await db
      .from(table)
      .select(["id", ...columns].join(", "));
    if (error) {
      console.error(`[${table}] read failed: ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    const rows = data ?? [];
    let encrypted = 0;

    for (const row of rows) {
      scannedTotal++;
      const update: Record<string, string> = {};
      for (const col of columns) {
        const value = row[col];
        if (
          typeof value === "string" &&
          value.length > 0 &&
          !isEncryptedSecret(value)
        ) {
          update[col] = encryptSecret(value);
        }
      }
      if (Object.keys(update).length === 0) continue;

      const id = row.id;
      if (typeof id !== "string") continue;
      const { error: updateError } = await db.from(table).update(update).eq("id", id);
      if (updateError) {
        console.error(`[${table}] update ${id} failed: ${updateError.message}`);
        process.exitCode = 1;
        continue;
      }
      encrypted++;
      encryptedTotal++;
      console.log(`[${table}] encrypted ${Object.keys(update).join(" + ")} for ${id}`);
    }

    console.log(`[${table}] ${rows.length} row(s) scanned, ${encrypted} encrypted`);
  }

  console.log(
    `\nDone — ${encryptedTotal}/${scannedTotal} row(s) encrypted (already-encrypted skipped).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
