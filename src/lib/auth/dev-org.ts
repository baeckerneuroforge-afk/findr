/**
 * Dev-only org UUID. Lives in its own file (no "server-only" side-effect)
 * so seed scripts running under tsx can import it without blowing up.
 *
 * Must match the row seeded into `organizations` by the dev setup
 * (commit 7c0f5ab — "seed org_id").
 */
export const DEV_ORG_ID = "4909c8ee-017f-4d9a-bdb6-d3b90f0806a0";

export function getDevOrgId(): string {
  return DEV_ORG_ID;
}
