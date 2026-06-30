/**
 * Konsoul WIZARD-BERATER — FEATURE FLAG. Default AUS.
 *
 * Gatet die NEUE org-seitige Berater-Fläche im Studien-Anlege-Assistenten
 * (`/dashboard/market-research/new`): Konsoul steht oben im Wizard, beantwortet
 * Fragen und schlägt Feldwerte vor (1-Klick-Übernahme via `patch()`).
 *
 * Solange das Flag aus ist:
 *   - rendert `GuidedStudyWizard` den Begleiter NICHT (Render byte-gleich zu vorher),
 *   - antwortet `/api/konsoul-wizard` mit 404 (Defense-in-Depth — die Fläche, die
 *     ihn aufruft, existiert dann ohnehin nicht).
 * Mergen ändert damit NICHTS, bis André das Flag bewusst setzt.
 *
 * Bewusst KEIN `server-only` und KEINE DB/Netz-Abhängigkeit: dieselbe Datei wird
 * aus der Server-Route UND aus der Client-Komponente importiert. Der Wert wird
 * zur Build-/Start-Zeit aus einer öffentlichen Env-Variable gelesen
 * (NEXT_PUBLIC_*, damit auch der Client-Bundle ihn deterministisch sieht). Muster
 * 1:1 wie actions-flag.ts / coach-flag.ts / p5-flag.ts.
 *
 * Aktivierung (default aus): NEXT_PUBLIC_KONSOUL_WIZARD_ENABLED = "true".
 * Jeder andere Wert (unset / "false" / "0" / leer) ⇒ AUS.
 */

/** True NUR wenn die Env-Variable exakt "true" ist. Default (unset) ⇒ false. */
export const KONSOUL_WIZARD_ENABLED: boolean =
  process.env.NEXT_PUBLIC_KONSOUL_WIZARD_ENABLED === "true";

/**
 * Laufzeit-Lese-Helfer (statt der Konstante), falls ein Aufrufer das Flag
 * dynamisch prüfen will (z. B. ein Test mit gepatchter Env). Liest dieselbe
 * Variable, dieselbe Default-AUS-Semantik.
 */
export function isKonsoulWizardEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KONSOUL_WIZARD_ENABLED === "true";
}
