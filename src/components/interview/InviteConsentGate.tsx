"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ParticipantShell } from "./ParticipantShell";

/**
 * E0 Recht & Offenlegung — Consent-/KI-Offenlegungs-Gate für den INVITE-Pfad:
 * die Parität zum mandatory ConsentStep des Open-Link-Pfads (OpenLinkEntry).
 * Vor diesem Gate hatte der Invite-Pfad KEINEN Consent-Schritt; die explizite
 * KI-Offenlegung (Art. 50(1) KI-VO, Pflicht ab 02.08.2026) steht im intro-Text
 * und damit VOR der ersten Interaktion mit dem KI-System — das Opening streamt
 * erst, nachdem dieses Gate passiert wurde (lazy via /stream bzw. Voice-Start).
 *
 * BEWUSST eine eigene Komponente statt einer Wiederverwendung aus OpenLinkEntry:
 * die beiden Eintrittspfade bleiben physisch getrennt (dieselbe Philosophie wie
 * ScreeningGate vs. OpenLinkEntry) — dieses Gate kennt keinen Open-Link-Endpoint.
 *
 * Zwei Betriebsarten:
 *   persist=true  — die Session EXISTIERT bereits (Session-Branch der Token-
 *                   Page). Accept → POST /api/interview/[token]/consent
 *                   (server-seitiger Zeitstempel, DSGVO-Art.-7(1)-Nachweis) →
 *                   children rendern. Der POST ist best-effort: schlägt er
 *                   fehl, rendern wir trotzdem — das Gate hat Offenlegung +
 *                   aktive Bestätigung bereits erzwungen, der Teilnehmer wird
 *                   nie ausgesperrt; der Fehler landet im Log (Client-Konsole,
 *                   server-seitig loggt die Route selbst).
 *   persist=false — needs_screening: es existiert NOCH KEINE Session-Row. Der
 *                   Consent reist als consentAccepted-Flag im screen-POST mit
 *                   (ScreeningGate-Prop) und wird bei Session-Creation
 *                   gestempelt. Dieses Gate ist dann reines UI-Gate.
 */
export function InviteConsentGate({
  token,
  persist,
  brandName = null,
  accentColor = null,
  logoUrl = null,
  children,
}: {
  /** Session-/Invite-Access-Token — nur für persist=true wirklich genutzt. */
  token: string;
  /** true → Accept stempelt via POST /consent; false → reines UI-Gate. */
  persist: boolean;
  brandName?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  const t = useTranslations("interview");
  const [agreed, setAgreed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleAccept() {
    if (persist) {
      setSubmitting(true);
      try {
        // Leerer Body — die Route ignoriert ihn ohnehin (nichts Client-
        // Geliefertes wird persistiert, der Zeitstempel entsteht server-seitig).
        await fetch(`/api/interview/${token}/consent`, { method: "POST" });
      } catch (err) {
        // Best-effort (s. Komponenten-Kommentar): Kenntnisnahme ist erzwungen,
        // der Stempel darf den Teilnehmer nicht aussperren.
        console.warn("[consent] stamp request failed:", err);
      }
    }
    setAccepted(true);
  }

  if (accepted) return <>{children}</>;

  return (
    <ParticipantShell
      brandless
      brandName={brandName}
      accentColor={accentColor}
      logoUrl={logoUrl}
    >
      <div className="mb-10 mt-2">
        <h1 className="text-[18px] font-semibold text-[#221F2A]">
          {t("inviteConsent.title")}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B6678]">
          {t("inviteConsent.intro")}
        </p>

        <div className="mt-6 rounded-2xl border border-[#DCDEEF] bg-[#FAFAFE] px-5 py-5">
          <h2 className="text-[14px] font-semibold text-[#221F2A]">
            {t("inviteConsent.privacyTitle")}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B6678]">
            {t("inviteConsent.privacyBody")}
          </p>
        </div>

        <label className="mt-6 flex items-start gap-3 text-[14px] leading-relaxed text-[#221F2A]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-[3px] h-4 w-4 accent-[var(--brand-accent)]"
          />
          <span>{t("inviteConsent.agree")}</span>
        </label>

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={!agreed || submitting}
          className="mt-6 h-[46px] rounded-xl bg-[var(--brand-accent)] px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {t("inviteConsent.continue")}
        </button>
      </div>
    </ParticipantShell>
  );
}
