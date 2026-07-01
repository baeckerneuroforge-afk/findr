import { notFound } from "next/navigation";
import { StudyWizard } from "@/components/_prototype/study-wizard/StudyWizard";

/**
 * /studio — Klick-Prototyp des neuen, gefuehrten Studien-Flows (Markt-Studien).
 *
 * Reine Server-Hülle → rendert die Client-Wizard-Komponente. Alle Daten sind
 * Dummy, die „KI"-Vorschläge sind kanned (kein Fetch, kein Backend, keine DB).
 * Diese Seite ersetzt NICHTS am produktiven /dashboard/market-research/new —
 * sie liegt isoliert in der (prototype)-Group und ist nicht verlinkt.
 *
 * PROD-GATE (Hygiene-Audit 2026-07-01): unverlinkt ≠ unerreichbar — der
 * Prototyp war in Produktion öffentlich abrufbar. In Production-Builds
 * (inkl. Vercel-Preview, dort ist NODE_ENV ebenfalls "production"): 404,
 * außer das explizite Opt-in SHOW_PROTOTYPES=true ist gesetzt (z. B. für
 * eine Vorführ-Preview). Lokale Entwicklung (`next dev`) bleibt offen.
 */
export const dynamic = "force-dynamic";

export default function StudioPrototypePage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SHOW_PROTOTYPES !== "true"
  ) {
    notFound();
  }
  return <StudyWizard />;
}
