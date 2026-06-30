import "server-only";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import { callClaudeStructured } from "@/lib/anthropic/structured";
import { listResearchPlans } from "@/lib/research/plans-service";
import {
  WizardAdvisorRawResultSchema,
  sanitizeWizardSuggestions,
  type WizardAdvisorResult,
  type WizardSnapshot,
} from "@/lib/schemas/konsoul-wizard";

/**
 * Konsoul WIZARD-BERATER — Engine (Opus, Single-Shot, fail-closed).
 * ----------------------------------------------------------------------------
 * Bewusst NICHT der live Sonnet-Orchestrator (`/lib/konsoul/agent/engine.ts`):
 * eine EIGENE, kleine Engine, damit (a) der Orchestrator byte-gleich bleibt und
 * (b) der Wizard sein eigenes OPUS-Gehirn bekommt (Andrés Vorgabe — „das
 * wichtigste Tool, nimm Opus"). Ein einziger forcierter Tool-Call
 * (`callClaudeStructured`) → keine Tool-Schleife, kein Budget, planbare Latenz.
 *
 * Erdung: ein LEICHTER Portfolio-Kontext (nur Studientitel + Status, fail-open)
 * gibt Konsoul die Möglichkeit, an frühere Studien anzuknüpfen — sein
 * Alleinstellungsmerkmal gegenüber generischer Formular-Hilfe. Scheitert der
 * Read, läuft er ohne Erdung weiter (kippt nie die Antwort).
 *
 * EHRLICHKEIT: Das Modell liefert nur ROHE Vorschläge; der einzige Pfad in den
 * State ist die deterministische `sanitizeWizardSuggestions` (Enum-Allowlist,
 * no-op-Filter, Caps). Vorschläge sind Einladungen — der Mensch bestätigt per
 * Klick. Konsoul führt hier NICHTS aus und schreibt nichts in die DB.
 */

export class KonsoulWizardUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KonsoulWizardUnavailableError";
  }
}

const TOOL_NAME = "emit_wizard_advice";

/** Wie viele frühere Studientitel maximal als Erdung in den Prompt wandern. */
const PORTFOLIO_TITLE_LIMIT = 12;
/** Briefing wird für den Prompt gekappt (Token-Budget; der echte Wert bleibt
 *  unangetastet im Wizard). */
const BRIEFING_PROMPT_CAP = 2000;

const SYSTEM_PROMPT = `Du bist „Konsoul", der Studien-Berater im Anlege-Assistenten von Klymeo. Eine Forscherin oder ein Forscher legt gerade eine qualitative Interview-Studie an. Du stehst daneben und hilfst — knapp, konkret, ehrlich, in der du-Form.

DEINE AUFGABE
- Beantworte die Frage der Person (falls eine gestellt wurde) in 2–4 Sätzen. Wenn keine Frage gestellt wurde, gib einen kurzen, nützlichen Tipp zum aktuellen Schritt.
- Schlage — wenn sinnvoll — konkrete Werte für noch leere oder schwache Setup-Felder vor. Jeder Vorschlag ist eine Einladung, die der Mensch per Klick übernimmt; du entscheidest und schreibst NICHTS selbst.

EHRLICHKEIT (nicht verhandelbar)
- Erfinde KEINE Zahlen oder Fakten über das Portfolio. Beziehe dich auf frühere Studien NUR, wenn ihr Titel unten ausdrücklich aufgeführt ist.
- Nenne keine konkreten Zahlen (Interview-Anzahl, Dauer, Quoten, Stichprobe), die nicht aus dem Formular-Stand oder den oben gelisteten Studientiteln stammen.
- Du hilfst beim AUFSETZEN der Studie, nicht beim Auswerten — behaupte nie ein Interview-Ergebnis.

FELDER, DIE DU VORSCHLAGEN DARFST (im Feld "field"):
- briefing — das Forschungsziel (1–3 Sätze, konkret, ergebnisoffen, ohne Suggestivfragen).
- persona — wer interviewt wird (Zielgruppe, knapp: ein kurzer Satz, nicht ausschweifend).
- title — ein knapper, sprechender Studientitel.
- useCase — die Art der Studie, "value" ist GENAU einer dieser Tokens:
    general_survey = allgemeine Exploration / Bedarfsanalyse;
    brand_research = Markenwahrnehmung;
    concept_test = ein Konzept / eine Idee testen;
    creative_test = ein Werbemittel / Creative testen;
    usability_test = aufgabenbasierter Usability-Test.
- audienceType — "value" ist "b2c" oder "b2b".
- interviewDepth — "value" ist "flach", "mittel" oder "tief".

REGELN FÜR VORSCHLÄGE
- Schlage ein Feld NUR vor, wenn es leer, schwach oder klar unpassend zum Ziel ist. Wiederhole NIE den aktuellen Wert.
- Für useCase/audienceType/interviewDepth ist "value" EXAKT eines der erlaubten Tokens — kein Freitext, keine Übersetzung, keine Erklärung im value.
- Höchstens 3 Vorschläge. "label" = kurze Handlungs-Beschriftung (z. B. „Als Konzepttest anlegen"), "rationale" = ein Satz Begründung.
- Wenn schon alles stimmig ist: gib eine kurze bestärkende Antwort und KEINE Vorschläge (leeres suggestions-Array).

Antworte (answer, label, rationale) in der unten genannten Sprache.`;

function stepName(step: number): string {
  if (step === 0) return "Setup (Ziel, Zielgruppe, Art der Studie, Interviewtiefe)";
  if (step === 1) return "Leitfaden (Themen ansehen/bearbeiten, absegnen)";
  return "Start (Verteilung)";
}

function nonEmpty(s: string): string {
  const t = s.trim();
  return t === "" ? "— leer —" : t;
}

/** Eindeutige Sprach-Anweisung (statt eines blanken Locale-Codes), damit die
 *  Antwort zuverlässig in der UI-Sprache der/des Forschenden kommt — auch wenn
 *  das Prompt-Gerüst selbst deutsch ist (Opus ist bilingual). */
function languageInstruction(locale: string): string {
  if (locale.startsWith("en")) {
    return "Antworte vollständig auf Englisch — answer, label und rationale.";
  }
  if (locale.startsWith("de")) {
    return "Antworte auf Deutsch — answer, label und rationale.";
  }
  return `Antworte in dieser Sprache (BCP-47): ${locale}.`;
}

/** Baut den User-Prompt aus dem Wizard-Schnappschuss + optionaler Frage +
 *  optionaler Portfolio-Erdung. */
export function buildWizardUserPrompt(
  w: WizardSnapshot,
  question: string | undefined,
  portfolioLine: string,
  locale: string,
): string {
  const briefing = w.briefing.trim();
  const briefingForPrompt =
    briefing.length > BRIEFING_PROMPT_CAP
      ? `${briefing.slice(0, BRIEFING_PROMPT_CAP).trimEnd()}…`
      : nonEmpty(briefing);

  const lines = [
    `AKTUELLER SCHRITT: ${stepName(w.step)}.`,
    "",
    "AKTUELLER STAND DES FORMULARS:",
    `- Ziel (briefing): ${briefingForPrompt}`,
    `- Titel (title): ${nonEmpty(w.title)}`,
    `- Zielgruppe (persona): ${nonEmpty(w.persona)}`,
    `- Art der Studie (useCase): ${w.useCase}`,
    `- Zielgruppen-Typ (audienceType): ${w.audienceType}`,
    `- Interviewtiefe (interviewDepth): ${w.interviewDepth}`,
    `- Modus: ${w.voiceEnabled ? "Voice" : "Text"}`,
    `- Themen im Leitfaden bisher: ${w.topicCount}`,
  ];

  if (portfolioLine) {
    lines.push("", portfolioLine);
  }

  if (question && question.trim() !== "") {
    lines.push("", `FRAGE DER PERSON: ${question.trim()}`);
  } else {
    lines.push(
      "",
      "Es wurde keine konkrete Frage gestellt. Gib einen kurzen, hilfreichen Tipp zum aktuellen Schritt und — falls sinnvoll — Feldvorschläge.",
    );
  }

  lines.push("", languageInstruction(locale));
  return lines.join("\n");
}

/** Leichter Portfolio-Kontext (Titel + Status). Fail-open: Lese-Fehler ⇒ "". */
async function loadPortfolioGrounding(orgId: string): Promise<string> {
  try {
    const plans = await listResearchPlans(orgId, "market_research");
    const titles = plans
      .slice(0, PORTFOLIO_TITLE_LIMIT)
      .map((p) => `"${p.title}" (${p.status})`);
    if (titles.length === 0) return "";
    return `BISHERIGE STUDIEN DIESER ORG (nur zur möglichen Anknüpfung — erfinde keine, nenne keine Ergebnisse): ${titles.join(
      "; ",
    )}`;
  } catch {
    return "";
  }
}

/**
 * Berät zum aktuellen Wizard-Stand. EIN Opus-Aufruf → {answer, suggestions}.
 * Wirft `KonsoulWizardUnavailableError`, wenn das Modell/Schema scheitert (die
 * Route mappt das auf 500); die Sanitisierung der Vorschläge ist deterministisch
 * und kann nicht „leaken".
 */
export async function runKonsoulWizardAdvisor(input: {
  orgId: string;
  wizard: WizardSnapshot;
  question?: string;
  locale: string;
}): Promise<WizardAdvisorResult> {
  const portfolioLine = await loadPortfolioGrounding(input.orgId);
  const userPrompt = buildWizardUserPrompt(
    input.wizard,
    input.question,
    portfolioLine,
    input.locale,
  );

  let raw;
  try {
    raw = await callClaudeStructured({
      schema: WizardAdvisorRawResultSchema,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      model: CLAUDE_MODELS.opus,
      maxTokens: 1200,
      toolName: TOOL_NAME,
      timeoutMs: 60_000,
    });
  } catch (err) {
    throw new KonsoulWizardUnavailableError(
      err instanceof Error ? err.message : "wizard advisor call failed",
    );
  }

  const suggestions = sanitizeWizardSuggestions(raw.suggestions, input.wizard);
  return { answer: raw.answer.trim(), suggestions };
}
