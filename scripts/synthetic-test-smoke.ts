import { config } from "dotenv";

// Load env the same way the voice/open-link smokes do (.env.local first, then
// .env). ESM evaluates the imports below first, then these top-level config()
// calls, and only AFTER that does main() run — so SUPABASE_*/ANTHROPIC_* are set
// before any client is built (the service modules read env lazily at call time).
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { createResearchSupabase } from "@/lib/research/db";
import {
  countCompletedSessionsForPlan,
  getResearchPlan,
  planToAgentContext,
} from "@/lib/research/plans-service";
import { synthesizeFromInputs } from "@/lib/synthesis/engine";
import { runSyntheticInterview } from "@/lib/synthetic/orchestration";
import { DEFAULT_PERSONAS } from "@/lib/synthetic/personas";
import {
  advanceSyntheticTestRun,
  deleteSyntheticTestRun,
  extractSessionInsight,
  startSyntheticTestRun,
} from "@/lib/synthetic/service";
import type { PersonaInput } from "@/lib/synthetic/persona";
import type { SynthesisInsightInput } from "@/lib/synthesis/prompts";
import type { ResearchInput } from "@/lib/voice-agent/interviewer";

/**
 * Synthetic dry-run smoke — Stufe 1. Proves TWO things end-to-end:
 *
 *   (A) A synthetic interview runs (real interview agent ↔ synthetic persona)
 *       and a market-lens TEST SYNTHESIS comes out. Pure LLM, NO DB rows.
 *   (B) STRICT SEPARATION: a synthetic run does NOT move the real numbers —
 *       countCompletedSessionsForPlan ("47 von 200"), the plan's + org's
 *       product_discovery_insights (Insights / getAllInsightsForOrg) and
 *       study_synthesis (Synthese / Cross-Study). Before == After.
 *
 * Phase (A) always runs. Phase (B) — the SERVICE path that writes the dedicated
 * synthetic_test_* tables — only runs once the additive migration
 * (20260701000000_synthetic_test.sql) is applied; until then it is skipped with
 * a note (the in-memory proof already shows the mechanic).
 *
 * Models default to the production tiers; for a cheap/fast verification run with
 *   VOICE_MODEL=claude-sonnet-4-6 PRODUCT_DISCOVERY_MODEL=claude-sonnet-4-6 \
 *   SYNTHESIS_MODEL=claude-sonnet-4-6
 * (the synthetic persona is Sonnet by default already).
 */

const ORG_ID = process.env.SYN_ORG_ID ?? "025a580f-fb65-4421-a3b8-78566a6d6aef";
const PLAN_ID = process.env.SYN_PLAN_ID ?? "ab92cc66-e46a-408f-93f9-a0da802daa43";
const PERSONA_IDS = (process.env.SYN_PERSONAS ?? "terse,skeptic").split(",");

interface RealCounts {
  completed: number | null;
  pdPlan: number;
  pdOrg: number;
  synPlan: number;
  synOrg: number;
}

async function realCounts(orgId: string, planId: string): Promise<RealCounts> {
  const supabase = createResearchSupabase();
  const completed = await countCompletedSessionsForPlan(orgId, planId);
  const pdPlan = await supabase
    .from("product_discovery_insights")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  const pdOrg = await supabase
    .from("product_discovery_insights")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  const synPlan = await supabase
    .from("study_synthesis")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  const synOrg = await supabase
    .from("study_synthesis")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  return {
    completed,
    pdPlan: pdPlan.count ?? 0,
    pdOrg: pdOrg.count ?? 0,
    synPlan: synPlan.count ?? 0,
    synOrg: synOrg.count ?? 0,
  };
}

function sameCounts(a: RealCounts, b: RealCounts): boolean {
  return (
    a.completed === b.completed &&
    a.pdPlan === b.pdPlan &&
    a.pdOrg === b.pdOrg &&
    a.synPlan === b.synPlan &&
    a.synOrg === b.synOrg
  );
}

function hr(label: string): void {
  console.log(`\n${"─".repeat(72)}\n${label}\n${"─".repeat(72)}`);
}

async function main() {
  const plan = await getResearchPlan(ORG_ID, PLAN_ID);
  if (!plan) {
    throw new Error(`Plan ${PLAN_ID} not found in org ${ORG_ID}.`);
  }
  console.log(
    `Plan: "${plan.title}" · study_type=${plan.studyType} · sample_target=${plan.sampleTarget}`,
  );
  if (plan.studyType !== "market_research") {
    throw new Error("Smoke expects a market_research plan.");
  }

  const before = await realCounts(ORG_ID, PLAN_ID);
  hr("REAL DATA — BEFORE");
  console.log(before);

  // ── Phase A — live in-memory dry-run (no DB) ───────────────────────────────
  const agentInput: ResearchInput = {
    plan: planToAgentContext(plan),
    // brand omitted in the harness (Clerk-free) → independent-research framing;
    // the real UI resolves the org brand. Does not affect the separation proof.
    brand: null,
  };

  const chosen = DEFAULT_PERSONAS.filter((p) => PERSONA_IDS.includes(p.id));
  const insights: SynthesisInsightInput[] = [];

  for (const persona of chosen) {
    hr(`SYNTHETIC INTERVIEW — persona "${persona.fallbackLabel}"`);
    // Per-session try/catch MIRRORS advanceSyntheticTestRun: one bad interview /
    // extraction marks that session failed and is skipped — it never aborts the
    // run. (Without this guard the smoke crashes on e.g. a transient classifier
    // schema-miss; the service stays resilient.)
    try {
      const personaInput: PersonaInput = {
        personaPrompt: persona.prompt,
        study: { objective: plan.objective, targetPersona: plan.persona },
      };
      const result = await runSyntheticInterview({
        agentInput,
        personaInput,
        language: "de",
      });
      for (const turn of result.conversation) {
        const who = turn.role === "agent" ? "Bot " : "Pers";
        console.log(`  [${who}] ${turn.text}`);
      }
      console.log(
        `  → ended by: ${result.endedBy} · turns: ${result.conversation.length}`,
      );

      // Study-type-aware extraction (market lens for a market_research plan) —
      // the same path the service + real pipeline use.
      const insight = await extractSessionInsight(plan, result.transcript);
      console.log(
        `  → extracted: ${insight.featureRequests.length} market-findings · sentiment=${insight.sentiment}`,
      );
      console.log(`  → summary: ${insight.summary}`);
      insights.push({
        id: persona.id,
        summary: insight.summary,
        featureRequests: insight.featureRequests,
        painPoints: insight.painPoints,
        themes: insight.themes,
        respondentRole: insight.respondentRole,
        respondentSegment: insight.respondentSegment,
        sentiment: insight.sentiment,
      });
    } catch (err) {
      console.log(
        `  ⚠ session failed (skipped, exactly as the service marks it failed): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  if (insights.length === 0) {
    console.log("\nNo successful synthetic interviews — nothing to synthesize.");
  } else {
    hr(
      "TEST SYNTHESIS (market lens, in-memory — never written to study_synthesis)",
    );
    const synthesis = await synthesizeFromInputs({
      plan: {
        title: plan.title,
        objective: plan.objective,
        persona: plan.persona,
        studyType: plan.studyType,
      },
      insights,
    });
    console.log(`Overview: ${synthesis.overview}`);
    console.log(`Emergent themes (${synthesis.emergent_themes.length}):`);
    for (const th of synthesis.emergent_themes) {
      console.log(
        `  • ${th.title} (×${th.frequency}; sources: ${th.sourceInsightIds.join(", ")})`,
      );
    }
    console.log(`Tensions (${synthesis.tensions.length}):`);
    for (const tn of synthesis.tensions) {
      console.log(`  • ${tn.description}`);
    }
  }

  // ── Phase B — service path (writes synthetic_test_* tables), if present ─────
  let phaseBRan = false;
  let createdRunId: string | null = null;
  try {
    hr("SERVICE PATH (synthetic_test_* tables) — start → step → cleanup");
    const personasPayload = chosen.map((p) => ({
      id: p.id,
      label: p.fallbackLabel,
      prompt: p.prompt,
    }));
    let state = await startSyntheticTestRun({
      orgId: ORG_ID,
      planId: PLAN_ID,
      request: { language: "de", personas: personasPayload },
    });
    createdRunId = state.runId;
    phaseBRan = true;
    console.log(
      `run ${state.runId} started: ${state.sessions.length} pending sessions`,
    );
    let guard = 0;
    while (state.status === "running" && guard < state.totalSteps + 2) {
      const next = await advanceSyntheticTestRun({
        orgId: ORG_ID,
        planId: PLAN_ID,
        runId: state.runId,
      });
      if (!next) break;
      state = next;
      console.log(
        `  step ${state.step}/${state.totalSteps} · status=${state.status}`,
      );
      guard++;
    }
    console.log(
      `run settled: status=${state.status} · synthesis=${state.synthesis ? "present" : "none"}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/synthetic_test|does not exist|relation/i.test(msg)) {
      console.log(
        "synthetic_test_* tables not present yet — skipping the DB-level before/after.\n" +
          "Apply supabase/migrations/20260701000000_synthetic_test.sql, then re-run this smoke.",
      );
    } else {
      throw err;
    }
  }

  // ── Separation proof — AFTER ───────────────────────────────────────────────
  const after = await realCounts(ORG_ID, PLAN_ID);
  hr("REAL DATA — AFTER");
  console.log(after);

  const unchanged = sameCounts(before, after);
  hr("SEPARATION VERDICT");
  console.log(
    `Real numbers unchanged by the synthetic run: ${unchanged ? "YES ✓" : "NO ✗"}`,
  );
  console.log(
    `  completed-sessions ("X von ${plan.sampleTarget}"): ${before.completed} → ${after.completed}`,
  );
  console.log(`  product_discovery_insights (plan): ${before.pdPlan} → ${after.pdPlan}`);
  console.log(`  product_discovery_insights (org):  ${before.pdOrg} → ${after.pdOrg}`);
  console.log(`  study_synthesis (plan):            ${before.synPlan} → ${after.synPlan}`);
  console.log(`  study_synthesis (org):             ${before.synOrg} → ${after.synOrg}`);

  // ── Cleanup — remove the synthetic run (sessions cascade) ──────────────────
  if (phaseBRan && createdRunId) {
    const deleted = await deleteSyntheticTestRun({
      orgId: ORG_ID,
      planId: PLAN_ID,
      runId: createdRunId,
    });
    console.log(`\nCleanup: deleted synthetic run ${createdRunId}: ${deleted}`);
  }

  if (!unchanged) {
    process.exitCode = 1;
    console.error("\nFAIL: a synthetic run changed real numbers.");
  } else {
    console.log("\nPASS: synthetic run produced a test synthesis and left all real numbers untouched.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
