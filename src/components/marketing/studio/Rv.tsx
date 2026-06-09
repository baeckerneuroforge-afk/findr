"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Studio-Scroll-Reveal: hängt einmalig die Klasse `in` an, sobald das Element
 * in den Viewport scrollt (IntersectionObserver). Das CSS in studio.css
 * definiert die eigentliche Choreografie (st-rv-Zeilenmasken, st-fade,
 * st-hl-Textmarker, st-bigstamp-Stempel) — versteckte Ausgangszustände greifen
 * nur unter `.studio-js` (Inline-Script im Marketing-Layout), no-JS sieht
 * alles sofort.
 *
 * prefers-reduced-motion ist der harte Aus-Schalter: `in` wird sofort gesetzt
 * (das CSS deaktiviert die Transitionen zusätzlich), nichts bewegt sich.
 */
export function Rv({
  as = "div",
  className = "",
  d = 0,
  threshold = 0.12,
  margin = "0px 0px -60px 0px",
  style,
  children,
}: {
  /** Element-Typ, z.B. "span" für st-hl-Marker in Fließtext. */
  as?: ElementType;
  className?: string;
  /** Stagger-Verzögerung in ms (wird als transition-delay gesetzt). */
  d?: number;
  threshold?: number;
  margin?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      el.classList.add("in");
      return;
    }
    // „Armieren“: erst NACH dem Mount in den versteckten Ausgangszustand
    // schalten (st-armed) — Server-HTML bleibt sichtbar (no-JS/Bots), React
    // sieht keinen className-Mismatch. Elemente, die beim Armieren schon im
    // Viewport stehen (Hero), feuert der IO direkt in der nächsten Frame —
    // ihr Reveal spielt als Entrance-Animation nach dem Laden.
    el.classList.add("st-armed");
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (d) el.style.transitionDelay = `${d}ms`;
        el.classList.add("in");
        io.disconnect();
      },
      { threshold, rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [d, threshold, margin]);

  const Tag = as;
  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}
