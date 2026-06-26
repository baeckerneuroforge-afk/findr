import "server-only";

import {
  listResearchPlans,
  type ResearchPlanRecord,
} from "@/lib/research/plans-service";
import { loadOrgSyntheses, fold } from "@/lib/mission-control/engine";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import {
  MIN_PERSONA_INTERVIEWS,
  PERSONA_QUALITY_HINT_UNTIL,
} from "@/lib/synthesis/audience-personas";

/**
 * Konsoul SignalEngine (Orchestrator P1) — the DETERMINISTIC, NO-LLM core that
 * reads an org's research portfolio and emits grounded "Konsoul schlägt vor"
 * suggestions. Every signal carries a REAL count taken straight from the DB and
 * the plan/theme it was derived from; nothing here invents a number, a study, or
 * a theme.
 *
 * SCOPE — what Konsoul surfaces here is DELIBERATELY DISJOINT from the Heute
 * "Nächste Schritte" rules (R1 synthesis / R2 field / R3 draft). Konsoul does NOT
 * repeat those (that would double-surface the same study on one page). It only
 * adds the coaching signals next-steps does NOT cover:
 *   - persona_gate    — a synthesised study below the 10-interview persona gate.
 *   - persona_quality — 10–14 interviews: personas unlocked, but a quality hint
 *                       toward 15 (a softer nudge, NOT a block).
 *   - recurring_theme — the same emergent-theme TITLE appears across ≥2
 *                       synthesised market-research studies → fuel for a
 *                       "next study" idea.
 *
 * Honesty contract (sacred):
 *  - Each signal's `count` is a deterministic count from an existing org-scoped
 *    read (synthesis based_on_count, or the number of distinct studies sharing a
 *    theme title) — never an estimate, never a model judgement.
 *  - `evidence` names exactly what the signal stands on (the plan id/title, or
 *    the theme + the contributing study ids/titles) so the UI can show its basis.
 *  - recurring_theme counts TITLE matches only (a theme that is independently a
 *    THEME in ≥2 studies) — it does NOT count a phrase that merely appears inside
 *    another study's prose, so "Thema X in N Studien" never over-claims.
 *  - `grounded` is true for every signal emitted here by construction (a single-
 *    study theme is simply not emitted — there is no "recurring" claim to make).
 *
 * Architecture mirrors the repo's engine/prompts split: the PURE derivation —
 * `deriveKonsoulSignals` — takes plain inputs and has no DB or network, so the
 * unit test drives hand-built fixtures without seeding Supabase.
 * `computeKonsoulSignals(orgId)` is the thin org-scoped seam.
 *
 * Org-scoping: `orgId` is the trust boundary, authenticated server-side by the
 * caller (requireOrgId on the Heute page). It is closed over in every read and
 * never passed into the derivation as algorithm data. Scope is 'market_research'
 * only (P1) — every synthesis is re-checked against the org's market_research
 * plans (planTitleById membership), so an orphaned or product_discovery synthesis
 * can never surface.
 *
 * Fail-open posture (mirrors the Heute page): a failed read omits its signals
 * rather than crashing the page; `computeKonsoulSignals` never throws and returns
 * [] on any unexpected error.
 */

// ── Tuning constants (org-agnostic, deterministic) ───────────────────────────

/** A theme TITLE must appear in at least this many synthesised studies to be a
 *  grounded recurring_theme (the cross-study "studienübergreifend" bar). */
export const RECURRING_THEME_MIN_STUDIES = 2;

// ── Signal type (typed union) ────────────────────────────────────────────────

export type KonsoulSignalKind =
  | "persona_gate"
  | "persona_quality"
  | "recurring_theme";

/** What a signal stands on. Either a single plan (persona signals) or a theme
 *  spanning studies (recurring_theme). Always concrete, never invented. */
export type KonsoulEvidence =
  | { type: "plan"; planId: string; planTitle: string }
  | { type: "theme"; theme: string; studyIds: string[]; studyTitles: string[] };

export interface KonsoulSignal {
  /** Discriminator + stable React key prefix. */
  kind: KonsoulSignalKind;
  /** Unique, stable instance key (e.g. `persona_gate-<planId>`). The UI uses
   *  this directly as the map key — no reconciliation collisions. */
  key: string;
  /** The REAL count this signal is grounded in. Its meaning depends on kind:
   *   persona_gate    → based_on_count (interviews behind the synthesis, < 10)
   *   persona_quality → based_on_count (10–14)
   *   recurring_theme → number of distinct studies the theme TITLE appears in (≥2). */
  count: number;
  /** What the count was measured on. */
  evidence: KonsoulEvidence;
  /** Always true here (single-study themes are not emitted). Kept on the type so
   *  the UI can defensively render only grounded signals and so future, softer
   *  signal kinds have a place to opt out of the grounded treatment. */
  grounded: boolean;
  /** Ordering weight — lower sorts first:
   *  persona_gate (hard block) > persona_quality (soft hint) > recurring_theme. */
  severity: number;
}

const SEVERITY: Record<KonsoulSignalKind, number> = {
  persona_gate: 0,
  persona_quality: 1,
  recurring_theme: 2,
};

// ── Pure derivation inputs (the DI seam — no DB, fully testable) ──────────────

export interface KonsoulSignalInputs {
  /** Org's market_research plans (newest first), exactly as listResearchPlans
   *  returns them. Used both for the persona arm and to SCOPE the syntheses to
   *  this org's market-research studies (planTitleById membership). */
  plans: ResearchPlanRecord[];
  /** Full org syntheses (carry basedOnCount + emergent_themes already). Scoped
   *  down to market_research via the plans above. Empty array = no signals. */
  syntheses: MissionControlSynthesisInput[];
}

// ── Pure derivation ──────────────────────────────────────────────────────────

/**
 * Derive every Konsoul signal from already-loaded portfolio inputs. PURE: no DB,
 * no network, no LLM, no clock. Each arm is independent. SORTED by severity then
 * count desc, NOT capped (the UI caps to 3).
 */
export function deriveKonsoulSignals(
  inputs: KonsoulSignalInputs,
): KonsoulSignal[] {
  const { plans, syntheses } = inputs;
  const signals: KonsoulSignal[] = [];

  // market_research scope: a synthesis only counts if its study is one of this
  // org's market_research plans. This is the single scope guard for BOTH arms,
  // so a product_discovery or orphaned synthesis can never surface.
  const planTitleById = new Map(plans.map((p) => [p.id, p.title]));
  const scoped = syntheses.filter((s) => planTitleById.has(s.studyId));

  // persona_gate / persona_quality — over scoped synthesised studies, using the
  // already-loaded based_on_count. < 10 blocks personas (hard gate); 10–14
  // unlocks them with a quality hint toward 15; ≥ 15 → no signal.
  for (const synth of scoped) {
    const planTitle = planTitleById.get(synth.studyId) ?? "";
    const based = synth.basedOnCount;
    if (based < MIN_PERSONA_INTERVIEWS) {
      signals.push({
        kind: "persona_gate",
        key: `persona_gate-${synth.studyId}`,
        count: based,
        evidence: { type: "plan", planId: synth.studyId, planTitle },
        grounded: true,
        severity: SEVERITY.persona_gate,
      });
    } else if (based < PERSONA_QUALITY_HINT_UNTIL) {
      signals.push({
        kind: "persona_quality",
        key: `persona_quality-${synth.studyId}`,
        count: based,
        evidence: { type: "plan", planId: synth.studyId, planTitle },
        grounded: true,
        severity: SEVERITY.persona_quality,
      });
    }
  }

  // recurring_theme — a theme TITLE present in ≥2 scoped studies.
  signals.push(...deriveRecurringThemes(scoped));

  return sortSignals(signals);
}

/**
 * Group emergent-theme TITLES across the (already market-research-scoped)
 * syntheses by canonical fold(), counting DISTINCT studies per title. Emit a
 * grounded recurring_theme for every title shared by ≥2 studies.
 *
 * Title-only by design: unlike the cross-study agent's aggregateThemeFrequency
 * (which also substring-matches summaries, fine there because an LLM curates +
 * cites the result), this autonomous surface counts a study only when the phrase
 * is itself a THEME of that study — so "Thema X taucht in N Studien auf" is the
 * literal truth, never inflated by prose mentions. The fold() key is the SAME
 * canonical fold the matching anchor uses, so umlaut/dash/whitespace spellings of
 * one title collapse into a single signal.
 */
function deriveRecurringThemes(
  syntheses: MissionControlSynthesisInput[],
): KonsoulSignal[] {
  const groups = new Map<
    string,
    { display: string; studies: Map<string, string> }
  >();
  for (const synth of syntheses) {
    for (const theme of synth.emergent_themes) {
      const folded = fold(theme.title);
      if (folded === "") continue;
      let group = groups.get(folded);
      if (!group) {
        group = { display: theme.title, studies: new Map() };
        groups.set(folded, group);
      }
      // A study counts AT MOST once per theme (Map keyed by studyId).
      group.studies.set(synth.studyId, synth.studyTitle);
    }
  }

  const out: KonsoulSignal[] = [];
  for (const [folded, group] of groups) {
    if (group.studies.size < RECURRING_THEME_MIN_STUDIES) continue;
    out.push({
      kind: "recurring_theme",
      key: `recurring_theme-${folded}`,
      count: group.studies.size,
      evidence: {
        type: "theme",
        theme: group.display,
        studyIds: [...group.studies.keys()],
        studyTitles: [...group.studies.values()],
      },
      grounded: true,
      severity: SEVERITY.recurring_theme,
    });
  }
  return out;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Stable sort: severity asc, then count desc (a stronger count nudges harder
 *  within a kind), then key for full determinism. */
function sortSignals(signals: KonsoulSignal[]): KonsoulSignal[] {
  return [...signals].sort(
    (a, b) =>
      a.severity - b.severity ||
      b.count - a.count ||
      a.key.localeCompare(b.key),
  );
}

// ── Org-scoped entry (the thin seam — fail-open, never throws) ────────────────

/**
 * Compute the org's Konsoul signals from org-scoped reads. Server-only,
 * fail-open: a failed read omits its signals and any unexpected error yields []
 * (Konsoul simply has nothing to suggest — never a broken page).
 *
 * Scope is market_research only (P1). Two parallel reads: one listResearchPlans
 * (also the scope source) and one loadOrgSyntheses (which already carries
 * basedOnCount + themes, so no per-plan synthesis reads). recurring_theme is
 * pure code over the loaded syntheses — no extra DB. (Konsoul deliberately does
 * NOT re-read completed-session counts or synthesis-id sets: its signals don't
 * depend on them, which also avoids duplicating the Heute page's own reads.)
 */
export async function computeKonsoulSignals(
  orgId: string,
): Promise<KonsoulSignal[]> {
  try {
    const [plans, syntheses] = await Promise.all([
      listResearchPlans(orgId, "market_research").catch(
        () => [] as ResearchPlanRecord[],
      ),
      loadOrgSyntheses(orgId).catch(
        () => [] as MissionControlSynthesisInput[],
      ),
    ]);
    if (plans.length === 0) return [];
    return deriveKonsoulSignals({ plans, syntheses });
  } catch {
    // Total fail-open: Konsoul never breaks the Heute page.
    return [];
  }
}
