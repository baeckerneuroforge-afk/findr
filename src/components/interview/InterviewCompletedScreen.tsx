"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * Geteilter Abschluss-/Dank-Screen für BEIDE Teilnehmer-Flows (Text-Chat +
 * Voice). War zuvor in InterviewChat (CompletedPanel) und VoiceInterviewView
 * (inline im "done"-Zweig) byte-identisch dupliziert — eine Quelle, gleiche
 * i18n-Keys (interview.completed.*).
 *
 * Panel-Anbieter (E2): ist `redirectUrl` gesetzt, wird der Teilnehmer beim
 * Mount (= Interview abgeschlossen) zur Anbieter-Complete-URL geleitet; der
 * Dank-Screen ist dann nur ein kurzer Fallback, falls die Navigation scheitert.
 * Null → reiner Dank-Screen.
 */
export function InterviewCompletedScreen({
  redirectUrl = null,
}: {
  redirectUrl?: string | null;
}) {
  const t = useTranslations("interview");
  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);
  return (
    <div className="mb-10 mt-8 rounded-2xl border border-[#E8E4F2] bg-[#FAFAFE] px-6 py-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#2E9E6B] text-[18px] text-white">
        ✓
      </div>
      <h2 className="text-[18px] font-semibold text-[#0E0A1F]">
        {t("completed.title")}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#6B6680]">
        {t("completed.body")}
      </p>
    </div>
  );
}
