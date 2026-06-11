import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { validateDeleteConfirmation } from "./roles";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

/**
 * Storage buckets whose objects live under an `${orgId}/…` key prefix
 * (research stimulus uploads, white-label logos). Deleting an org removes
 * every object beneath that prefix. A bucket that does not exist in a given
 * environment is tolerated — `org-branding`, for instance, is defined by a
 * migration that was never applied to the Prod baseline, so listing it simply
 * yields nothing.
 */
const ORG_PREFIXED_BUCKETS = ["research-stimuli", "org-branding"] as const;

export interface DeleteOrgResult {
  /** The organizations row — and every CASCADE child table — was deleted. */
  org_data_deleted: boolean;
  /**
   * The Clerk organization was deleted. `false` means the GDPR-critical data
   * is gone but the Clerk shell lingers (the data delete is the source of
   * truth; Clerk removal is retryable).
   */
  clerk_org_deleted: boolean;
  /** Total storage objects removed across all org-prefixed buckets. */
  storage_objects_removed: number;
}

/**
 * Recursively collect every object key beneath `prefix` in `bucket`. Supabase
 * Storage has no real directories — `list()` simulates them, returning folder
 * entries with a null `id`. We descend those and collect the leaf object keys.
 * Paginated (list() caps at 1000/page) and depth-guarded.
 */
async function listObjectKeys(
  supabase: AdminClient,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 8) return [];

  const keys: string[] = [];
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset });
    if (error || !data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A folder placeholder carries no id; a real object does.
      if (entry.id === null || entry.id === undefined) {
        keys.push(...(await listObjectKeys(supabase, bucket, path, depth + 1)));
      } else {
        keys.push(path);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return keys;
}

/** Best-effort removal of every storage object owned by the org. */
async function deleteOrgStorage(
  supabase: AdminClient,
  orgId: string,
): Promise<number> {
  let removed = 0;
  for (const bucket of ORG_PREFIXED_BUCKETS) {
    try {
      const keys = await listObjectKeys(supabase, bucket, orgId);
      for (let i = 0; i < keys.length; i += 100) {
        const chunk = keys.slice(i, i + 100);
        const { error } = await supabase.storage.from(bucket).remove(chunk);
        if (!error) removed += chunk.length;
      }
    } catch {
      // Missing bucket / transient storage error — skip. The DB delete below
      // is the source of truth for whether the org's data is gone.
    }
  }
  return removed;
}

/**
 * Permanently delete an organization: all data, all uploaded files, and the
 * Clerk organization itself (full account closure). User accounts survive but
 * lose access to this org.
 *
 * The data deletion runs in the `delete_organization_data` SQL function, which
 * deletes from every org_id-bearing table (plus the two org-less transcript
 * tables) and then the organizations row, all in one transaction. A plain
 * `delete from organizations` is NOT enough — four org_id tables (risk_scores,
 * alert_history, account_health_scores, product_discovery_insights) have no
 * CASCADE FK and would otherwise be orphaned. The function stays correct as new
 * tables are added, replacing the hand-maintained list that had frozen at 20 of
 * 43 tables.
 */
export async function deleteOrganizationData(params: {
  orgId: string;
  clerkOrgId: string;
  organizationName: string;
  confirmationName: string;
}): Promise<DeleteOrgResult> {
  if (
    !validateDeleteConfirmation(
      params.confirmationName,
      params.organizationName,
    )
  ) {
    throw new Error("Confirmation does not match organization name");
  }

  const supabase = createAdminSupabaseClient();

  // 1) Storage first — removing files before the owning DB row means a later
  //    failure can't strand objects whose org is already gone.
  const storageObjectsRemoved = await deleteOrgStorage(supabase, params.orgId);

  // 2) Delete all org data + the org row atomically via the SQL function —
  //    covers the org_id tables a plain cascade would miss, and any future one.
  const { error: deleteError } = await supabase.rpc(
    "delete_organization_data",
    { p_org_id: params.orgId },
  );
  if (deleteError) throw deleteError;

  // 3) Delete the Clerk organization. Done last: the GDPR-critical data is
  //    already gone, and if Clerk hiccups the admin still has access to retry.
  //    We report the outcome instead of throwing so a Clerk failure does not
  //    masquerade as "data not deleted".
  let clerkOrgDeleted = false;
  try {
    const client = await clerkClient();
    await client.organizations.deleteOrganization(params.clerkOrgId);
    clerkOrgDeleted = true;
  } catch (err) {
    console.error(
      `[delete-org] data deleted but Clerk org ${params.clerkOrgId} removal failed:`,
      err instanceof Error ? err.message : err,
    );
  }

  return {
    org_data_deleted: true,
    clerk_org_deleted: clerkOrgDeleted,
    storage_objects_removed: storageObjectsRemoved,
  };
}
