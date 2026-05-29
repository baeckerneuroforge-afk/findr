"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface AccountMaster {
  companyName: string;
  sponsorName: string | null;
  sponsorEmail: string | null;
  sponsorPhone: string | null;
  mrr: number | null;
  currency: "USD" | "EUR";
  renewalDate: string | null;
  notes: string | null;
}

interface AccountMasterCardProps {
  accountId: string;
  initial: AccountMaster;
}

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 disabled:opacity-60";

function formatMrr(mrr: number | null, currency: "USD" | "EUR"): string {
  if (mrr === null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(mrr);
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AccountMasterCard({ accountId, initial }: AccountMasterCardProps) {
  const router = useRouter();
  const t = useTranslations("health.detail");
  const tc = useTranslations("health.common");
  const [account, setAccount] = useState<AccountMaster>(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: initial.companyName,
    sponsorName: initial.sponsorName ?? "",
    sponsorEmail: initial.sponsorEmail ?? "",
    sponsorPhone: initial.sponsorPhone ?? "",
    mrr: initial.mrr === null ? "" : String(initial.mrr),
    currency: initial.currency,
    renewalDate: initial.renewalDate ?? "",
    notes: initial.notes ?? "",
  });

  function startEdit() {
    setForm({
      companyName: account.companyName,
      sponsorName: account.sponsorName ?? "",
      sponsorEmail: account.sponsorEmail ?? "",
      sponsorPhone: account.sponsorPhone ?? "",
      mrr: account.mrr === null ? "" : String(account.mrr),
      currency: account.currency,
      renewalDate: account.renewalDate ?? "",
      notes: account.notes ?? "",
    });
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (form.companyName.trim() === "") {
      setError(tc("errCompanyRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          sponsorName: form.sponsorName,
          sponsorEmail: form.sponsorEmail,
          sponsorPhone: form.sponsorPhone,
          mrr: form.mrr,
          currency: form.currency,
          renewalDate: form.renewalDate,
          notes: form.notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        account?: AccountMaster;
      };
      if (!res.ok || !data.account) {
        throw new Error(data.error ?? tc("errSaveAccount"));
      }
      setAccount({
        companyName: data.account.companyName,
        sponsorName: data.account.sponsorName,
        sponsorEmail: data.account.sponsorEmail,
        sponsorPhone: data.account.sponsorPhone,
        mrr: data.account.mrr,
        currency: data.account.currency,
        renewalDate: data.account.renewalDate,
        notes: data.account.notes,
      });
      setEditing(false);
      // Sync the server-rendered header / breadcrumb (company name).
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("errSaveAccount"));
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || pending;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-h2 text-neutral-900">{t("detailsTitle")}</h2>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={startEdit}>
            {tc("edit")}
          </Button>
        )}
      </CardHeader>
      <CardBody>
        {editing ? (
          <div className="space-y-4">
            <Field label={tc("fldCompany")}>
              <input
                className={INPUT_CLASS}
                value={form.companyName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, companyName: e.target.value }))
                }
                placeholder="Acme GmbH"
                disabled={disabled}
              />
            </Field>
            <Field label={tc("fldSponsorName")}>
              <input
                className={INPUT_CLASS}
                value={form.sponsorName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sponsorName: e.target.value }))
                }
                placeholder="Anna Berg"
                disabled={disabled}
              />
            </Field>
            <Field label={tc("fldSponsorEmail")}>
              <input
                className={INPUT_CLASS}
                type="email"
                value={form.sponsorEmail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sponsorEmail: e.target.value }))
                }
                placeholder="anna.berg@example.com"
                disabled={disabled}
              />
            </Field>
            <Field label={tc("fldSponsorPhone")}>
              <input
                className={INPUT_CLASS}
                value={form.sponsorPhone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sponsorPhone: e.target.value }))
                }
                placeholder="+49 151 23456789"
                disabled={disabled}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={tc("fldMrr")}>
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
                  disabled={disabled}
                />
              </Field>
              <Field label={tc("fldCurrency")}>
                <select
                  className={INPUT_CLASS}
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      currency: e.target.value === "USD" ? "USD" : "EUR",
                    }))
                  }
                  disabled={disabled}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
            </div>
            <Field label={tc("fldRenewalDate")}>
              <input
                className={INPUT_CLASS}
                type="date"
                value={form.renewalDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, renewalDate: e.target.value }))
                }
                disabled={disabled}
              />
            </Field>
            <Field label={tc("fldNotes")}>
              <textarea
                className={`${INPUT_CLASS} h-24 resize-y py-2`}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder={tc("phNotes")}
                disabled={disabled}
              />
            </Field>

            {error && (
              <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={disabled}>
                {saving ? tc("saving") : tc("save")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={disabled}
              >
                {tc("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <dl className="space-y-3">
            <Row label={t("rowCompany")} value={account.companyName} />
            <Row label={t("rowSponsor")} value={account.sponsorName} />
            <Row label={t("rowEmail")} value={account.sponsorEmail} kind="email" />
            <Row label={t("rowPhone")} value={account.sponsorPhone} kind="phone" />
            <Row label={t("rowMrr")} value={formatMrr(account.mrr, account.currency)} />
            <Row label={t("rowRenewal")} value={formatDate(account.renewalDate)} />
            <Row label={t("rowNotes")} value={account.notes} />
          </dl>
        )}
      </CardBody>
    </Card>
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

function Row({
  label,
  value,
  kind,
}: {
  label: string;
  value: string | null;
  kind?: "email" | "phone";
}) {
  const display = value && value.trim() !== "" ? value : "—";
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-body text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-body text-neutral-900">
        {display === "—" ? (
          <span className="text-neutral-400">—</span>
        ) : kind === "email" ? (
          <a
            href={`mailto:${value}`}
            className="text-primary-700 hover:underline"
          >
            {value}
          </a>
        ) : kind === "phone" ? (
          <a href={`tel:${value}`} className="text-primary-700 hover:underline">
            {value}
          </a>
        ) : (
          display
        )}
      </dd>
    </div>
  );
}

export default AccountMasterCard;
