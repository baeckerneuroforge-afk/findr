"use client";

import { useTranslations } from "next-intl";
import { ParticipantShell } from "./ParticipantShell";

/**
 * Friendly white-label "study not available" screen for an open link whose
 * valid_until has passed (Phase 4, Baustein 2 — Etappe 3, RENDER ONLY).
 *
 * Render-only courtesy: the E1 resolver deliberately does NOT enforce
 * valid_until and the interview engine is untouched — the page reads the link
 * row's valid_until purely to show this calmer screen instead of a screening
 * form for a dead study. No session is created here; real expiry enforcement at
 * session-create time is E4/E5.
 */
export function OpenLinkUnavailable({
  brandName = null,
  accentColor = null,
  logoUrl = null,
}: {
  brandName?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
}) {
  const t = useTranslations("interview");
  return (
    <ParticipantShell
      brandless
      brandName={brandName}
      accentColor={accentColor}
      logoUrl={logoUrl}
    >
      <div className="mb-10 mt-8 rounded-2xl border border-[#E8E4F2] bg-[#FAFAFE] px-6 py-10 text-center">
        <h1 className="text-[18px] font-semibold text-[#0E0A1F]">
          {t("open.unavailable.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#6B6680]">
          {t("open.unavailable.body")}
        </p>
      </div>
    </ParticipantShell>
  );
}
