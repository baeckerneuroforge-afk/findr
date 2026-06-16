/**
 * Pure capacity logic for open study links — extracted from open-links.ts (which
 * is `server-only`) so it can be unit-tested and so the hard ceiling can be
 * imported without pulling server dependencies.
 *
 * SAFETY MODEL: there is NO unlimited mode. An unset cap (max_sessions = null) —
 * and any explicit value above the ceiling — clamps to OPEN_LINK_HARD_CAP, so a
 * leaked or shared open link can NEVER mint unbounded sessions (each minted
 * session costs an opening model turn). This is the structural spend brake; a
 * per-request rate-limiter is complementary, not a substitute.
 */

/**
 * Absolute hard ceiling on the number of sessions ANY open link may ever mint,
 * however it is configured (including an unset cap). Tune in this one place.
 */
export const OPEN_LINK_HARD_CAP = 500;

/**
 * The effective, always-finite cap for a link: an unset (null) or over-ceiling
 * value is clamped to OPEN_LINK_HARD_CAP.
 */
export function effectiveOpenLinkCap(maxSessions: number | null): number {
  return Math.min(maxSessions ?? OPEN_LINK_HARD_CAP, OPEN_LINK_HARD_CAP);
}

/**
 * Is the link at/over its effective cap? `used = null` (a transient count error)
 * is treated as full — fail-closed, protecting spend — for the authoritative
 * server caller (the screen route). The render-only page evaluates fail-open
 * (see page.tsx).
 */
export function isOpenLinkAtCapacity(
  maxSessions: number | null,
  used: number | null,
): boolean {
  if (used === null) return true;
  return used >= effectiveOpenLinkCap(maxSessions);
}
