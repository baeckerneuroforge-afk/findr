"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * E7b (Konsole-v5): Drawer-Hülle für das abgefangene Interview-Transkript
 * (Intercepting Route). Erscheint nur bei Soft-Navigation aus der Konsole —
 * dadurch existiert immer ein History-Eintrag und Schließen ist überall
 * router.back(): Scrim-Klick, ✕, Escape. „In voller Ansicht öffnen“ ist ein
 * bewusst hartes <a> (kein Client-Nav): voller Reload derselben URL rendert
 * die Voll-Seite statt des Intercepts.
 *
 * SSR rendert geschlossen (translate-x-full), der Client öffnet im nächsten
 * Frame — mit reduced-motion steht der Drawer sofort (transition-none).
 */
export function TranscriptDrawer({
  title,
  subtitle,
  fullHref,
  children,
}: {
  title: string;
  subtitle: string;
  fullHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations("research.market");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        aria-hidden="true"
        onClick={() => router.back()}
        className={`absolute inset-0 bg-neutral-900/35 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[min(640px,94vw)] flex-col border-l border-neutral-200 bg-neutral-50 shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-h2 text-neutral-900">{title}</h2>
            <p className="mt-0.5 truncate text-small text-neutral-500">
              {subtitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <a
              href={fullHref}
              className="text-small font-medium text-primary-700 transition-colors hover:text-primary-800"
            >
              {t("transcriptOpenFull")}
            </a>
            <button
              ref={closeRef}
              type="button"
              aria-label={tc("dismiss")}
              onClick={() => router.back()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {children}
        </div>
      </aside>
    </div>
  );
}
