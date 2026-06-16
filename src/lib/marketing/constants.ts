/**
 * Shared marketing-site constants.
 *
 * `DEMO_BOOKING_URL` is the external booking link the /demo page points its
 * "Termin buchen" button at. The site-wide "Demo buchen" CTAs (header, footer,
 * every page's CTASection) link to the internal /demo route — only /demo itself
 * hands off to this external scheduler.
 *
 * TODO D6: confirm the REAL demo-booking URL before going live. This value is
 * the placeholder carried over from the old comic landing
 * (landing-comic/constants.ts, removed in Etappe D) — André confirms the actual
 * Cal.com / Calendly link.
 */
export const DEMO_BOOKING_URL =
  process.env.NEXT_PUBLIC_DEMO_BOOKING_URL ?? "https://cal.com/findr/demo";
