"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ACCOUNT_STATUSES, type AccountStatus } from "@/lib/accounts/types";
import { ACCOUNT_STATUS_META } from "@/lib/accounts/status";

export interface ConvertibleDeal {
  id: string;
  name: string;
  companyName: string;
}

interface AccountsToolbarProps {
  convertibleDeals: ConvertibleDeal[];
}

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 disabled:opacity-60";

const EMPTY_FORM = {
  companyName: "",
  sponsorName: "",
  sponsorEmail: "",
  sponsorPhone: "",
  mrr: "",
  currency: "EUR" as "USD" | "EUR",
  renewalDate: "",
  status: "active" as AccountStatus,
  notes: "",
};

export function AccountsToolbar({ convertibleDeals }: AccountsToolbarProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDeal, setSelectedDeal] = useState(
    convertibleDeals[0]?.id ?? "",
  );
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  async function createAccount() {
    if (form.companyName.trim() === "") {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        account?: { id: string };
      };
      if (!res.ok || !data.account) {
        throw new Error(data.error ?? "Could not create account.");
      }
      setForm(EMPTY_FORM);
      setAdding(false);
      router.push(`/dashboard/accounts/${data.account.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setSaving(false);
    }
  }

  async function convertDeal() {
    if (!selectedDeal || converting) return;
    setConverting(true);
    setConvertError(null);
    try {
      const res = await fetch("/api/accounts/from-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: selectedDeal }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        account?: { id: string };
      };
      if (!res.ok || !data.account) {
        throw new Error(data.error ?? "Could not create account from deal.");
      }
      router.push(`/dashboard/accounts/${data.account.id}`);
    } catch (err) {
      setConvertError(
        err instanceof Error ? err.message : "Could not create account.",
      );
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setAdding((v) => !v)}>
          {adding ? "Close" : "Add account"}
        </Button>

        {convertibleDeals.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-small text-neutral-500">
              or from a won deal:
            </span>
            <select
              className={`${INPUT_CLASS} w-auto min-w-56`}
              value={selectedDeal}
              onChange={(e) => setSelectedDeal(e.target.value)}
              disabled={converting}
            >
              {convertibleDeals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.companyName} — {deal.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={convertDeal}
              disabled={converting || !selectedDeal}
            >
              {converting ? "Creating…" : "Create account"}
            </Button>
          </div>
        )}
      </div>

      {convertError && (
        <p className="text-small text-danger-700">{convertError}</p>
      )}

      {adding && (
        <Card>
          <CardHeader>
            <h2 className="text-h2 text-neutral-900">New account</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <Field label="Company *">
                <input
                  className={INPUT_CLASS}
                  value={form.companyName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, companyName: e.target.value }))
                  }
                  placeholder="Acme GmbH"
                  disabled={saving}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Sponsor name">
                  <input
                    className={INPUT_CLASS}
                    value={form.sponsorName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sponsorName: e.target.value }))
                    }
                    placeholder="Anna Berg"
                    disabled={saving}
                  />
                </Field>
                <Field label="Sponsor email">
                  <input
                    className={INPUT_CLASS}
                    type="email"
                    value={form.sponsorEmail}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sponsorEmail: e.target.value }))
                    }
                    placeholder="anna.berg@example.com"
                    disabled={saving}
                  />
                </Field>
                <Field label="Sponsor phone">
                  <input
                    className={INPUT_CLASS}
                    value={form.sponsorPhone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sponsorPhone: e.target.value }))
                    }
                    placeholder="+49 151 23456789"
                    disabled={saving}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <Field label="MRR">
                  <input
                    className={INPUT_CLASS}
                    type="number"
                    min="0"
                    step="1"
                    value={form.mrr}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, mrr: e.target.value }))
                    }
                    placeholder="2500"
                    disabled={saving}
                  />
                </Field>
                <Field label="Currency">
                  <select
                    className={INPUT_CLASS}
                    value={form.currency}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        currency: e.target.value === "USD" ? "USD" : "EUR",
                      }))
                    }
                    disabled={saving}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
                <Field label="Renewal date">
                  <input
                    className={INPUT_CLASS}
                    type="date"
                    value={form.renewalDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, renewalDate: e.target.value }))
                    }
                    disabled={saving}
                  />
                </Field>
                <Field label="Status">
                  <select
                    className={INPUT_CLASS}
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as AccountStatus,
                      }))
                    }
                    disabled={saving}
                  >
                    {ACCOUNT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ACCOUNT_STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Notes">
                <textarea
                  className={`${INPUT_CLASS} h-24 resize-y py-2`}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Internal notes about this account…"
                  disabled={saving}
                />
              </Field>

              {error && (
                <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button onClick={createAccount} disabled={saving}>
                  {saving ? "Creating…" : "Create account"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setAdding(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-body-strong text-neutral-900">
        {label}
      </span>
      {children}
    </label>
  );
}

export default AccountsToolbar;
