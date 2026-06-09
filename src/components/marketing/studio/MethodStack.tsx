"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { MODULES } from "../PlatformModules";

/**
 * „Das Repertoire“ — die vier Methoden als Tonband-Karten im Sticky-Stapel:
 * beim Scrollen schiebt sich die nächste Spur über die vorige, die sanft
 * zurückskaliert und abdunkelt (nur transform/opacity, GPU-freundlich).
 *
 * Inhalt kommt aus der kanonischen MODULES-Registry (Name, Blurb, Status,
 * Link — Single Source mit Mega-Menü, Footer und Sitemap); die Beispielfrage
 * je Methode trägt die Studio-Inszenierung (klar als Beispiel gelabelt).
 *
 * prefers-reduced-motion: kein Scroll-Handler — die Karten stapeln nur via
 * position:sticky, ohne Skalierung/Bewegung.
 */

const EXAMPLE_QUESTIONS: Record<string, string> = {
  "/methoden/bedarf-verhalten":
    "„Erzähl mal von letzter Woche — wie hast du entschieden, was du kochst?“",
  "/methoden/markenwahrnehmung":
    "„Wenn diese Marke eine Person wäre — wie würdest du sie beschreiben?“",
  "/methoden/konzept-test":
    "„Erklär mir das Konzept in deinen eigenen Worten — was bleibt hängen?“",
  "/methoden/creative-test":
    "„Du hast die Anzeige drei Sekunden gesehen — was ist hängengeblieben?“",
};

export function MethodStack() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const root = rootRef.current;
    if (!root) return;
    const cards = Array.from(
      root.querySelectorAll<HTMLElement>(".st-tapecard"),
    );
    let ticking = false;

    const stackTick = () => {
      ticking = false;
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) {
          card.style.transform = "";
          card.style.opacity = "";
          return;
        }
        const r = next.getBoundingClientRect();
        const cover = Math.min(
          1,
          Math.max(0, 1 - (r.top - 84) / window.innerHeight),
        );
        card.style.transform = `scale(${1 - cover * 0.05}) translateY(${-cover * 14}px)`;
        card.style.opacity = String(1 - cover * 0.35);
      });
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(stackTick);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    stackTick();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      {MODULES.map((m, i) => (
        <article key={m.href} className="st-tapecard">
          <div className="flex items-center justify-between">
            <span className="st-tag">
              Spur 0{i + 1} / 0{MODULES.length}
            </span>
            <span className={`st-lamp ${m.status === "Bald" ? "st-lamp--soon" : ""}`}>
              <b aria-hidden />
              {m.status}
            </span>
          </div>
          <h3>{m.name}</h3>
          <p className="st-desc">{m.blurb}</p>
          <Link
            href={m.href}
            className="relative z-10 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-anchor-foreground/75 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60"
          >
            Mehr zur Methode <span aria-hidden>→</span>
          </Link>
          <div className="st-q">
            <span className="st-tag !text-[10px]">Beispielfrage</span>
            <p>{EXAMPLE_QUESTIONS[m.href] ?? m.blurb}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
