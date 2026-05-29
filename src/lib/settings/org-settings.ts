import "server-only";

import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * General per-org settings. Mirrors the slack_alert_preferences mechanic (one
 * row per org, upserted via the service-role client, org-scoped). Reads return
 * defaults when no row exists yet.
 */

export const OrgSettingsSchema = z.object({
  autoStartPostLossInterview: z.boolean().default(false),
});

export type OrgSettingsInput = z.infer<typeof OrgSettingsSchema>;

export interface OrgSettings {
  autoStartPostLossInterview: boolean;
  /** Product the check-in agent speaks about, in the org's name. Null = unset. */
  productName: string | null;
}

const DEFAULT_ORG_SETTINGS: OrgSettings = {
  autoStartPostLossInterview: false,
  productName: null,
};

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("org_settings")
    .select("auto_start_post_loss_interview, product_name")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) return DEFAULT_ORG_SETTINGS;
  return {
    autoStartPostLossInterview: data.auto_start_post_loss_interview,
    productName: data.product_name ?? null,
  };
}

export async function upsertOrgSettings(
  orgId: string,
  input: OrgSettingsInput,
): Promise<OrgSettings> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("org_settings")
    .upsert(
      {
        org_id: orgId,
        auto_start_post_loss_interview: input.autoStartPostLossInterview,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select("auto_start_post_loss_interview, product_name")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save org settings: ${error?.message ?? "no row returned"}`,
    );
  }
  return {
    autoStartPostLossInterview: data.auto_start_post_loss_interview,
    productName: data.product_name ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * White-label branding (Phase-4-Baustein)
 *
 * The customer's logo / accent color / brand name shown on the
 * participant- and stakeholder-facing surfaces (research interview page,
 * research invitation emails, synthesis export). Lives on org_settings
 * next to product_name. Read via getOrgBranding (single source,
 * service-role so the UNAUTHENTICATED interview page can resolve it by
 * org_id — exactly how company/language already flow through
 * getPublicSession), written via upsertOrgBranding from the admin UI.
 *
 * Deliberately a SEPARATE read/write path from getOrgSettings /
 * upsertOrgSettings: the latter always writes
 * auto_start_post_loss_interview, so folding branding in would risk
 * cross-wiping unrelated fields. Branding is additive and isolated — an
 * org with no branding set keeps the exact prior behavior.
 * ------------------------------------------------------------------ */

/** #RRGGBB only — mirrors the org_settings_accent_color_hex DB CHECK. */
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const OrgBrandingSchema = z.object({
  brandName: z
    .string()
    .trim()
    .max(80)
    .nullable()
    // Empty / whitespace-only → null (treated as "unset", neutral fallback).
    .transform((v) => (v && v.length > 0 ? v : null)),
  accentColor: z
    .string()
    .trim()
    .regex(HEX_COLOR, "accent_color must be a #RRGGBB hex value")
    .nullable(),
});

export type OrgBrandingInput = z.input<typeof OrgBrandingSchema>;

export interface OrgBranding {
  /** Customer brand name shown instead of the "findr" wordmark. Null = unset. */
  brandName: string | null;
  /** #RRGGBB accent. Null = use the default Findr accent (#5B2FD4). */
  accentColor: string | null;
  /** Public URL of the customer logo in the `org-branding` bucket. Null = none. */
  logoUrl: string | null;
}

const EMPTY_BRANDING: OrgBranding = {
  brandName: null,
  accentColor: null,
  logoUrl: null,
};

function toBranding(data: {
  brand_name: string | null;
  accent_color: string | null;
  logo_url: string | null;
}): OrgBranding {
  return {
    brandName: data.brand_name ?? null,
    accentColor: data.accent_color ?? null,
    logoUrl: data.logo_url ?? null,
  };
}

/**
 * Single source for an org's branding. Service-role read, so the
 * unauthenticated interview page can resolve it by org_id. Returns
 * all-null on any error or missing row → callers render the neutral
 * Findr default, nothing breaks.
 */
export async function getOrgBranding(orgId: string): Promise<OrgBranding> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("org_settings")
    .select("brand_name, accent_color, logo_url")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) return EMPTY_BRANDING;
  return toBranding(data);
}

/**
 * Write brand_name + accent_color (the form-editable fields). logo_url is
 * set separately by setOrgLogoUrl (the upload route owns the storage
 * object lifecycle). Upserts ONLY the branding columns, so it never
 * touches auto_start_post_loss_interview / product_name on an existing
 * row. Caller (the /api/settings/branding route) validates via
 * OrgBrandingSchema first; the DB CHECK is the backstop on accent_color.
 */
export async function upsertOrgBranding(
  orgId: string,
  input: OrgBrandingInput,
): Promise<OrgBranding> {
  const parsed = OrgBrandingSchema.parse(input);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("org_settings")
    .upsert(
      {
        org_id: orgId,
        brand_name: parsed.brandName,
        accent_color: parsed.accentColor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select("brand_name, accent_color, logo_url")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save org branding: ${error?.message ?? "no row returned"}`,
    );
  }
  return toBranding(data);
}

/** Persist just the logo URL (set after upload, cleared on remove). */
export async function setOrgLogoUrl(
  orgId: string,
  logoUrl: string | null,
): Promise<OrgBranding> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("org_settings")
    .upsert(
      {
        org_id: orgId,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    )
    .select("brand_name, accent_color, logo_url")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save org logo: ${error?.message ?? "no row returned"}`,
    );
  }
  return toBranding(data);
}
