"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

/**
 * Sticky-Kontextleiste der Studien-Detailseite (Konsole-v5 E4): erscheint
 * beim Scrollen unter dem Dashboard-Header und hält Studientitel, Status,
 * Ziel-Pool-Stand und den Synthese-Sprung im Blick — die Seite ist lang,
 * der Kontext soll es nicht sein.
 *
 * position:fixed unter dem sticky Header (top-14, z-20 < Header z-30);
 * left-60 entspricht der festen Sidebar-Breite (Layout pl-60). Solange
 * versteckt, ist die Leiste `inert` (nicht fokussierbar) und per
 * translate-y aus dem Viewport — gleiche Disclosure-Disziplin wie das
 * Sidebar-Akkordeon.
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
      className={`fixed left-60 right-0 top-14 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur transition-transform duration-200 ease-out motion-reduce:transition-none ${
        show ? "translate-y-0" : "-translate-y-[110%]"
      }`}
    >
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-3 px-8">
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
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary-600 px-3 text-small font-medium text-white transition-colors hover:bg-primary-700"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
