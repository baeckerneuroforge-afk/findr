"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface DataPrivacyPanelProps {
  isAdmin: boolean;
  organizationName: string;
  initialRetentionDays: number | null;
}

export function DataPrivacyPanel({
  isAdmin,
  organizationName,
  initialRetentionDays,
}: DataPrivacyPanelProps) {
  const t = useTranslations("settings");
  const [confirmationName, setConfirmationName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [retentionInput, setRetentionInput] = useState(
    initialRetentionDays === null ? "" : String(initialRetentionDays),
  );
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionMsg, setRetentionMsg] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/delete-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? t("data.deleteFailed"));
      }
      setMessage(t("data.deleted"));
      setConfirmationName("");
      // The org (and the active Clerk org) no longer exists — hard-redirect to
      // root so Clerk re-evaluates the now-missing org and routes the user back
      // into onboarding. Brief delay lets the confirmation render first.
      setTimeout(() => {
        window.location.assign("/");
      }, 1500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("data.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveRetention() {
    const trimmed = retentionInput.trim();
    const retentionDays = trimmed === "" ? null : Number(trimmed);
    if (
      retentionDays !== null &&
      (!Number.isInteger(retentionDays) ||
        retentionDays < 1 ||
        retentionDays > 3650)
    ) {
      setRetentionMsg(t("data.retentionInvalid"));
      return;
    }
    setSavingRetention(true);
    setRetentionMsg(null);

    try {
      const response = await fetch("/api/settings/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? t("data.retentionFailed"));
      }
      setRetentionMsg(t("data.retentionSaved"));
    } catch (err) {
      setRetentionMsg(
        err instanceof Error ? err.message : t("data.retentionFailed"),
      );
    } finally {
      setSavingRetention(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-h2 text-neutral-900">{t("data.exportHeading")}</h2>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          {t("data.exportDesc")}
        </p>
        <a
          href="/api/settings/export"
          className={`mt-5 inline-flex h-8 items-center justify-center rounded-md px-3 text-body-strong font-medium transition-colors ${
            isAdmin
              ? "bg-primary-600 text-white hover:bg-primary-700"
              : "pointer-events-none bg-neutral-100 text-neutral-400"
          }`}
          aria-disabled={!isAdmin}
        >
          {t("data.exportButton")}
        </a>
        {!isAdmin && (
          <p className="mt-2 text-small text-neutral-500">
            {t("data.exportAdminOnly")}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-h2 text-neutral-900">{t("data.gdprHeading")}</h2>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          {t("data.gdprBody")}
        </p>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-h2 text-neutral-900">
          {t("data.retentionHeading")}
        </h2>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          {t("data.retentionDesc")}
        </p>
        <div className="mt-5 flex max-w-md items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor="retention-days"
              className="mb-1.5 block text-body-strong text-neutral-900"
            >
              {t("data.retentionLabel")}
            </label>
            <input
              id="retention-days"
              type="number"
              min={1}
              max={3650}
              inputMode="numeric"
              placeholder={t("data.retentionOffPlaceholder")}
              value={retentionInput}
              onChange={(event) => setRetentionInput(event.target.value)}
              disabled={!isAdmin || savingRetention}
              className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors disabled:bg-neutral-50 disabled:text-neutral-500 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/10"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveRetention}
            disabled={!isAdmin || savingRetention}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingRetention
              ? t("data.retentionSaving")
              : t("data.retentionSave")}
          </button>
        </div>
        <p className="mt-2 max-w-2xl text-small text-neutral-500">
          {t("data.retentionHint")}
        </p>
        {retentionMsg && (
          <p className="mt-2 text-small text-neutral-500">{retentionMsg}</p>
        )}
        {!isAdmin && (
          <p className="mt-2 text-small text-neutral-500">
            {t("data.retentionAdminOnly")}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-danger-500/20 bg-white p-5">
        <h2 className="text-h2 text-danger-700">{t("data.deleteHeading")}</h2>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          {t("data.deleteDesc")}
        </p>

        <div className="mt-5 max-w-md">
          <label
            htmlFor="delete-confirmation"
            className="mb-1.5 block text-body-strong text-neutral-900"
          >
            {t("data.confirmLabel", { org: organizationName })}
          </label>
          <input
            id="delete-confirmation"
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
            disabled={!isAdmin || deleting}
            className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors disabled:bg-neutral-50 disabled:text-neutral-500 focus:border-danger-500 focus:ring-2 focus:ring-danger-500/10"
          />
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={!isAdmin || deleting || confirmationName !== organizationName}
          className="mt-4 inline-flex h-8 items-center justify-center rounded-md bg-danger-500 px-3 text-body-strong font-medium text-white transition-colors hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? t("data.deleting") : t("data.deleteButton")}
        </button>

        {message && <p className="mt-3 text-small text-neutral-500">{message}</p>}
        {!isAdmin && (
          <p className="mt-3 text-small text-neutral-500">
            {t("data.deleteAdminOnly")}
          </p>
        )}
      </section>
    </div>
  );
}
