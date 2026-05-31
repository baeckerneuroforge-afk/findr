/**
 * Shared white-label primitives for the participant-facing interview surface.
 * The original chrome lives inline in InterviewChat.tsx; these are the same
 * three constants extracted so the NEW screening/rejection screens
 * (ParticipantShell) render byte-identically branded without touching
 * InterviewChat. Kept tiny + dependency-free (used by client components).
 */

/** Default Findr accent — fallback when no org accent color is set. */
export const DEFAULT_ACCENT = "#5B2FD4";

/** Only ever apply a caller-supplied accent if it's a strict #RRGGBB hex. */
export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const FONT =
  "var(--font-inter), Inter, system-ui, -apple-system, sans-serif";

/** Resolve a caller accent to a safe value (guards against style injection). */
export function resolveAccent(accentColor?: string | null): string {
  return accentColor && HEX_COLOR.test(accentColor) ? accentColor : DEFAULT_ACCENT;
}
