"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Header-Hülle der Studio-Bühne: oben transparent über dem Hero, ab ein paar
 * Pixeln Scroll Papier-Blur + Hairline (Klasse `solid`, CSS in studio.css).
 * Client-Insel nur für den Scroll-Zustand — der Header-INHALT (Logo, Nav,
 * CTAs) kommt server-gerendert als children rein.
 */
export function StudioHeaderBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Klasse nur beim Schwellen-Übergang umschalten — der Listener feuert pro
    // Scroll-Event, aber wir mutieren den (blur-tragenden) Header nur, wenn
    // sich der Zustand wirklich ändert.
    let solid = false;
    const onScroll = () => {
      const next = window.scrollY > 12;
      if (next === solid) return;
      solid = next;
      el.classList.toggle("solid", next);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header ref={ref} className="st-top">
      {children}
    </header>
  );
}
