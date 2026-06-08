"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ParticipantShell } from "./ParticipantShell";

/**
 * Friendly white-label terminal screen for an open link the participant can't
 * enter (Phase 4, Baustein 2 — Etappe 3 expiry/no-screening; Etappe 5 capacity).
 *
 * Two variants, same calm white-label shell:
 *   "unavailable" (default) → expired / no-screening / no longer accepting
 *                             (E3, render-only courtesy: the page reads the link
 *                             row's valid_until to show this instead of a
 *                             screening form for a dead study).
 *   "full"                  → the max_sessions cap is reached (E5). Render-only
 *                             here too — the authoritative denial is server-side
 *                             in POST /api/interview/open/[token]/screen, which
 *                             counts BEFORE the Opus turn. No session is created
 *                             on this page in either case.
 *
 * The default ("unavailable") keeps the E3 callers byte-identical.
 */
export function OpenLinkUnavailable({
  variant = "unavailable",
  brandName = null,
  accentColor = null,
  logoUrl = null,
  redirectUrl = null,
}: {
  variant?: "unavailable" | "full";
  brandName?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  /** Panel-Anbieter E2: wenn gesetzt (nur „full" + Panel-Eintritt mit QuotaFull-
   *  Template), wird der Teilnehmer beim Mount zur Anbieter-Return-URL geleitet —
   *  der Screen ist dann nur ein kurzer Fallback, falls die Navigation scheitert.
   *  Null (Nicht-Panel / kein Template) → reiner Screen, byte-identisch. Server-
   *  seitig auf eine sichere http(s)-URL validiert (buildPanelRedirectUrl). */
  redirectUrl?: string | null;
}) {
  const t = useTranslations("interview");
  const base = variant === "full" ? "open.full" : "open.unavailable";
  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);
  return (
    <ParticipantShell
      brandless
      brandName={brandName}
      accentColor={accentColor}
      logoUrl={logoUrl}
    >
      <div className="mb-10 mt-8 rounded-2xl border border-[#DCDEEF] bg-[#FAFAFE] px-6 py-10 text-center">
        <h1 className="text-[18px] font-semibold text-[#221F2A]">
          {t(`${base}.title`)}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#6B6678]">
          {t(`${base}.body`)}
        </p>
      </div>
    </ParticipantShell>
  );
}
