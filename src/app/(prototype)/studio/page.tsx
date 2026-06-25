import { StudyWizard } from "@/components/_prototype/study-wizard/StudyWizard";

/**
 * /studio — Klick-Prototyp des neuen, gefuehrten Studien-Flows (Markt-Studien).
 *
 * Reine Server-Hülle → rendert die Client-Wizard-Komponente. Alle Daten sind
 * Dummy, die „KI"-Vorschläge sind kanned (kein Fetch, kein Backend, keine DB).
 * Diese Seite ersetzt NICHTS am produktiven /dashboard/market-research/new —
 * sie liegt isoliert in der (prototype)-Group und ist nicht verlinkt.
 */
export default function StudioPrototypePage() {
  return <StudyWizard />;
}
