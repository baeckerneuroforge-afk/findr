"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";
import { CopyInterviewLinkButton } from "@/components/dashboard/CopyInterviewLinkButton";

/**
 * Researcher-Verwaltung des EINEN offenen Studien-Links (Phase 4, Baustein 2,
 * Etappe 2). Self-contained wie PlanQuotaPanel / ScreeningQuestionsPanel:
 * lokaler Formular-State + fetch nach POST /api/research/plans/[id]/open-link +
 * router.refresh (die Server-Component liest getOpenLinkForPlan neu).
 *
 * Der offene Link ist EIN studienweites, öffentlich teilbares Credential für
 * beliebig viele anonyme Walk-ins — anders als der per-Invite-Link. Das Panel
 * deckt den Verwaltungs-Lebenszyklus ab: erzeugen (Token server-seitig gemünzt),
 * teilen (URL + Copy), widerrufen/reaktivieren (status-Toggle), und Cap/Ablauf/
 * Bezeichnung setzen. org_id/plan_id reisen NIE durch den Body (server-seitig
 * aus Clerk-Session + URL) — siehe Route.
 *
 * ── Screening-Leitplanke ─────────────────────────────────────────────────────
 * Offene Links setzen Screening voraus (entschiedene Architektur). Hat die
 * Studie KEINE Screening-Fragen, zeigt das Panel statt des Erzeugen-Buttons
 * einen klaren Hinweis. Das ist die UI-Leitplanke; das harte Erzwingen am
 * Eintritt kommt in E4. Existiert bereits ein Link, aber das Screening wurde
 * nachträglich entfernt, bleibt der Link verwaltbar (v. a. widerrufbar) + ein
 * Warnhinweis.
 */

export interface OpenLinkView {
  status: "active" | "disabled";
  maxSessions: number | null;
  validUntil: string | null;
  label: string | null;
}

// Spiegelt OPEN_LINK_DEFAULT_MAX_SESSIONS (open-links.ts, server-only — daher
// hier als Literal, nicht importiert). Nur der initiale Formularwert; die
// verbindliche Default-Logik lebt im Service.
const DEFAULT_MAX_SESSIONS = "100";

/** timestamptz (z. B. "2026-07-01T00:00:00+00:00") → YYYY-MM-DD fürs date-Input. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function OpenLinkPanel({
  planId,
  openLink,
  shareUrl,
  hasScreening,
  disabled = false,
}: {
  planId: string;
  openLink: OpenLinkView | null;
  /** Vorgebaute öffentliche URL ({base}/interview/open/{token}); null wenn kein Link. */
  shareUrl: string | null;
  hasScreening: boolean;
  /** Archivierte Studie → read-only. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");

  // Settings-Felder: aus dem Link vorbefüllt, sonst mit dem konservativen
  // Default-Cap (Erzeugen-Fall).
  const [maxSessions, setMaxSessions] = useState(
    openLink
      ? openLink.maxSessions == null
        ? ""
        : String(openLink.maxSessions)
      : DEFAULT_MAX_SESSIONS,
  );
  const [validUntil, setValidUntil] = useState(
    toDateInput(openLink?.validUntil ?? null),
  );
  const [label, setLabel] = useState(openLink?.label ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Felder → API-Body (oder Validierungsfehler). Leeres Max = unbegrenzt (null),
  // leeres Datum/Label = null.
  function readSettings():
    | { ok: true; body: { maxSessions: number | null; validUntil: string | null; label: string | null } }
    | { ok: false } {
    const trimmed = maxSessions.trim();
    let max: number | null;
    if (trimmed === "") {
      max = null;
    } else {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 1) {
        setError(t("errOpenLinkMax"));
        return { ok: false };
      }
      max = n;
    }
    return {
      ok: true,
      body: {
        maxSessions: max,
        validUntil: validUntil.trim() === "" ? null : validUntil.trim(),
        label: label.trim() === "" ? null : label.trim(),
      },
    };
  }

  async function post(
    payload: Record<string, unknown>,
    errKey: string,
  ): Promise<boolean> {
    setError(null);
    const res = await fetch(`/api/research/plans/${planId}/open-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      success?: boolean;
    };
    if (!res.ok || !data.success) {
      setError(data.error ?? t(errKey));
      return false;
    }
    return true;
  }

  async function handleCreate() {
    const s = readSettings();
    if (!s.ok) return;
    setSubmitting(true);
    try {
      if (await post({ action: "create", ...s.body }, "errOpenLinkCreate")) {
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    setSaved(false);
    const s = readSettings();
    if (!s.ok) return;
    setSubmitting(true);
    try {
      if (await post({ action: "update", ...s.body }, "errOpenLinkSave")) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle() {
    const next = openLink?.status === "active" ? "disabled" : "active";
    setSaved(false);
    setToggling(true);
    try {
      if (
        await post({ action: "set_status", status: next }, "errOpenLinkStatus")
      ) {
        router.refresh();
      }
    } finally {
      setToggling(false);
    }
  }

  // ── Settings-Felder (geteilt von Erzeugen- + Bearbeiten-Ansicht) ──────────
  const settingsFields = (
    <div className="flex flex-wrap items-end gap-4">
      <label className="block">
        <span className="mb-1.5 block text-small font-medium text-neutral-700">
          {t("fldOpenLinkMax")}
        </span>
        <input
          type="number"
          min={1}
          value={maxSessions}
          onChange={(e) => {
            setSaved(false);
            setMaxSessions(e.target.value);
          }}
          disabled={disabled || submitting}
          className={`${FIELD_INPUT_CLASS} w-32`}
        />
        <span className="mt-1 block text-caption text-neutral-500">
          {t("hintOpenLinkMax")}
        </span>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-small font-medium text-neutral-700">
          {t("fldOpenLinkValidUntil")}
        </span>
        <input
          type="date"
          value={validUntil}
          onChange={(e) => {
            setSaved(false);
            setValidUntil(e.target.value);
          }}
          disabled={disabled || submitting}
          className={`${FIELD_INPUT_CLASS} w-44`}
        />
        <span className="mt-1 block text-caption text-neutral-500">
          {t("hintOpenLinkValidUntil")}
        </span>
      </label>
      <label className="block grow">
        <span className="mb-1.5 block text-small font-medium text-neutral-700">
          {t("fldOpenLinkLabel")}
        </span>
        <input
          value={label}
          onChange={(e) => {
            setSaved(false);
            setLabel(e.target.value);
          }}
          placeholder={t("phOpenLinkLabel")}
          maxLength={120}
          disabled={disabled || submitting}
          className={FIELD_INPUT_CLASS}
        />
      </label>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  let inner: React.ReactNode;

  if (!openLink) {
    // Noch kein Link.
    if (!hasScreening) {
      // Screening-Leitplanke: KEIN Erzeugen ohne Screening.
      inner = (
        <p className="rounded-md border border-dashed border-warning-500/40 bg-warning-50 px-3 py-4 text-small text-warning-700">
          {t("openLinkScreeningRequired")}
        </p>
      );
    } else if (disabled) {
      inner = (
        <p className="text-small text-neutral-500">{t("openLinkEmpty")}</p>
      );
    } else {
      inner = (
        <div className="space-y-4">
          <p className="text-small text-neutral-600">{t("openLinkCreateHint")}</p>
          {settingsFields}
          <Button type="button" onClick={handleCreate} disabled={submitting}>
            {submitting ? tc("saving") : t("openLinkCreate")}
          </Button>
        </div>
      );
    }
  } else {
    const isActive = openLink.status === "active";
    inner = (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={isActive ? "success" : "default"}>
            {isActive ? t("openLinkStatusActive") : t("openLinkStatusDisabled")}
          </Badge>
          {openLink.label && (
            <span className="text-small text-neutral-600">{openLink.label}</span>
          )}
        </div>

        {/* Teilbare URL + Copy. Copy nur bei aktivem Link (ein widerrufener Link
            ist tot — findOpenLinkByAccessToken ist fail-closed auf active). */}
        <div className="space-y-1.5">
          <span className="block text-small font-medium text-neutral-700">
            {t("openLinkUrlLabel")}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 grow truncate rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-caption text-neutral-700">
              {shareUrl}
            </code>
            <CopyInterviewLinkButton link={isActive ? shareUrl : null} />
          </div>
          {!isActive && (
            <p className="text-caption text-neutral-500">
              {t("openLinkRevokedNote")}
            </p>
          )}
        </div>

        {!hasScreening && (
          <p className="rounded-md border border-dashed border-warning-500/40 bg-warning-50 px-3 py-2 text-caption text-warning-700">
            {t("openLinkScreeningWarn")}
          </p>
        )}

        {/* Cap / Ablauf / Bezeichnung */}
        <div className="space-y-3 border-t border-neutral-100 pt-4">
          {settingsFields}
          {!disabled && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleSave}
                disabled={submitting}
              >
                {submitting ? tc("saving") : t("openLinkSave")}
              </Button>
              {saved && (
                <span className="text-small text-success-700">
                  {t("openLinkSaved")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Kill-Switch / Widerruf bzw. Reaktivieren */}
        {!disabled && (
          <div className="border-t border-neutral-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling
                ? tc("saving")
                : isActive
                  ? t("openLinkDisable")
                  : t("openLinkEnable")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {inner}
      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}
    </div>
  );
}
