import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

/**
 * A GDPR data export: organization metadata plus every org-scoped table, keyed
 * by table name. The row collection is produced server-side by the
 * `export_organization_data` SQL function, which dynamically covers all 43+
 * tables (so it never silently omits a newly added one) and strips secret
 * material — OAuth/webhook tokens, encrypted panel credentials — uniformly by
 * column name. This replaced a hand-maintained per-table list that had frozen
 * at ~18 tables and was missing the entire research / CS / PD / panel / voice
 * surface.
 */
export interface KlymeoDataExport {
  exported_at: string;
  organization: Pick<
    OrganizationRow,
    "id" | "clerk_org_id" | "name" | "plan" | "created_at" | "updated_at"
  >;
  /** table_name → rows. Secret columns are already removed server-side. */
  data: Record<string, unknown[]>;
}

export async function buildDataExport(orgId: string): Promise<KlymeoDataExport> {
  const supabase = createAdminSupabaseClient();

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error || !organization) {
    throw error ?? new Error("Organization not found");
  }

  const { data: exported, error: rpcError } = await supabase.rpc(
    "export_organization_data",
    { p_org_id: orgId },
  );

  if (rpcError) throw rpcError;

  return {
    exported_at: new Date().toISOString(),
    organization: {
      id: organization.id,
      clerk_org_id: organization.clerk_org_id,
      name: organization.name,
      plan: organization.plan,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
    },
    data: (exported ?? {}) as Record<string, unknown[]>,
  };
}
