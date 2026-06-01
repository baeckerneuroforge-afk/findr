import "server-only";

/**
 * Whether an open link's optional valid_until has passed (Phase 4, Baustein 2 —
 * Etappe 3).
 *
 * Render-only courtesy used by the participant entry page to show the calmer
 * "study not available" screen instead of a screening form for a dead study. The
 * E1 resolver (findOpenLinkByAccessToken / resolvePublicOpenEntry) and the
 * interview engine intentionally do NOT enforce expiry — real enforcement at
 * session-create time is E4/E5. This is a deliberate, side-effect-free read of
 * the link row only.
 *
 * Lives in a plain module (NOT the page component) so the wall-clock read stays
 * out of React's render-purity scope (react-hooks/purity). null valid_until →
 * never expired (open-ended); an unparseable value → treated as NOT expired
 * (fail-open to the normal flow rather than hiding a live study).
 */
export function isOpenLinkExpired(validUntil: string | null): boolean {
  if (validUntil === null) return false;
  const ts = Date.parse(validUntil);
  return Number.isFinite(ts) && ts <= Date.now();
}
