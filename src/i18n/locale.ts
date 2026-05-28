/**
 * Canonical UI locale = the buyer-facing interview language. We deliberately
 * reuse InterviewLanguage instead of forking a second "de" | "en" union, so the
 * DB columns (interview_sessions.language / research_invites.language), the LLM
 * interviewer, the emails, and the UI chrome can never drift apart.
 */
import type { InterviewLanguage } from "@/lib/voice-agent/interviewer";

export type Locale = InterviewLanguage;

export const LOCALES: readonly Locale[] = ["de", "en"];

/**
 * Default UI locale when no cookie is set. "en" matches the pre-i18n root
 * <html lang="en"> and DEFAULT_INTERVIEW_LANGUAGE, so the (still-English)
 * dashboard chrome doesn't suddenly render as German before its own i18n
 * etappe lands. The participant flow + research emails resolve their locale
 * EXPLICITLY (from the session / invite), so they never depend on this default.
 */
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that carries the chosen UI locale across requests (set by a future
 *  switcher; read by src/i18n/request.ts). */
export const LOCALE_COOKIE = "findr.locale";

/** BCP-47 tags for locale-aware Intl.* formatting (dates, numbers). */
const BCP47: Record<Locale, string> = {
  de: "de-DE",
  en: "en-US",
};

export function toBcp47(locale: Locale): string {
  return BCP47[locale];
}

export function isLocale(value: unknown): value is Locale {
  return value === "de" || value === "en";
}
