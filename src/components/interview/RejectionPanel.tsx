"use client";

import { useTranslations } from "next-intl";

/**
 * Friendly, branded "not a fit this time" screen (Etappe 3 — render only).
 * No interview is mounted. `onRetry` is optional (retry is allowed per the
 * product decision); the gate wires it back to the screening step. The real
 * rejection trigger (a failed evaluateScreening) lands in E4 — here the panel
 * is reached via the gate's preview/step state for the white-label proof.
 */
export function RejectionPanel({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations("interview");
  return (
    <div className="mb-10 mt-8 rounded-2xl border border-[#E8E4F2] bg-[#FAFAFE] px-6 py-10 text-center">
      <h1 className="text-[18px] font-semibold text-[#0E0A1F]">
        {t("rejection.title")}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#6B6680]">
        {t("rejection.body")}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 text-[13px] font-medium text-[var(--brand-accent)] transition-opacity hover:opacity-80"
        >
          {t("rejection.retry")}
        </button>
      )}
    </div>
  );
}
