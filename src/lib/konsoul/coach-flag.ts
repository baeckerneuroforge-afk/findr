/**
 * Konsoul P4 — COACH FEATURE FLAG (Plan §4B / Roadmap P4). Default AUS.
 *
 * P4 lässt Opus die bereits DETERMINISTISCH berechneten „Nächste Schritte"
 * (R1/R2/R3) und „Konsoul schlägt vor"-Signale in eine warme Coach-Kopfzeile
 * umformulieren. Solange dieses Flag aus ist:
 *   - ruft die Heute-Seite NIE Opus auf (der Coach-Service liefert sofort eine
 *     leere Frame-Map zurück), und
 *   - rendert die Heute-Seite byte-gleich zum P1-Stand (deterministische
 *     `action`/`tip`-Texte aus i18n, alle Zahlen aus der DB).
 * Mergen ändert damit NICHTS, bis André das Flag bewusst setzt — exakt wie das
 * P3-Actions-Flag (siehe `actions-flag.ts`).
 *
 * Bewusst KEIN `server-only` und KEINE DB/Netzwerk-Abhängigkeit: dieselbe Datei
 * muss aus dem Server-Code UND (für Defense-in-depth) aus Client-Komponenten
 * importierbar sein. Der Wert wird zur Build-/Start-Zeit aus einer öffentlichen
 * Env-Variable gelesen (NEXT_PUBLIC_*).
 *
 * Aktivierung (default aus): NEXT_PUBLIC_KONSOUL_COACH_ENABLED = "true".
 * Jeder andere Wert (unset / "false" / "0" / leer) ⇒ AUS.
 */

/** True NUR wenn die Env-Variable exakt "true" ist. Default (unset) ⇒ false. */
export const KONSOUL_COACH_ENABLED: boolean =
  process.env.NEXT_PUBLIC_KONSOUL_COACH_ENABLED === "true";

/**
 * Laufzeit-Lese-Helfer (statt der Konstante), falls ein Aufrufer das Flag
 * dynamisch prüfen will (z. B. in einem Test mit gepatchter Env). Liest dieselbe
 * Variable, dieselbe Default-AUS-Semantik.
 */
export function isKonsoulCoachEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KONSOUL_COACH_ENABLED === "true";
}
