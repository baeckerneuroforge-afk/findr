/**
 * Shared hero background atmosphere — the restrained, reduced-motion-safe layer
 * that gives the homepage hero its depth: a faint violet top wash, a low-opacity
 * primary dot grid (masked to fade out), and one slow floating accent blur.
 *
 * Values mirror the homepage hero (src/app/(marketing)/page.tsx) VERBATIM so
 * every subpage hero inherits the exact same treatment — the homepage stays the
 * single visual reference (kept untouched). Drop this inside a hero <section>
 * that is `relative overflow-hidden`; it paints behind the content at -z-10.
 *
 * Only `opacity` + `transform` move (the float blur is GPU-composited). The
 * float is gated by `motion-safe:` / `motion-reduce:` so prefers-reduced-motion
 * renders it completely still — the wash + grid are static regardless.
 */
export function HeroAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Faint violet top wash. Both the colour gradient AND a fade mask reach
          0 toward the bottom, so a short hero's overflow-hidden clip lands where
          the wash has already faded out — no visible band edge. */}
      <div className="absolute inset-x-0 top-0 h-[460px] bg-gradient-to-b from-primary-50/70 to-transparent [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      {/* Low-opacity dot grid, masked to fade out toward the bottom. */}
      <div className="absolute inset-x-0 top-0 h-[520px] opacity-[0.13] [background-image:radial-gradient(var(--color-primary-300)_1px,transparent_1.4px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      {/* One slow floating accent (decorative). Reduced motion → fully still. */}
      <div className="absolute -right-24 -top-16 h-72 w-72 rounded-full bg-primary-200/30 blur-3xl motion-safe:animate-float motion-reduce:animate-none" />
    </div>
  );
}
