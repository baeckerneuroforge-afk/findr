"use client";

import Link from "next/link";

/**
 * Error-Boundary der Teilnehmer-Gruppe (participant) — Twins in (app)/(marketing),
 * jede Root-Gruppe braucht ihre eigene (kein gemeinsames Root mehr, Perf-Etappe C).
 * Muss eine Client Component sein. Rendert seine eigene helle Fläche über dem
 * dunklen Root-Body. Inhaltlich identisch zum (app)-Twin.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-white px-6 text-center font-body text-neutral-900 antialiased">
      <span className="font-marketing text-5xl font-semibold text-primary-600">
        Hoppla.
      </span>
      <h1 className="font-marketing text-3xl font-semibold tracking-[-0.02em] text-neutral-900">
        Etwas ist schiefgelaufen.
      </h1>
      <p className="max-w-md text-neutral-500">
        Ein unerwarteter Fehler ist aufgetreten. Versuch es erneut — oder geh
        zurück zur Startseite.
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center justify-center gap-2 rounded bg-primary-600 px-5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
        >
          Erneut versuchen
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center gap-2 rounded border border-neutral-300 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
