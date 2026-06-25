"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { useNavCollapsed } from "@/components/dashboard/nav-collapse";

/**
 * Sticky-Kontextleiste der Studien-Detailseite (Konsole-v5 E4): erscheint
 * beim Scrollen unter dem Dashboard-Header und hält Studientitel, Status,
 * Ziel-Pool-Stand und den Synthese-Sprung im Blick — die Seite ist lang,
 * der Kontext soll es nicht sein.
 *
 * position:fixed unter dem sticky Header (top-14, z-20 < Header z-30); der
 * linke Versatz folgt der Sidebar-Breite im Gleichschritt (left-60 ⇄ left-16 =
 * 240/64 px, exakt wie ShellFrame sein pl-60 ⇄ pl-16 schaltet). Weil die Leiste
 * viewport-fixiert ist und NICHT in der gepaddeten Hauptspalte hängt, kann sie
 * die Sidebar-Breite nicht erben — sie liest den eingeklappt-Zustand aus dem
 * NavCollapse-Kontext (Quelle: ShellFrame) und animiert den `left`-Wert über
 * dieselbe Dauer/Kurve wie die Sidebar (340 ms), unter Reduced-Motion sofort.
 * Solange versteckt: opacity-0 + pointer-events-none + inert — unsichtbar UND
 * Klicks gehen DURCH die Leiste auf den Inhalt darunter. (translate-y allein
 * reichte nicht: die inerte, aber sichtbare Leiste überdeckte H1/Badges und
 * blockte deren Klicks, weil ein inert-Element Klicks nicht durchlässt.)
 */
export function StickyStudyBar({
  title,
  statusLabel,
  statusVariant,
  progressText,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  statusLabel: string;
  statusVariant: BadgeVariant;
  progressText: string | null;
  ctaHref: string;
  ctaLabel: string;
}) {
  const [show, setShow] = useState(false);
  // Eingeklappt-Zustand der Sidebar (Quelle: ShellFrame via NavCollapse-
  // Kontext). Default false (ausgeklappt) ohne Provider → sicherer left-60-
  // Fallback, gleicher Wert auf Server und im ersten Client-Render.
  const collapsed = useNavCollapsed();

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        setShow(window.scrollY > 280);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      inert={!show}
      aria-hidden={!show}
      className={`fixed right-0 top-14 z-20 border-b border-neutral-200 bg-card transition-[transform,opacity,left] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        collapsed ? "left-16" : "left-60"
      } ${
        show
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "-translate-y-2 opacity-0 pointer-events-none"
      }`}
    >
      {/* Muss der max-width der <main>-Spalte im (dashboard)-Layout folgen,
          sonst fluchtet die Subbar nicht mit dem Seiteninhalt. */}
      <div className="mx-auto flex h-12 max-w-[1120px] items-center gap-3 px-8">
        <span className="truncate text-body-strong text-neutral-900">
          {title}
        </span>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
        {progressText && (
          <span className="whitespace-nowrap font-mono text-small text-neutral-500">
            {progressText}
          </span>
        )}
        <span className="flex-1" />
        <Link
          href={ctaHref}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary-600 px-3 text-small font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
