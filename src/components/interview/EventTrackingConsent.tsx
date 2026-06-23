"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Phase 2c — participant opt-in banner for the behavioural EVENTS tier
 * (integration plan L4/L7). Mirrors the screen-capture consent flow: on accept
 * it stamps the consent server-side (POST /consent {purposes:['events']}) so the
 * /events route fail-closes on it, then tells the parent to start the collector.
 * Non-blocking: declining just leaves the interview as a normal chat with no
 * event capture. Renders nothing unless `show` is true. Styling deliberately
 * matches VisualCapturePanel so the two consent prompts read as one family.
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

  if (!show) return null;

  const accept = () => {
    setBusy(true);
    // Fire-and-forget: the server route is the authoritative gate. A failed
    // stamp simply 403s the later /events submit; the UI still proceeds.
    void fetch(`/api/interview/${token}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purposes: ["events"] }),
      keepalive: true,
    }).catch(() => {});
    onDecision("granted");
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
          onClick={accept}
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
    </div>
  );
}
