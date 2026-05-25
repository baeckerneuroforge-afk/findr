import type { BadgeVariant } from "@/components/ui/Badge";
import type { AccountStatus } from "./types";

/**
 * Presentation for each account status, shared by the list, the status control,
 * and the detail header so the badge looks identical everywhere. Type-only
 * import of BadgeVariant — erased at build, so this stays a server-safe module.
 */
export const ACCOUNT_STATUS_META: Record<
  AccountStatus,
  { label: string; variant: BadgeVariant }
> = {
  active: { label: "Active", variant: "success" },
  at_risk: { label: "At risk", variant: "high" },
  churned: { label: "Churned", variant: "critical" },
};
