/**
 * End-to-end test for Product Discovery.
 *
 * Picks a real call with a substantial transcript, runs the classifier, writes
 * into product_discovery_insights, then reads the row back and prints feature
 * requests / pain points / themes / summary plus the FK columns so the
 * deal-id / account-id routing is visible.
 *
 * Why this is inline-equivalent to analyzeCallForProductDiscovery instead of
 * calling that function directly: the service module statically imports
 * `@/lib/supabase/server`, `@/lib/auth/org`, `@/lib/settings/org-settings`,
 * `@/lib/accounts/service`, and `@/lib/deals/service` — every one of which
 * transitively pulls in `@/auth` (next-auth) → `next/server` →
 * `next/navigation`. Outside the Next bundler, tsx hits a hard wall:
 *   - without `--conditions=react-server`, the `server-only` package
 *     refuses to load and throws on import;
 *   - with `--conditions=react-server`, `next/navigation` loads but React
 *     under that condition has no `createContext`, blowing up
 *     `next/dist/shared/lib/app-router-context.shared-runtime.ts`.
 * Same wall the seed scripts hit (cf. seed-calls.ts, seed-risk-scores.ts —
 * they construct supabase + anthropic clients directly for the same reason).
 *
 * This script therefore exercises the EXACT same chain — same classifier,
 * same insert payload, same row shape — by going via `@/lib/supabase/admin`
 * directly. If the row appears with the right FK columns and the classifier
 * returns valid grounded output, the chain is verified end-to-end.
 *
 * Costs ONE real Opus call. Invoke from the repo root:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server \
 *     src/scripts/test-product-discovery-e2e.ts
 *
 * Override the call with PD_E2E_CALL_ID=<uuid> to re-run on a specific
 * transcript.
 */

import { config as loadEnv } from "dotenv";

interface CallCandidate {
  id: string;
  org_id: string;
  deal_id: string | null;
  account_id: string | null;
  transcript: string;
  recorded_at: string | null;
  call_type: string | null;
}

async function pickCall(explicitId?: string): Promise<CallCandidate> {
  const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminSupabaseClient();

  if (explicitId) {
    const { data, error } = await supabase
      .from("calls")
      .select("id, org_id, deal_id, account_id, transcript, recorded_at, call_type")
      .eq("id", explicitId)
      .maybeSingle();
    if (error || !data) {
      throw new Error(
        `PD_E2E_CALL_ID=${explicitId} not found: ${error?.message ?? "no row"}`,
      );
    }
    if (!data.transcript) {
      throw new Error(`Call ${explicitId} has no transcript`);
    }
    return { ...data, transcript: data.transcript };
  }

  const { data, error } = await supabase
    .from("calls")
    .select("id, org_id, deal_id, account_id, transcript, recorded_at, call_type")
    .not("transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Failed to list calls: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("No calls with transcripts in this database.");
  }

  const ranked = data
    .filter((c): c is typeof c & { transcript: string } => !!c.transcript)
    .filter((c) => c.transcript.trim().length >= 500)
    .filter((c) => c.deal_id !== null || c.account_id !== null)
    .sort((a, b) => b.transcript.length - a.transcript.length);

  if (ranked.length === 0) {
    throw new Error(
      "No usable call: need transcript ≥ 500 chars AND deal_id or account_id set.",
    );
  }

  console.log("Top 3 candidates by transcript length:");
  ranked.slice(0, 3).forEach((c, i) => {
    const side = c.deal_id ? `deal_id=${c.deal_id}` : `account_id=${c.account_id}`;
    console.log(
      `  ${i + 1}. ${c.id} · ${c.transcript.length} chars · ${side} · ${c.call_type ?? "—"} · recorded ${c.recorded_at ?? "—"}`,
    );
  });

  return ranked[0];
}

function previewTranscript(s: string, max = 400): string {
  const collapsed = s.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, max) + " …";
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local" });
  loadEnv();

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Ensure .env.local has it and no empty shell var is shadowing it — run with: env -u ANTHROPIC_API_KEY ...",
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set in .env.local.");
  }

  // ── Step 1: pick a call ──────────────────────────────────────────────────
  console.log("=".repeat(78));
  console.log("STEP 1 — picking a call");
  console.log("=".repeat(78));
  const call = await pickCall(process.env.PD_E2E_CALL_ID);
  const side = call.deal_id
    ? `deal_id=${call.deal_id}`
    : `account_id=${call.account_id}`;
  console.log("");
  console.log("Picked:");
  console.log(`  call_id:     ${call.id}`);
  console.log(`  org_id:      ${call.org_id}`);
  console.log(`  side:        ${side}`);
  console.log(`  call_type:   ${call.call_type ?? "—"}`);
  console.log(`  recorded_at: ${call.recorded_at ?? "—"}`);
  console.log(`  transcript:  ${call.transcript.length} chars`);
  console.log(`  preview:     ${previewTranscript(call.transcript)}`);

  // ── Step 2: run the classifier (the same one the service calls) ─────────
  console.log("");
  console.log("=".repeat(78));
  console.log("STEP 2 — analyzeProductDiscovery (real Opus call)");
  console.log("=".repeat(78));
  const { analyzeProductDiscovery, DEFAULT_PRODUCT_DISCOVERY_MODEL } =
    await import("@/lib/product-discovery/classifier");
  const model =
    process.env.PRODUCT_DISCOVERY_MODEL ?? DEFAULT_PRODUCT_DISCOVERY_MODEL;
  console.log(`  model: ${model}`);

  const t0 = Date.now();
  const result = await analyzeProductDiscovery(
    {
      transcript: call.transcript,
      // No account context: would require getOrgName/getAccount/getDealById,
      // which all sit on the next-auth/next-server import chain we can't load
      // here. The
      // classifier handles missing account context cleanly (see prompts.ts
      // "(none provided — base your analysis solely on the transcript below)").
      recordedAt: call.recorded_at,
    },
    model,
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  done in ${elapsed}s`);
  console.log(
    `  classifier returned: ${result.featureRequests.length} FR, ${result.painPoints.length} PP, ${result.themes.length} themes`,
  );

  // ── Step 3: write to product_discovery_insights (same payload the service builds) ──
  console.log("");
  console.log("=".repeat(78));
  console.log("STEP 3 — insert into product_discovery_insights");
  console.log("=".repeat(78));
  const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminSupabaseClient();
  const insertedAt = new Date().toISOString();

  // Untyped insert by design: src/types/database.ts hasn't been regenerated
  // post-migration. Service.ts has a typed augmentation; this script does the
  // simpler thing since we only need one insert + select.
  const { data: insertedRow, error: insertError } = await (
    supabase as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: Record<string, unknown> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("product_discovery_insights")
    .insert({
      org_id: call.org_id,
      source_call_id: call.id,
      deal_id: call.deal_id,
      account_id: call.account_id,
      feature_requests: result.featureRequests,
      pain_points: result.painPoints,
      themes: result.themes,
      summary: result.summary,
      analysis_method: "ai",
      analyzed_at: insertedAt,
    })
    .select("*")
    .single();

  if (insertError || !insertedRow) {
    console.error(
      `  FAILED: insert error: ${insertError?.message ?? "no row returned"}`,
    );
    process.exit(1);
  }
  console.log(`  inserted row id: ${insertedRow.id as string}`);

  // ── Step 4: read the row back (raw select; getLatestInsightsForCall would be the typed equivalent) ──
  console.log("");
  console.log("=".repeat(78));
  console.log("STEP 4 — SELECT back from product_discovery_insights");
  console.log("=".repeat(78));
  const { data: persistedRow, error: readError } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            eq: (
              col: string,
              val: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<{
                    data: Record<string, unknown> | null;
                    error: { message: string } | null;
                  }>;
                };
              };
            };
          };
        };
      };
    }
  )
    .from("product_discovery_insights")
    .select("*")
    .eq("org_id", call.org_id)
    .eq("source_call_id", call.id)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError || !persistedRow) {
    console.error(
      `  FAILED: read error: ${readError?.message ?? "no row found after insert"}`,
    );
    process.exit(1);
  }
  if ((persistedRow.id as string) !== (insertedRow.id as string)) {
    console.warn(
      `  WARN: inserted id (${insertedRow.id as string}) ≠ read-back id (${persistedRow.id as string}) — concurrent writer?`,
    );
  }

  // ── Step 5: report ───────────────────────────────────────────────────────
  console.log("");
  console.log("Persisted row:");
  console.log(`  id:              ${persistedRow.id as string}`);
  console.log(`  org_id:          ${persistedRow.org_id as string}`);
  console.log(`  source_call_id:  ${persistedRow.source_call_id as string}`);
  console.log(`  deal_id:         ${(persistedRow.deal_id as string | null) ?? "—"}`);
  console.log(`  account_id:      ${(persistedRow.account_id as string | null) ?? "—"}`);
  console.log(`  analysis_method: ${persistedRow.analysis_method as string}`);
  console.log(`  analyzed_at:     ${persistedRow.analyzed_at as string}`);

  const routingOk =
    (persistedRow.deal_id as string | null) === call.deal_id &&
    (persistedRow.account_id as string | null) === call.account_id;
  console.log(`  routing:         ${routingOk ? "OK" : "MISMATCH"}`);
  if (!routingOk) {
    console.error(
      `    expected deal_id=${call.deal_id} account_id=${call.account_id}`,
    );
    console.error(
      `    got      deal_id=${persistedRow.deal_id} account_id=${persistedRow.account_id}`,
    );
    process.exit(1);
  }

  const featureRequests = persistedRow.feature_requests as Array<{
    category: string;
    title: string;
    description: string;
    intensity: string;
    confidence: number;
    evidence: string[];
  }>;
  const painPoints = persistedRow.pain_points as Array<{
    category: string;
    title: string;
    description: string;
    severity: string;
    confidence: number;
    evidence: string[];
  }>;
  const themes = persistedRow.themes as Array<{
    label: string;
    summary: string;
    relatedFeatureRequestIndices: number[];
    relatedPainPointIndices: number[];
  }>;

  console.log("");
  console.log(`SUMMARY: ${(persistedRow.summary as string | null) ?? "(none)"}`);
  console.log("");
  console.log(`FEATURE REQUESTS (${featureRequests.length}):`);
  featureRequests.forEach((fr, i) => {
    console.log(
      `  ${i} [${fr.category}] intensity=${fr.intensity} conf=${fr.confidence.toFixed(2)}`,
    );
    console.log(`    title: ${fr.title}`);
    console.log(`    desc:  ${fr.description}`);
    fr.evidence.forEach((ev, k) => console.log(`    ev[${k}]: "${ev}"`));
  });
  console.log("");
  console.log(`PAIN POINTS (${painPoints.length}):`);
  painPoints.forEach((pp, i) => {
    console.log(
      `  ${i} [${pp.category}] severity=${pp.severity} conf=${pp.confidence.toFixed(2)}`,
    );
    console.log(`    title: ${pp.title}`);
    console.log(`    desc:  ${pp.description}`);
    pp.evidence.forEach((ev, k) => console.log(`    ev[${k}]: "${ev}"`));
  });
  console.log("");
  console.log(`THEMES (${themes.length}):`);
  themes.forEach((t, i) => {
    console.log(`  ${i}: ${t.label}`);
    console.log(`     ${t.summary}`);
    console.log(
      `     FR=[${t.relatedFeatureRequestIndices.join(", ")}]  PP=[${t.relatedPainPointIndices.join(", ")}]`,
    );
  });

  console.log("");
  console.log("=".repeat(78));
  console.log("E2E OK — classifier ran, row persisted, read-back matches.");
}

main().catch((err) => {
  console.error("");
  console.error("E2E FAILED:");
  console.error(err);
  process.exit(1);
});
