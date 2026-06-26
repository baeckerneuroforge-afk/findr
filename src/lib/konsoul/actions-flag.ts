/**
 * Konsoul P3 — ACTIONS FEATURE FLAG (Design-Doc §6, Review-Auflage: "FLAG-GATED
 * OFF"). Default AUS.
 *
 * EINE zentrale Quelle, die Engine UND Frontend lesen, damit P3 (das Vorschlags-
 * /Confirm-Verhalten) nur scharf wird, wenn André es bewusst einschaltet — UND
 * die Audit-Migration angewandt ist. Solange das Flag aus ist:
 *   - bietet die Engine `propose_action` dem Modell NICHT an → Konsoul bleibt
 *     exakt das P2-read-only-Verhalten (byte-gleich),
 *   - rendert das Frontend keinen Confirm-Button.
 * Mergen ändert damit NICHTS, bis das Flag gesetzt ist.
 *
 * Bewusst KEIN `server-only` und KEINE DB/Netzwerk-Abhängigkeit: dieselbe Datei
 * muss aus der Server-Engine UND aus Client-Komponenten importierbar sein. Der
 * Wert wird zur Build-/Start-Zeit aus einer öffentlichen Env-Variable gelesen
 * (NEXT_PUBLIC_*, damit auch der Client-Bundle ihn deterministisch sieht).
 *
 * Aktivierung (default aus): NEXT_PUBLIC_KONSOUL_ACTIONS_ENABLED = "true".
 * Jeder andere Wert (unset / "false" / "0" / leer) ⇒ AUS.
 */

/** True NUR wenn die Env-Variable exakt "true" ist. Default (unset) ⇒ false. */
export const KONSOUL_ACTIONS_ENABLED: boolean =
  process.env.NEXT_PUBLIC_KONSOUL_ACTIONS_ENABLED === "true";

/**
 * Laufzeit-Lese-Helfer (statt der Konstante), falls ein Aufrufer das Flag
 * dynamisch prüfen will (z. B. in einem Test mit gepatchter Env). Liest dieselbe
 * Variable, dieselbe Default-AUS-Semantik.
 */
export function isKonsoulActionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KONSOUL_ACTIONS_ENABLED === "true";
}
