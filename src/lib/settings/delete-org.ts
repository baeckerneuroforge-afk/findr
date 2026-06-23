import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { validateDeleteConfirmation } from "./roles";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

/**
 * Storage buckets whose objects live under an `${orgId}/…` key prefix
 * (research stimulus uploads under `${orgId}/${planId}/…`, white-label logos
 * under `${orgId}/…`). Deleting an org removes every object beneath that prefix
 * BEFORE the owning DB row is gone. A bucket not provisioned in a given
 * environment (e.g. `org-branding`, defined by a migration not applied to every
 * baseline) is detected via listBuckets() and skipped — a genuinely-absent
 * bucket is NOT an error. A real list/remove failure on an EXISTING bucket
 * propagates (fail-closed), so the DB row is never deleted while its files might
 * still be stranded (Art. 17 DSGVO).
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
    // Fail-closed: a real list error must abort the whole deletion — treating it
    // as "no objects" could strand files once the owning DB row is gone. (The
    // caller only lists buckets it confirmed exist, so this is never a
    // missing-bucket case.)
    if (error) {
      throw new Error(
        `org-delete storage wipe: list failed for bucket "${bucket}" (depth ${depth}): ${error.message}`,
      );
    }
    if (!data || data.length === 0) break;

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

/**
 * Remove every storage object owned by the org — FAIL-CLOSED. A real list/remove
 * failure (or an inability to enumerate buckets) throws, so the caller aborts
 * BEFORE the DB delete and never strands files whose owning row is already gone
 * (Art. 17). Only a bucket that genuinely does not exist in this environment is
 * skipped, decided via listBuckets() instead of by swallowing errors. Returns
 * the number of objects removed.
 */
async function deleteOrgStorage(
  supabase: AdminClient,
  orgId: string,
): Promise<number> {
  // Which org-scoped buckets actually exist here? A bucket whose migration was
  // never applied to this baseline simply isn't listed → skipped, without
  // masking a real failure as "nothing to delete".
  const { data: buckets, error: bucketsError } =
    await supabase.storage.listBuckets();
  if (bucketsError) {
    throw new Error(
      `org-delete storage wipe: could not list buckets: ${bucketsError.message}`,
    );
  }
  const present = new Set<string>();
  for (const b of buckets ?? []) {
    present.add(b.name);
    present.add(b.id);
  }

  let removed = 0;
  for (const bucket of ORG_PREFIXED_BUCKETS) {
    // Genuinely absent in this environment → nothing to wipe (NOT an error).
    // Any failure on an EXISTING bucket propagates below and aborts the delete.
    if (!present.has(bucket)) continue;

    const keys = await listObjectKeys(supabase, bucket, orgId);
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      const { error } = await supabase.storage.from(bucket).remove(chunk);
      if (error) {
        throw new Error(
          `org-delete storage wipe: failed to remove ${chunk.length} object(s) from bucket "${bucket}": ${error.message}`,
        );
      }
      removed += chunk.length;
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

  // 1) Storage first, FAIL-CLOSED — removing files before the owning DB row
  //    means a later failure can't strand objects whose org is already gone.
  //    deleteOrgStorage THROWS on a real list/remove failure, so a storage error
  //    aborts here and the DB delete (step 2) never runs (Art. 17: no orphaned
  //    objects once the owning row is gone). A genuinely-absent bucket is skipped.
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
