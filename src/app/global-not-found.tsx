import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

/**
 * Global 404 für URLs, die KEINE Route treffen (Perf-Etappe C). Mit zwei
 * Root-Layouts ((app)/(marketing)) gibt es kein gemeinsames Layout mehr, das
 * ein klassisches Root-not-found rendern könnte — diese Datei wird vom Router
 * direkt ausgeliefert und bringt deshalb ihr eigenes <html>/<body> mit.
 * Bewusst leichtgewichtig (System-Font-Stack, kein next/font, kein Header/
 * Footer): die Seite soll auch ohne jedes App-JS sofort da sein. Innerhalb
 * der Trees gefangene notFound()-Aufrufe rendern weiterhin die hübscheren
 * (app)/not-found bzw. (marketing)/not-found im jeweiligen Layout.
 */

export const metadata: Metadata = {
  title: "404 — Seite nicht gefunden | findr.",
  description: "Diese Seite gibt es nicht (mehr).",
};

export default function GlobalNotFound() {
  return (
    <html lang="de" className="antialiased">
      <body className="min-h-dvh bg-white text-neutral-900">
        <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
          <span className="text-6xl font-semibold text-primary-600">404</span>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">
            Seite nicht gefunden.
          </h1>
          <p className="max-w-md text-neutral-500">
            Diese Seite gibt es nicht (mehr). Vielleicht findest du auf der
            Startseite, was du suchst.
          </p>
          <Link
            href="/"
            className="mt-2 inline-flex h-11 items-center justify-center rounded bg-primary-600 px-5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            Zur Startseite
          </Link>
        </div>
      </body>
    </html>
  );
}
