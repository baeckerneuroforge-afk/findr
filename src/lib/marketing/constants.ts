/**
 * Shared marketing-site constants.
 *
 * `DEMO_BOOKING_URL` is the external Cal.com booking link. Every site-wide
 * "Demo buchen" CTA (header, mobile nav, footer, hero, each page's CTASection)
 * links straight to it, and the /demo page hands off to it as well — single
 * source of truth, so a changed booking URL only ever updates here.
 *
 * Override per environment via NEXT_PUBLIC_DEMO_BOOKING_URL; the fallback below
 * is the live production link. ⚠ If that env var is set on Vercel it WINS over
 * this fallback — keep it in sync (or unset it) so prod points at the same URL.
 */
export const DEMO_BOOKING_URL =
  process.env.NEXT_PUBLIC_DEMO_BOOKING_URL ?? "https://cal.eu/klymeoai/demo";
