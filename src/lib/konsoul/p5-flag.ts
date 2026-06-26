/**
 * Konsoul P5 — FEATURE FLAG (Roadmap P5 „Politur": Inline-⌘K-Q&A, Telemetrie,
 * persistierte Threads). Default AUS.
 *
 * EINE zentrale Quelle, die Client (Palette/Panel) UND Server (Thread-/Metrics-
 * Routen, Cron-Sweep-Wiring) lesen. Solange das Flag aus ist:
 *   - zeigt die ⌘K-Palette KEINE Inline-Antwort (unverändertes Such-Verhalten),
 *   - rendert das Insights-Panel KEINE Thread-Persistenz/-Liste,
 *   - antworten die /api/konsoul-agent/threads|metrics-Routen mit 404 (inert),
 *     schreiben also nie in die neuen Tabellen.
 * Mergen + Migration-Anwenden ändern damit NICHTS am Verhalten, bis André das
 * Flag bewusst setzt — exakt wie das P3-Actions- und P4-Coach-Flag.
 *
 * Bewusst KEIN `server-only` und KEINE DB/Netzwerk-Abhängigkeit: dieselbe Datei
 * muss aus Server-Routen UND Client-Komponenten importierbar sein. Öffentliche
 * Env-Variable (NEXT_PUBLIC_*), damit auch der Client-Bundle sie deterministisch
 * sieht.
 *
 * Aktivierung (default aus): NEXT_PUBLIC_KONSOUL_P5_ENABLED = "true".
 * Jeder andere Wert (unset / "false" / "0" / leer) ⇒ AUS.
 */

/** True NUR wenn die Env-Variable exakt "true" ist. Default (unset) ⇒ false. */
export const KONSOUL_P5_ENABLED: boolean =
  process.env.NEXT_PUBLIC_KONSOUL_P5_ENABLED === "true";

/** Laufzeit-Lese-Helfer (statt der Konstante) — liest dieselbe Variable, gleiche
 *  Default-AUS-Semantik (für Tests mit gepatchter Env). */
export function isKonsoulP5Enabled(): boolean {
  return process.env.NEXT_PUBLIC_KONSOUL_P5_ENABLED === "true";
}
