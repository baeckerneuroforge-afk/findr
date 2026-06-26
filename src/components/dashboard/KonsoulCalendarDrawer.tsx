"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { CrossStudyAgentPanel } from "@/components/dashboard/CrossStudyAgentPanel";

/**
 * Konsoul „im Kalender" — ein ausklappbarer rechter Drawer auf /dashboard/kalender,
 * der das BESTEHENDE Konsoul-Panel (CrossStudyAgentPanel) wiederverwendet. Konsoul
 * liest dort den Kalender-Stand (get_calendar_context) und kann einen ENTWURF zur
 * Terminierung VORSCHLAGEN; der Confirm öffnet den bestehenden Termin-Picker (kein
 * Versand, kein /activate). Gated von der Kalender-Seite hinter dem Kalender-Flag.
 *
 * Reine UI-Hülle: keine neue Sicherheits-/Aktions-Fläche — das Panel besitzt den
 * gesamten Honesty-/Propose-Confirm-/Audit-Fluss unverändert.
 */
export function KonsoulCalendarDrawer({
  studies,
}: {
  studies: { studyId: string; studyTitle: string }[];
}) {
  const t = useTranslations("kalender");
  const [open, setOpen] = useState(false);

  // Escape schließt — Subscribe-Muster (Listener), kein setState im Effect-Body.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-card px-4 text-body-strong font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
      >
        <svg
          className="h-4 w-4 text-primary-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.3A8 8 0 1 1 21 12Z"
          />
        </svg>
        {t("konsoulOpen")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("konsoulTitle")}
            className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-card p-4 shadow-lg sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-h3 text-neutral-900">{t("konsoulTitle")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-small font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {t("konsoulClose")}
              </button>
            </div>
            <CrossStudyAgentPanel
              studies={studies}
              onScheduleNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default KonsoulCalendarDrawer;
