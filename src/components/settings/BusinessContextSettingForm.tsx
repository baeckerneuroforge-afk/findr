"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { hasAdminRole } from "@/lib/settings/roles";
import { BUSINESS_CONTEXT_MAX_CHARS } from "@/lib/settings/org-settings-shared";

/**
 * Org-Profil-Kontext (E3): einmalig gepflegter Unternehmens-/Produkt-Freitext,
 * mit dem der Studien-Wizard das Kontextfeld jeder neuen Studie prefillt.
 * Mirrors the BrandingSettingsForm pattern (admin-gated, GET on mount,
 * explicit save, neutral card styling). Saves via PUT
 * /api/settings/business-context; empty = unset (Wizard prefillt nichts).
 */
export function BusinessContextSettingForm() {
  const t = useTranslations("settings.businessContext");
  const { data: session } = useSession();
  const isAdmin = hasAdminRole(session?.user?.roles);

  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/business-context")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && typeof data?.businessContext === "string") {
          setValue(data.businessContext);
        }
      })
      .catch(() => {
        /* keep empty on read failure */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    if (!isAdmin || saving) return;
    setFeedback(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/business-context", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessContext: value.trim() || null }),
      });
      if (!res.ok) throw new Error("save failed");
      setFeedback(t("saved"));
    } catch {
      setFeedback(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  const disabled = !isAdmin || loading;

  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-5">
      <div className="mb-5">
        <h2 className="text-h2 text-neutral-900">{t("title")}</h2>
        <p className="mt-1 text-body text-neutral-500">{t("subtitle")}</p>
      </div>

      {!isAdmin && (
        <p className="mb-4 text-small text-neutral-500">{t("adminOnly")}</p>
      )}

      <label
        htmlFor="business-context"
        className="block text-body-strong text-neutral-900"
      >
        {t("label")}
      </label>
      <textarea
        id="business-context"
        rows={4}
        maxLength={BUSINESS_CONTEXT_MAX_CHARS}
        value={value}
        disabled={disabled || saving}
        placeholder={t("placeholder")}
        onChange={(e) => setValue(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-body text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
      />
      <p className="mt-1 text-caption text-neutral-500">{t("help")}</p>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={disabled || saving}
          className="rounded-md bg-primary-600 px-4 py-2 text-small font-medium text-white transition-colors hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {saving ? t("saving") : t("save")}
        </button>
        {feedback && (
          <span className="text-small text-neutral-500">{feedback}</span>
        )}
      </div>
    </div>
  );
}
