"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Phase 2c — participant opt-in banner for the behavioural EVENTS tier
 * (integration plan L4/L7). Mirrors the screen-capture consent flow: on accept
 * it stamps the consent server-side (POST /consent {purposes:['events']}) and
 * AWAITS that stamp before telling the parent to start the collector, so the
 * /events route (which fail-closes on the events_consent_at stamp) cannot then
 * 403 every batch into the void. A failed/unreachable stamp keeps the banner in
 * place with a quiet retry hint; the participant is never blocked — declining
 * stays available and the interview runs on as a normal chat with no capture.
 * Renders nothing unless `show` is true.
 */
export function EventTrackingConsent({
  token,
  show,
  onDecision,
}: {
  token: string;
  show: boolean;
  onDecision: (decision: "granted" | "declined") => void;
}) {
  const t = useTranslations("interview");
  const [busy, setBusy] = useState(false);
  const [stampFailed, setStampFailed] = useState(false);

  if (!show) return null;

  const accept = async () => {
    setBusy(true);
    setStampFailed(false);
    // Await the consent stamp BEFORE arming the collector. The /events route
    // fail-closes on events_consent_at, so granting locally before the stamp
    // lands would make every batch 403 server-side ("events vanish"). The route
    // is fail-open and answers 204 even if the DB write fails, so this reliably
    // catches the network / bad-token (4xx) classes; a 2xx is taken as success.
    // On failure we stay pending and surface a quiet retry — never hang the flow
    // (declining is always available).
    try {
      const res = await fetch(`/api/interview/${token}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purposes: ["events"] }),
      });
      if (!res.ok) throw new Error(`consent stamp HTTP ${res.status}`);
      onDecision("granted");
    } catch {
      setStampFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className="mb-5 rounded-lg border border-[#E8E4F2] bg-[#FAFAFE] px-4 py-4">
      <h2 className="text-[14px] font-semibold text-[#0E0A1F]">
        {t("eventConsent.title")}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[#6B6680]">
        {t("eventConsent.body")}
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-[#8A85A0]">
        <a
          href="/datenschutz"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-[#0E0A1F]"
        >
          {t("eventConsent.privacyLink")}
        </a>
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void accept()}
          disabled={busy}
          className="h-[40px] rounded-lg bg-[var(--brand-accent)] px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("eventConsent.accept")}
        </button>
        <button
          type="button"
          onClick={() => onDecision("declined")}
          disabled={busy}
          className="h-[40px] rounded-lg border border-[#D9D4E8] bg-white px-4 text-[13px] font-medium text-[#0E0A1F] transition-colors hover:bg-[#F4F1FD] disabled:opacity-50"
        >
          {t("eventConsent.decline")}
        </button>
      </div>
      {stampFailed && (
        <p className="mt-3 text-[12px] leading-relaxed text-[#B4453C]">
          {t("eventConsent.stampError")}
        </p>
      )}
    </div>
  );
}
