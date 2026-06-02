/**
 * Shared hero background atmosphere — de-glassed in the Farbsystem pass.
 *
 * Previously a faint violet wash + a violet dot grid + one slow floating blur
 * blob ("Glas"). The blur blob and the violet wash are gone: the hero now sits
 * on the warm off-white canvas as a clear, calm surface. What remains is a very
 * faint NEUTRAL dot texture at the top (paper grain, not a violet glass field),
 * masked to fade out so a short hero's overflow-hidden clip lands invisibly.
 *
 * Purely presentational, fully static — nothing animates, so prefers-reduced-
 * motion is respected by construction. Drop this inside a hero <section> that is
 * `relative overflow-hidden`; it paints behind the content at -z-10.
 */
export function HeroAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Faint neutral dot texture, masked to fade out toward the bottom. Kept
          just perceptible (opacity 0.12) so text-only subpage heros — which no
          longer have a violet wash and may lack a product window — still read as
          an intentional, textured surface rather than an empty page. */}
      <div className="absolute inset-x-0 top-0 h-[440px] opacity-[0.12] [background-image:radial-gradient(var(--color-neutral-400)_1px,transparent_1.4px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
    </div>
  );
}
