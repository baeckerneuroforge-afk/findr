import { config } from "dotenv";

// Load env the same way the eval runners do (.env.local first, then .env).
// quiet: true → kein dotenv-Banner auf stdout (sauberer Token-Output).
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { createVoiceApiToken } from "@/lib/auth/voice-token";

/**
 * Dev/Admin: mint an org-scoped Findr Voice API token for Etappe-1-Tests.
 *
 *   pnpm voice:token <orgId> [name]
 *
 * <orgId> = interne organizations.id (UUID). Die Dev-Org ist
 * 4909c8ee-017f-4d9a-bdb6-d3b90f0806a0 (siehe src/lib/auth/dev-org).
 * Der Klartext-Token wird NUR EINMAL ausgegeben (nur der Hash wird gespeichert).
 *
 * Voraussetzung: Migration 20260627000000_voice_ingest.sql ist angewendet,
 * SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL sind in .env.local.
 */
async function main() {
  const orgId = process.argv[2] ?? process.env.DEV_ORG_ID;
  const name = process.argv[3] ?? "Findr Voice E1 token";

  if (!orgId) {
    console.error("Usage: pnpm voice:token <orgId> [name]");
    console.error(
      "  <orgId> = interne organizations.id (UUID). Dev-Org: 4909c8ee-017f-4d9a-bdb6-d3b90f0806a0",
    );
    process.exit(1);
  }

  const { id, token } = await createVoiceApiToken(orgId, name);

  console.log("\n✅ Findr Voice API-Token erstellt (NUR JETZT sichtbar):\n");
  console.log("  token: " + token);
  console.log("  id:    " + id);
  console.log("  org:   " + orgId);
  console.log("\nNutzung:  Authorization: Bearer " + token);
  console.log("Smoke:    BASE_URL=http://localhost:3000 VOICE_TOKEN=" + token + " pnpm voice:smoke\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
