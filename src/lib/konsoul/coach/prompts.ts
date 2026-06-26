import "server-only";

import type { CoachItem, CoachItemKind } from "./engine";

/**
 * Prompt surface for the Konsoul COACH (P4). Stays in the repo's house style:
 * a German system posture, a compact JSON user payload. The honesty rules are
 * stated here for the model AND enforced structurally by the anchor filter in
 * engine.ts — the prompt is the soft guard, the filter is the hard guard.
 */

/** Number-FREE, deterministic description of each situation. The model turns one
 *  of these into a warm imperative; it never receives a raw count (counts live
 *  in the deterministic sub-label the card already renders), so it cannot echo
 *  one. */
const SITUATION: Record<CoachItemKind, string> = {
  synthesis_gap:
    "Die Studie hat abgeschlossene Interviews, aber noch keine Synthese — die Stimmen warten auf Verdichtung.",
  dead_field:
    "Die Studie ist aktiv, aber es sind noch keine Interviews eingegangen — das Feld muss eröffnet werden.",
  old_draft:
    "Die Studie ist noch ein Entwurf und wartet darauf, fertiggestellt zu werden.",
  persona_gate:
    "Die Studie hat eine Synthese, aber noch zu wenige Interviews für belastbare Personas.",
  persona_quality:
    "Die Studie kann schon Personas erzeugen; mit mehr Interviews werden sie robuster.",
  recurring_theme:
    "Dieses Thema taucht in mehreren Studien auf — eine eigene Studie könnte es vertiefen.",
};

/** BCP-ish language name for the output instruction. Defaults to German. */
function languageName(locale: string): string {
  return locale.startsWith("en") ? "English" : "Deutsch";
}

export const KONSOUL_COACH_SYSTEM_PROMPT = `Du bist Konsoul, der ruhige Research-Coach im Klymeo-Dashboard. Deine einzige Aufgabe: jede gegebene Situation in EINE kurze, motivierende Handlungs-Schlagzeile umzuformulieren — so, wie ein guter Coach den nächsten Schritt anstößt.

EISERNE REGELN (Vertrauen ist der Burggraben):
- Schreibe NIEMALS eine Zahl. Keine Ziffern, keine ausgeschriebenen Mengen ("drei", "ein paar Dutzend"), keine Schwellen. Die Zahlen stehen bereits sichtbar unter deiner Schlagzeile — du lieferst nur den Antrieb.
- Erfinde NICHTS: keine Studie, kein Thema, keine Tatsache, die nicht in der Situation steht.
- Wenn "study" mitgegeben ist, nenne genau diesen Titel WÖRTLICH (in deutschen Anführungszeichen „…"). Wenn "study" fehlt, nenne KEINEN Studientitel — der wird daneben angezeigt.
- Eine Schlagzeile = ein imperativer Satz, höchstens ~12 Wörter. Kein Doppelpunkt-Listing, keine Erklärung, kein Emoji.
- Gib für JEDEN Eintrag genau eine Schlagzeile mit demselben "key" zurück. Lass keinen Eintrag aus, erfinde keinen dazu.

Wenn du eine Situation nicht regelkonform formulieren kannst, gib eine schlichte, neutrale Handlungs-Schlagzeile ohne Zahl/Studie zurück — niemals etwas Erfundenes.`;

/** Build the compact JSON user payload. Only signal items (requireEntity) carry
 *  the study/theme name; next-step items omit it (the card appends the title). */
export function buildCoachUserMessage(
  items: CoachItem[],
  locale: string,
): string {
  const payload = items.map((it) => ({
    key: it.key,
    situation: SITUATION[it.kind],
    ...(it.requireEntity ? { study: it.entity } : {}),
  }));

  return [
    `Sprache der Schlagzeilen: ${languageName(locale)}.`,
    "Formuliere für jeden Eintrag eine motivierende Handlungs-Schlagzeile nach den Regeln. Gib das Ergebnis über das Tool zurück.",
    "",
    JSON.stringify({ items: payload }, null, 2),
  ].join("\n");
}
