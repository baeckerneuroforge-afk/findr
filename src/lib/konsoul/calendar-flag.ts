/**
 * Konsoul KALENDER-FLAG (Roadmap „Konsoul im Kalender"). Default AUS.
 *
 * Gated das Kalender-Orchestrieren: das Read-Tool `get_calendar_context`, die
 * Aktion `schedule_activation` (propose-confirm) UND den Konsoul-Drawer auf
 * `/dashboard/kalender`. GESTAPELT auf `NEXT_PUBLIC_KONSOUL_ACTIONS_ENABLED`:
 * der Termin-VORSCHLAG (eine propose-confirm-Aktion) erscheint nur, wenn BEIDE
 * Flags an sind; das Read-Tool/der Drawer hängen nur an diesem Flag.
 *
 * Solange das Flag aus ist: kein Read-Tool angeboten, keine Aktion, kein Drawer
 * → Konsoul + Kalender byte-gleich zu heute. Mergen + Migration-Anwenden ändern
 * NICHTS, bis André dieses Flag setzt — exakt wie das P3-Actions- und P4-Coach-Flag.
 *
 * Bewusst KEIN `server-only` und KEINE DB/Netzwerk-Abhängigkeit (Server-Engine
 * UND Client-Komponenten importieren es). Öffentliche Env-Variable.
 *
 * Aktivierung (default aus): NEXT_PUBLIC_KONSOUL_CALENDAR_ENABLED = "true".
 * Jeder andere Wert (unset / "false" / "0" / leer) ⇒ AUS.
 */

/** True NUR wenn die Env-Variable exakt "true" ist. Default (unset) ⇒ false. */
export const KONSOUL_CALENDAR_ENABLED: boolean =
  process.env.NEXT_PUBLIC_KONSOUL_CALENDAR_ENABLED === "true";

/** Laufzeit-Lese-Helfer (statt der Konstante) — dieselbe Variable, gleiche
 *  Default-AUS-Semantik (für Tests mit gepatchter Env). */
export function isKonsoulCalendarEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KONSOUL_CALENDAR_ENABLED === "true";
}
