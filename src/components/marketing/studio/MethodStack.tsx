"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { getModules } from "../PlatformModules";
import {
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

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

// Studio-Inszenierung der vier Methoden-Karten (Chrome + Beispielfragen).
type MethodStackContent = {
  trackLabelPre: string; // „Spur 0“ + {i+1}
  trackLabelMid: string; // „ / 0“ + {MODULES.length}
  moreLink: string;
  exampleTag: string;
  exampleQuestions: Record<string, string>;
};

const CONTENT_DE: MethodStackContent = {
  trackLabelPre: "Spur 0",
  trackLabelMid: " / 0",
  moreLink: "Mehr zur Methode",
  exampleTag: "Beispielfrage",
  exampleQuestions: {
    "/methoden/bedarf-verhalten":
      "„Erzähl mal von letzter Woche — wie hast du entschieden, was du kochst?“",
    "/methoden/markenwahrnehmung":
      "„Wenn diese Marke eine Person wäre — wie würdest du sie beschreiben?“",
    "/methoden/konzept-test":
      "„Erklär mir das Konzept in deinen eigenen Worten — was bleibt hängen?“",
    "/methoden/creative-test":
      "„Du hast die Anzeige drei Sekunden gesehen — was ist hängengeblieben?“",
  },
};

// „Track 0“ keeps the leading-zero padding + slash chrome; only the prose
// translates. exampleQuestions keep their /methoden/* path keys verbatim
// (those address the module by route) — only the question values translate.
const CONTENT_EN: MethodStackContent = {
  trackLabelPre: "Track 0",
  trackLabelMid: " / 0",
  moreLink: "Learn about the method",
  exampleTag: "Example question",
  exampleQuestions: {
    "/methoden/bedarf-verhalten":
      "“Tell me about last week — how did you decide what to cook?”",
    "/methoden/markenwahrnehmung":
      "“If this brand were a person — how would you describe them?”",
    "/methoden/konzept-test":
      "“Explain the concept back to me in your own words — what sticks?”",
    "/methoden/creative-test":
      "“You saw the ad for three seconds — what stuck with you?”",
  },
};

export function MethodStack({
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  lang?: Locale;
}) {
  const c = localizedContent(lang, { de: CONTENT_DE, en: CONTENT_EN });
  const modules = getModules(lang);
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
      // Erst ALLE Geometrien lesen, dann ALLE Styles schreiben — kein
      // verschachteltes Read-after-Write (sonst Layout-Flush pro Karte).
      const tops = cards.map((card) => card.getBoundingClientRect().top);
      const vh = window.innerHeight;
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) {
          card.style.transform = "";
          card.style.opacity = "";
          return;
        }
        const cover = Math.min(1, Math.max(0, 1 - (tops[i + 1] - 84) / vh));
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
      {modules.map((m, i) => (
        <article key={m.href} className="st-tapecard">
          <div className="flex items-center justify-between">
            <span className="st-tag">
              {c.trackLabelPre}{i + 1}{c.trackLabelMid}{modules.length}
            </span>
            <span className={`st-lamp ${m.status === "Bald" ? "st-lamp--soon" : ""}`}>
              <b aria-hidden />
              {localizedContent(lang, {
                de: m.status,
                en: m.status === "Bald" ? "Soon" : "Live",
              })}
            </span>
          </div>
          <h3>{m.name}</h3>
          <p className="st-desc">{m.blurb}</p>
          <Link
            href={m.href}
            className="relative z-10 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-anchor-foreground/75 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60"
          >
            {c.moreLink + " "}<span aria-hidden>→</span>
          </Link>
          <div className="st-q">
            <span className="st-tag !text-[10px]">{c.exampleTag}</span>
            <p>{c.exampleQuestions[m.href] ?? m.blurb}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
