"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { isLocale, type Locale } from "@/i18n/locale";
import type { SynthesisShareLink } from "@/lib/synthesis/share-service";

/**
 * Org-internal management UI for public synthesis share links. ADDITIVE — it
 * renders only when a populated synthesis exists (the parent gates this) and
 * drives the EXISTING /api/research/plans/[id]/share endpoint:
 *
 *   POST   { showQuotes, language } → create  (returns { share, path })
 *   DELETE { shareId }             → revoke
 *
 * It builds NO data path of its own: the initial list is server-rendered via
 * listSynthesisShares() and handed in; create/revoke just mutate local state
 * from the API responses. All server-side DSGVO filtering (verbatim quotes
 * dropped unless opted in, sourceInsightIds never exposed) lives in
 * share-service.ts — this UI only surfaces the show_quotes opt-in, DEFAULT OFF,
 * so the researcher decides consciously before any quote can appear in a link.
 *
 * Type-only import of SynthesisShareLink from the server-only share-service is
 * erased at build time, so no server code leaks into this client bundle.
 *
 * `baseUrl` is resolved server-side (canonical appBaseUrl(), the same source the
 * invite emails use) and handed in, so links are absolute without ever touching
 * window — no SSR/hydration seam, no client-only origin guess.
 */

interface SynthesisShareManagerProps {
  planId: string;
  initialShares: SynthesisShareLink[];
  baseUrl: string;
}

export function SynthesisShareManager({
  planId,
  initialShares,
  baseUrl,
}: SynthesisShareManagerProps) {
  const t = useTranslations("sharedSynthesis.manage");
  const uiLocale = useLocale();

  const [shares, setShares] = useState<SynthesisShareLink[]>(initialShares);
  const [showQuotes, setShowQuotes] = useState(false);
  const [language, setLanguage] = useState<Locale>(
    isLocale(uiLocale) ? uiLocale : "de",
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function urlFor(token: string): string {
    return `${baseUrl}/shared/synthesis/${token}`;
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showQuotes, language }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        share?: SynthesisShareLink;
        error?: string;
      };
      if (!res.ok || !data.share) {
        setCreateError(data.error ?? t("createError"));
        console.error(
          `Share create failed for plan ${planId}:`,
          data.error ?? res.status,
        );
        return;
      }
      setShares((prev) => [data.share as SynthesisShareLink, ...prev]);
    } catch (err) {
      setCreateError(t("createError"));
      console.error(`Share create failed for plan ${planId}:`, err);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(shareId: string) {
    setRevokingId(shareId);
    setRevokeError(null);
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/share`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareId }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRevokeError(data.error ?? t("revokeError"));
        console.error(
          `Share revoke failed for plan ${planId}:`,
          data.error ?? res.status,
        );
        return;
      }
      setShares((prev) =>
        prev.map((s) => (s.id === shareId ? { ...s, revoked: true } : s)),
      );
    } catch (err) {
      setRevokeError(t("revokeError"));
      console.error(`Share revoke failed for plan ${planId}:`, err);
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopy(token: string, shareId: string) {
    try {
      await navigator.clipboard.writeText(urlFor(token));
      setCopiedId(shareId);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard blocked (insecure context / denied permission) — no-op; the
      // URL stays visible and selectable in the row regardless.
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-h3 text-neutral-900">{t("heading")}</h2>
        <p className="mt-1 text-small text-neutral-500">{t("description")}</p>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Create form */}
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={showQuotes}
              onChange={(e) => setShowQuotes(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span>
              <span className="text-small font-medium text-neutral-900">
                {t("showQuotesLabel")}
              </span>
              <span className="block text-caption text-neutral-500">
                {t("showQuotesHelp")}
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-caption font-medium text-neutral-700">
                {t("languageLabel")}
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Locale)}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-small text-neutral-900 focus:border-primary-500 focus:outline-none"
              >
                <option value="de">{t("langDe")}</option>
                <option value="en">{t("langEn")}</option>
              </select>
            </label>

            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-small font-medium text-white transition-colors hover:border-primary-700 hover:bg-primary-700 disabled:opacity-50"
            >
              {creating ? t("creating") : t("create")}
            </button>
          </div>
          {createError && (
            <p className="text-caption text-danger-700">{createError}</p>
          )}
        </div>

        {/* Existing links */}
        <div className="space-y-3 border-t border-neutral-200 pt-5">
          <h3 className="text-small font-medium text-neutral-900">
            {t("existingHeading")}
          </h3>
          {shares.length === 0 ? (
            <p className="text-small text-neutral-500">{t("empty")}</p>
          ) : (
            <ul className="space-y-3">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="rounded-md border border-neutral-200 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ${
                        share.revoked
                          ? "bg-neutral-100 text-neutral-500"
                          : "bg-success-50 text-success-700"
                      }`}
                    >
                      {share.revoked
                        ? t("revokedBadge")
                        : share.language === "de"
                          ? t("langDe")
                          : t("langEn")}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-600">
                      {share.showQuotes
                        ? t("withQuotesBadge")
                        : t("withoutQuotesBadge")}
                    </span>
                  </div>
                  <p
                    className={`mt-2 break-all font-mono text-caption ${
                      share.revoked
                        ? "text-neutral-400 line-through"
                        : "text-neutral-700"
                    }`}
                  >
                    {urlFor(share.token)}
                  </p>
                  {!share.revoked && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(share.token, share.id)}
                        className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-caption font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
                      >
                        {copiedId === share.id ? t("copied") : t("copy")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(share.id)}
                        disabled={revokingId === share.id}
                        className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-caption font-medium text-danger-700 transition-colors hover:bg-danger-50 disabled:opacity-50"
                      >
                        {revokingId === share.id ? t("revoking") : t("revoke")}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {revokeError && (
            <p className="text-caption text-danger-700">{revokeError}</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
