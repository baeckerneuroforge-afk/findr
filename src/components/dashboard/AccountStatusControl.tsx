"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ACCOUNT_STATUS_META } from "@/lib/accounts/status";
import { ACCOUNT_STATUSES, type AccountStatus } from "@/lib/accounts/types";

interface AccountStatusControlProps {
  accountId: string;
  initialStatus: AccountStatus;
}

export function AccountStatusControl({
  accountId,
  initialStatus,
}: AccountStatusControlProps) {
  const router = useRouter();
  const [status, setStatus] = useState<AccountStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function setTo(next: AccountStatus) {
    if (next === status || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update status.");
      setStatus(next);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  }

  const meta = ACCOUNT_STATUS_META[status];
  const transitions = ACCOUNT_STATUSES.filter((s) => s !== status);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge variant={meta.variant}>{meta.label}</Badge>
      {transitions.map((next) => (
        <Button
          key={next}
          size="sm"
          variant={next === "churned" ? "danger" : "secondary"}
          onClick={() => setTo(next)}
          disabled={busy || pending}
        >
          {`Mark ${ACCOUNT_STATUS_META[next].label.toLowerCase()}`}
        </Button>
      ))}
      {error && <span className="text-small text-danger-700">{error}</span>}
    </span>
  );
}

export default AccountStatusControl;
