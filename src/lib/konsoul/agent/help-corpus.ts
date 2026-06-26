/**
 * Help-Korpus — NUR der TYP + die Lookup-Signatur. Der gefüllte INHALT lebt in
 * der SEPARATEN Datei `help-corpus.data.ts` (Owner: impl:corpus), damit Engine
 * und Korpus konfliktfrei parallel gebaut werden. Diese Datei deklariert den
 * Vertrag, gegen den der Korpus baut, und re-exportiert ihn für die Engine.
 *
 * KEIN `server-only`: rein statische, kuratierte Texte ohne DB/Netzwerk. So darf
 * der Test das Lookup ohne Supabase/Env treiben.
 *
 * EHRLICHKEIT (Plan §6): der Korpus enthält ausschließlich neutrale, kuratierte
 * How-to-Texte — KEINE Teilnehmer-PII, KEINE erfundenen Zahlen, sachlich-helfende
 * du-Form. Ein Help-Treffer wird IMMER als `kind:'guidance'` (neutral, kein
 * grüner Pip) ausgespielt; sein Korpus-`key` reist als `sources`-Eintrag.
 */

/** Die zwei Interview-Sprachen, in denen jeder Topic vorliegt. */
export type HelpLocale = "de" | "en";

/**
 * Ein Hilfe-Thema. `key` ist der stabile, sprach-unabhängige Bezeichner (z.B.
 * "synthesis.howto"); er — NICHT der Prosatext — reist als `sources`-Eintrag in
 * der guidance-Antwort, damit das Frontend die Herkunft ohne PII anzeigen kann.
 * `aliases` sind kurze Schlagworte (de+en gemischt erlaubt), an denen die Engine
 * bei der lokalen Vorauswahl/Anzeige das Thema erkennen kann.
 */
export interface HelpTopic {
  /** Stabiler Korpus-Schlüssel, z.B. "synthesis.howto". Reist als `sources`. */
  key: string;
  /** Kurzer, sprachneutraler Titel für Logs/Debug (nie an den Nutzer). */
  title: string;
  /** Schlagworte zur Themen-Auswahl (de+en), z.B. ["synthese","synthesis"]. */
  aliases: string[];
  /** Der kuratierte How-to-Text je Sprache. Neutral, du-Form, keine PII/Zahlen. */
  body: Record<HelpLocale, string>;
}

// Re-export des gefüllten Korpus aus der Owner-Datei (impl:corpus). Die Engine
// importiert NUR über diese Datei, nie direkt aus `.data`.
export { HELP_CORPUS } from "./help-corpus.data";
import { HELP_CORPUS } from "./help-corpus.data";

/**
 * Schlägt ein Hilfe-Thema anhand seines stabilen `key` nach und liefert den
 * Text in der gewünschten Sprache (Fallback: deutsch). Pure, deterministisch,
 * keine DB. Unbekannter Key → null (die Engine antwortet dann ehrlich, statt zu
 * erfinden).
 */
export function lookupHelpTopic(
  key: string,
  locale: HelpLocale = "de",
): { key: string; title: string; text: string } | null {
  const topic = HELP_CORPUS.find((t) => t.key === key);
  if (!topic) return null;
  return {
    key: topic.key,
    title: topic.title,
    text: topic.body[locale] ?? topic.body.de,
  };
}

/**
 * Löst einen ROHEN Help-Bezeichner DETERMINISTISCH auf einen Korpus-`key` auf —
 * kein Modell. Reihenfolge (konservativ → tolerant), erster Treffer gewinnt:
 *   1. exakter `key` (case-insensitiv),
 *   2. exakter Alias (case-insensitiv),
 *   3. Stichwort-Treffer: ein Alias (oder der key) ENTHÄLT das Stichwort, oder
 *      umgekehrt — nur ab 3 Zeichen, damit kurze Aliase nicht zufällig matchen.
 * null, wenn nichts passt (die Engine spielt dann den Themen-Index aus und das
 * Modell lenkt ehrlich um). So zahlt sich der gepflegte `aliases`-Bestand aus und
 * spart bei Stichwort-Eingaben einen zusätzlichen Loop-Roundtrip.
 */
export function resolveHelpTopicKey(raw: string): string | null {
  const needle = raw.trim().toLowerCase();
  if (needle === "") return null;

  // 1) exakter Key
  const exactKey = HELP_CORPUS.find((t) => t.key.toLowerCase() === needle);
  if (exactKey) return exactKey.key;

  // 2) exakter Alias
  const exactAlias = HELP_CORPUS.find((t) =>
    t.aliases.some((a) => a.toLowerCase() === needle),
  );
  if (exactAlias) return exactAlias.key;

  // 3) Stichwort-Teiltreffer (nur ab 3 Zeichen)
  if (needle.length < 3) return null;
  const partial = HELP_CORPUS.find(
    (t) =>
      t.key.toLowerCase().includes(needle) ||
      t.aliases.some((a) => {
        const al = a.toLowerCase();
        return al.includes(needle) || needle.includes(al);
      }),
  );
  return partial ? partial.key : null;
}

/** Der gesamte Korpus als kompakte Tool-Übersicht (key + Titel + Aliase), die
 *  dem Modell zeigt, welche Themen verfügbar sind — OHNE die vollen Texte vorab
 *  in den Kontext zu laden. Die Engine liefert die Texte erst bei get_help. */
export function listHelpTopicsForTool(): {
  key: string;
  title: string;
  aliases: string[];
}[] {
  return HELP_CORPUS.map((t) => ({
    key: t.key,
    title: t.title,
    aliases: t.aliases,
  }));
}
