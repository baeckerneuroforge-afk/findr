import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { createResearchSupabase } from "@/lib/research/db";
import { getResearchPlan } from "@/lib/research/plans-service";
import { getStudySynthesis } from "@/lib/synthesis/service";

/**
 * Shareable synthesis links — the backend for /shared/synthesis/[token].
 *
 * SECURITY MODEL (mirrors voice-agent/session-service.ts): RLS on
 * synthesis_shares stays strict (org_isolation). The public read page never
 * uses the anon key — every read goes through the SERVICE-ROLE client (which
 * bypasses RLS) and is always scoped to the single row matching the caller's
 * token. The token is a 256-bit random string (capability URL). We never
 * list/enumerate shares for the public path and never trust org_id from the
 * request, so possessing the unguessable token grants read of exactly one
 * synthesis and nothing else.
 *
 * DSGVO: the public DTO is filtered HERE, at the source — sourceInsightIds are
 * NEVER carried out of this module, and verbatim quotes are dropped entirely
 * unless the share's show_quotes opt-in is set. The read-only view can't leak
 * what it never receives.
 */

function generateShareToken(): string {
  // 256-bit, URL-safe, unguessable — the same capability-credential scheme as
  // interview_sessions.access_token (voice-agent/session-service.ts:129). The
  // token IS the authorization.
  return randomBytes(32).toString("base64url");
}

// ── Create / manage (org-internal) ───────────────────────────────────────────

const CreateShareOptionsSchema = z.object({
  /** DSGVO opt-in — verbatim participant quotes. Default OFF. */
  showQuotes: z.boolean().default(false),
  /** Language the account-less stakeholder will see. Stored on the row because
   *  there's no cookie / org-locale for them. */
  language: z.enum(["de", "en"]).default(DEFAULT_LOCALE),
  /** Optional expiry. null = never expires. */
  expiresAt: z.string().datetime().nullable().default(null),
});
export type CreateShareOptions = z.input<typeof CreateShareOptionsSchema>;

/** Org-internal view of a share link (returned by create / list). Carries the
 *  token because the owning org needs it to build the link — this is NOT the
 *  public path, the org owns its own shares. */
export interface SynthesisShareLink {
  id: string;
  token: string;
  planId: string;
  language: Locale;
  showQuotes: boolean;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

interface SynthesisShareRowLike {
  id: string;
  token: string;
  plan_id: string;
  language: "de" | "en";
  show_quotes: boolean;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

function toShareLink(row: SynthesisShareRowLike): SynthesisShareLink {
  return {
    id: row.id,
    token: row.token,
    planId: row.plan_id,
    language: row.language,
    showQuotes: row.show_quotes,
    expiresAt: row.expires_at,
    revoked: row.revoked,
    createdAt: row.created_at,
  };
}

/**
 * Create a share link for a plan's synthesis. The caller MUST have verified
 * that the plan belongs to `orgId` first (the API route does this via
 * getResearchPlan, mirroring the synthesis route) — this function trusts the
 * (orgId, planId) pair it's handed.
 */
export async function createSynthesisShare(
  orgId: string,
  planId: string,
  options: CreateShareOptions = {},
): Promise<SynthesisShareLink> {
  const opts = CreateShareOptionsSchema.parse(options);
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("synthesis_shares")
    .insert({
      token: generateShareToken(),
      org_id: orgId,
      plan_id: planId,
      language: opts.language,
      show_quotes: opts.showQuotes,
      expires_at: opts.expiresAt,
    })
    .select()
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to create synthesis share: ${error?.message ?? "no row returned"}`,
    );
  }
  return toShareLink(data);
}

/**
 * Soft-revoke a share (sets revoked=true). Org-scoped: the share must belong to
 * `orgId`. The explicit org_id filter is belt-and-suspenders — the service-role
 * client bypasses RLS, so all management writes filter org_id by hand (the same
 * rule documented in participant_pool). Returns false if no matching share.
 */
export async function revokeSynthesisShare(
  orgId: string,
  shareId: string,
): Promise<boolean> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("synthesis_shares")
    .update({ revoked: true })
    .eq("org_id", orgId)
    .eq("id", shareId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

/** List a plan's share links (org-internal, newest first). */
export async function listSynthesisShares(
  orgId: string,
  planId: string,
): Promise<SynthesisShareLink[]> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("synthesis_shares")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toShareLink);
}

// ── Public read (account-less, token only) ───────────────────────────────────

/** One emergent theme as exposed to the public link. NO sourceInsightIds.
 *  `quotes` is empty unless the share opted into show_quotes. */
export interface SharedSynthesisTheme {
  title: string;
  summary: string;
  frequency: number;
  quotes: string[];
}

/** One side of a tension, public-safe. NO sourceInsightIds. */
export interface SharedSynthesisTensionSide {
  label: string;
  quotes: string[];
}

export interface SharedSynthesisTension {
  description: string;
  sideA: SharedSynthesisTensionSide;
  sideB: SharedSynthesisTensionSide;
}

/** The complete public-safe payload behind a share token. Contains ONLY the
 *  aggregated synthesis surface — no raw transcripts, no source IDs, no
 *  account/deal data, quotes only when opted in. */
export interface SharedSynthesis {
  planTitle: string;
  overview: string | null;
  emergentThemes: SharedSynthesisTheme[];
  tensions: SharedSynthesisTension[];
  basedOnCount: number;
  language: Locale;
  showQuotes: boolean;
  synthesizedAt: string | null;
}

/**
 * Resolve a share token to its public-safe synthesis payload, or null.
 *
 * Returns null — a SINGLE generic miss for unknown / revoked / expired / not-
 * yet-synthesised — so the public page can't be used to probe which tokens ever
 * existed (no enumeration signal). Steps:
 *
 *   1. Look up the share by token (service-role, RLS-bypassed, single row).
 *   2. Guard: not revoked, not past expires_at.
 *   3. Live-load the CURRENT synthesis for the share's plan (reuse the
 *      canonical getStudySynthesis — study_synthesis is UNIQUE(org_id, plan_id),
 *      so re-runs upsert and the link always reflects the latest). null /
 *      never-synthesised → treat as "not available".
 *   4. Filter to the public-safe DTO (drop sourceInsightIds always; drop quotes
 *      unless show_quotes).
 */
export async function getSharedSynthesis(
  token: string,
): Promise<SharedSynthesis | null> {
  const supabase = createResearchSupabase();
  const { data: share, error } = await supabase
    .from("synthesis_shares")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    // Surface transient PostgREST/network failures in the log instead of
    // swallowing them as "no such share". Token stays out of the log (it's a
    // capability credential) — only the error message is emitted.
    console.error("[getSharedSynthesis] share lookup failed:", error.message);
    return null;
  }
  if (!share) return null;
  if (share.revoked) return null;
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return null;
  }

  const synthesis = await getStudySynthesis(share.org_id, share.plan_id);
  if (!synthesis || synthesis.synthesized_at === null) return null;

  const plan = await getResearchPlan(share.org_id, share.plan_id);

  const showQuotes = share.show_quotes;
  const emergentThemes: SharedSynthesisTheme[] = synthesis.emergent_themes.map(
    (theme) => ({
      title: theme.title,
      summary: theme.summary,
      frequency: theme.frequency,
      quotes: showQuotes ? theme.quotes : [],
    }),
  );
  const tensions: SharedSynthesisTension[] = synthesis.tensions.map(
    (tension) => ({
      description: tension.description,
      sideA: {
        label: tension.side_a.label,
        quotes: showQuotes ? tension.side_a.quotes : [],
      },
      sideB: {
        label: tension.side_b.label,
        quotes: showQuotes ? tension.side_b.quotes : [],
      },
    }),
  );

  return {
    planTitle: plan?.title ?? "",
    overview: synthesis.overview,
    emergentThemes,
    tensions,
    basedOnCount: synthesis.based_on_count,
    language: share.language,
    showQuotes,
    synthesizedAt: synthesis.synthesized_at,
  };
}
