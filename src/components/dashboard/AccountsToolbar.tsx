"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ACCOUNT_STATUSES,
  ACCOUNT_VALUE_TYPES,
  type AccountStatus,
  type AccountValueType,
} from "@/lib/accounts/types";
import { accountValueTypeLabelKey } from "@/lib/accounts/value";

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
  valueType: "monthly" as AccountValueType,
  currency: "EUR" as "USD" | "EUR",
  renewalDate: "",
  status: "active" as AccountStatus,
  notes: "",
};

export function AccountsToolbar({ convertibleDeals }: AccountsToolbarProps) {
  const router = useRouter();
  const t = useTranslations("health.accounts");
  const tc = useTranslations("health.common");
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
      setError(tc("errCompanyRequired"));
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
        throw new Error(data.error ?? t("errCreate"));
      }
      setForm(EMPTY_FORM);
      setAdding(false);
      router.push(`/dashboard/accounts/${data.account.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errCreate"));
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
        throw new Error(data.error ?? t("errCreateFromDeal"));
      }
      router.push(`/dashboard/accounts/${data.account.id}`);
    } catch (err) {
      setConvertError(
        err instanceof Error ? err.message : t("errCreate"),
      );
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setAdding((v) => !v)}>
          {adding ? tc("close") : t("addAccount")}
        </Button>

        {convertibleDeals.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-small text-neutral-500">
              {t("orFromWonDeal")}
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
              {converting ? t("creating") : t("createAccount")}
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
            <h2 className="text-h2 text-neutral-900">{t("newAccount")}</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <Field label={tc("fldCompanyReq")}>
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
                <Field label={tc("fldSponsorName")}>
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
                <Field label={tc("fldSponsorEmail")}>
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
                <Field label={tc("fldSponsorPhone")}>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={tc("fldValue")}>
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
                <Field label={tc("fldValueType")}>
                  <select
                    className={INPUT_CLASS}
                    value={form.valueType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        valueType: e.target.value as AccountValueType,
                      }))
                    }
                    disabled={saving}
                  >
                    {ACCOUNT_VALUE_TYPES.map((vt) => (
                      <option key={vt} value={vt}>
                        {tc(accountValueTypeLabelKey(vt))}
                      </option>
                    ))}
                  </select>
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
                    disabled={saving}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={tc("fldRenewalDate")}>
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
                <Field label={tc("fldStatus")}>
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
                        {tc(`status.${s}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={tc("fldNotes")}>
                <textarea
                  className={`${INPUT_CLASS} h-24 resize-y py-2`}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder={tc("phNotes")}
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
                  {saving ? t("creating") : t("createAccount")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setAdding(false)}
                  disabled={saving}
                >
                  {tc("cancel")}
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
