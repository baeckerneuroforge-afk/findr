"use client";

import { useTranslations } from "next-intl";
import { ParticipantShell } from "./ParticipantShell";

/**
 * White-label Endbildschirm für einen GÜLTIGEN Teilnehmer-Link, dessen Studie
 * (noch) nicht teilnahmebereit ist — geteilt vom Invite- und vom Open-Link-Pfad.
 *
 *   "not_yet_active" → Studie ist Entwurf/geplant, aber noch nicht live
 *   "ended"          → Studie ist abgeschlossen oder archiviert/geschlossen
 *
 * Render-only: die autoritative Sperre sitzt server-seitig (Participation-Gate
 * im Resolver + am Session-Mint). Hier wird KEINE Session erzeugt. Mirror der
 * ruhigen Shell von OpenLinkUnavailable, eigener Message-Namespace
 * (interview.unavailable.*), damit der Invite-Pfad nicht den open.*-Namespace
 * mitschleppt.
 */
export function InterviewUnavailable({
  reason,
  brandName = null,
  accentColor = null,
  logoUrl = null,
}: {
  reason: "not_yet_active" | "ended";
  brandName?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
}) {
  const t = useTranslations("interview");
  const base =
    reason === "ended" ? "unavailable.ended" : "unavailable.notYetActive";
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
