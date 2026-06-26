import { toBcp47 } from "@/i18n/locale";

/**
 * Shared date helpers for the Kalender/Scheduler UI (panel + widget + agenda).
 *
 * Timezone policy (Phase 1): activation times are stored as ISO-UTC. INPUT is
 * browser-local (a native <input type="datetime-local"> → new Date(value) →
 * toISOString()). DISPLAY + day-bucketing use a FIXED display zone
 * (Europe/Berlin) via Intl, deliberately NOT setHours() — that server-side
 * approach has a known UTC-vs-Berlin bug (see scheduling.ts proposeSlots). An
 * org-configurable timezone is Phase 3. Relative time ("in 3 Std") is computed
 * from the instant difference, which is timezone-independent and always correct.
 */

export const DISPLAY_TZ = "Europe/Berlin";

/**
 * ISO → the value a <input type="datetime-local"> expects: "YYYY-MM-DDTHH:mm" in
 * the BROWSER's local wall-clock. Client-only (uses the browser tz offset).
 */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Absolute date + time, formatted in the fixed display zone. */
export function formatActivationDateTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(toBcp47(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TZ,
  }).format(d);
}

/** Time-of-day only (e.g. "14:00"), in the fixed display zone. */
export function formatActivationTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(toBcp47(locale), {
    timeStyle: "short",
    timeZone: DISPLAY_TZ,
  }).format(d);
}

/** Weekday + day, e.g. "Mi, 24. Juli" — the agenda section sublabel. */
export function formatActivationDay(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(toBcp47(locale), {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: DISPLAY_TZ,
  }).format(d);
}

/** "YYYY-MM-DD" in the display zone — the stable key for day bucketing and for
 *  matching a scheduled instant to a calendar cell in the month grid. */
export function displayDayKey(ms: number): string {
  // en-CA renders ISO-like YYYY-MM-DD; the display zone fixes the day boundary.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: DISPLAY_TZ,
  }).format(new Date(ms));
}

export type ActivationBucket =
  | "past"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "later";

/**
 * Which agenda section a scheduled time belongs to, relative to NOW. Day
 * boundaries are evaluated in the display zone (so "today" means today in
 * Berlin), while "this week" uses the 7-day instant window — both stable.
 *
 * `nowMs` defaults to the current instant (read here in this plain util, not in
 * a component render body, so callers stay pure for the react-hooks/purity lint).
 * Client components pass an explicit nowMs (from a server-provided prop) to keep
 * SSR and hydration identical.
 */
export function activationBucket(
  iso: string,
  nowMs: number = Date.now(),
): ActivationBucket {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "later";
  if (t < nowMs) return "past";
  const todayKey = displayDayKey(nowMs);
  const tomorrowKey = displayDayKey(nowMs + 86_400_000);
  const thatKey = displayDayKey(t);
  if (thatKey === todayKey) return "today";
  if (thatKey === tomorrowKey) return "tomorrow";
  if (t < nowMs + 7 * 86_400_000) return "thisWeek";
  return "later";
}

/**
 * "in 3 Std" / "in 2 Tagen" / "vor 5 Min". Computed from the instant difference
 * to `nowMs` (default: current instant), so it is timezone-independent.
 * numeric:"auto" yields "morgen"/"tomorrow" etc. Client components pass an
 * explicit nowMs (server-provided prop) for hydration-stable output.
 */
export function relativeActivation(
  iso: string,
  locale: string,
  nowMs: number = Date.now(),
): string {
  const ms = new Date(iso).getTime() - nowMs;
  if (Number.isNaN(ms)) return "";
  const rtf = new Intl.RelativeTimeFormat(toBcp47(locale), { numeric: "auto" });
  const minutes = Math.round(ms / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(ms / 3_600_000);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  const days = Math.round(ms / 86_400_000);
  return rtf.format(days, "day");
}

/** Current instant as an ISO string. A plain util (not a component body) so a
 *  server component can read "now" once and hand it to a client calendar as a
 *  prop without tripping the react-hooks/purity lint or causing hydration drift. */
export function currentIso(): string {
  return new Date().toISOString();
}
