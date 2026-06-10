"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger offset in seconds (use index * step for card grids). */
  delay?: number;
  /** Initial vertical offset in px (slide up). Set 0 for a pure opacity fade. */
  y?: number;
  /** Initial horizontal offset in px (slide from left when positive). */
  x?: number;
  /**
   * Initial scale for a subtle "pop-in" (e.g. 0.92 → 1). Omit (default) for no
   * scale at all — every existing call site stays byte-identical because the
   * scale transform is only emitted when this prop is set.
   */
  scale?: number;
  className?: string;
};

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Scroll-reveal wrapper: fades + slides its children into view once, the first
 * time they cross into the viewport. Framer-frei seit Perf-Etappe C (Audit
 * 1.3): IntersectionObserver + CSS-Transition statt motion.div — der einzige
 * echte Animations-Nutzer auf Marketing zog sonst die volle framer-Engine
 * (~38 KB gz) in jedes Public-Bundle. Only `opacity` + `transform` animate
 * (GPU-friendly, no layout thrash). Props-API unverändert.
 *
 * Render-Strategie wie das Studio-Rv: das Server-HTML ist VOLL SICHTBAR
 * (no-JS/Bots/SEO sehen alles sofort — framer SSR-te vorher opacity:0 inline),
 * der versteckte Ausgangszustand wird erst nach dem Mount „armiert" und vom
 * Observer wieder aufgelöst. Elemente, die beim Armieren schon im Viewport
 * stehen, spielen ihr Reveal als Entrance-Animation in den nächsten Frames.
 *
 * prefers-reduced-motion ist der harte Aus-Schalter: es wird nie armiert,
 * nichts wird je versteckt, nichts bewegt sich — identisch zum alten
 * `initial: false`-Verhalten.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  x = 0,
  scale,
  className,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce || !("IntersectionObserver" in window)) return;

    // Armieren: in den versteckten Ausgangszustand schalten. Der erzwungene
    // Reflow (offsetHeight) committet diese Styles, BEVOR der Observer den
    // Zielzustand setzt — sonst würde ein bereits sichtbares Element beide
    // Zustände im selben Frame sehen und ohne Transition springen.
    const parts = [
      x !== 0 || y !== 0 ? `translate3d(${x}px, ${y}px, 0)` : "",
      scale !== undefined ? `scale(${scale})` : "",
    ].filter(Boolean);
    el.style.opacity = "0";
    if (parts.length > 0) el.style.transform = parts.join(" ");
    el.style.transition = `opacity 0.5s ${EASE} ${delay}s, transform 0.5s ${EASE} ${delay}s`;
    void el.offsetHeight;

    // Gleiche Sichtbarkeits-Schwelle wie framers viewport.margin "-80px".
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        el.style.opacity = "1";
        el.style.transform = "none";
        io.disconnect();
      },
      { rootMargin: "-80px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      // Unmount-/Re-Effekt-Hygiene: nie einen versteckten Zustand auf einem
      // wiederverwendeten DOM-Knoten zurücklassen.
      el.style.opacity = "";
      el.style.transform = "";
      el.style.transition = "";
    };
  }, [delay, x, y, scale]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
