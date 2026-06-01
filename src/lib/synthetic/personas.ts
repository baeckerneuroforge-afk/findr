/**
 * Default synthetic personas for the Market-Research dry-run (Stufe 1).
 *
 * SHARED module (deliberately NO "server-only"): the client persona-picker
 * imports DEFAULT_PERSONAS to render the choices, and the server resolves the
 * canonical `prompt` by id when a run starts. The persona PROMPT is a pure
 * character sheet — a disposition, not a script. The interview LANGUAGE (de/en)
 * is enforced separately by the persona LLM call (src/lib/synthetic/persona.ts),
 * so one German character sheet role-plays in either language.
 *
 * Each default is chosen to stress a DIFFERENT part of the interview guide:
 *   - terse        → tests whether the agent PROBES to get anything concrete.
 *   - enthusiast   → tests whether the agent stays ON-PLAN under a rambler.
 *   - skeptic      → tests how the agent handles pushback / guarded answers.
 *   - price_conscious → tests handling of off-plan pricing talk (which the
 *                       discovery classifier is told to SKIP).
 *
 * These are SIMULATIONS, not market opinion — see the disclaimer surfaced in the
 * UI. The labels/blurbs shown to the user are localized via the `syntheticTest`
 * i18n namespace keyed by `id`; the prompt below is internal model input.
 */

export interface SyntheticPersonaDefinition {
  /** Stable id — i18n label/blurb keys hang off this, and the server resolves
   *  the canonical prompt by it. Custom personas carry id `null`. */
  id: string;
  /** Fallback label if i18n is unavailable (the UI prefers the localized one). */
  fallbackLabel: string;
  /** The character sheet fed to the persona LLM as its disposition. German;
   *  the answer language is enforced by the call, not by this text. */
  prompt: string;
}

export const DEFAULT_PERSONAS: readonly SyntheticPersonaDefinition[] = [
  {
    id: "terse",
    fallbackLabel: "Knapp & beschäftigt",
    prompt:
      "Du bist beschäftigt und wortkarg. Du hast wenig Zeit und antwortest sehr knapp — oft nur ein, zwei Sätze, manchmal ausweichend („kommt drauf an“, „weiß nicht“, „passt schon“). Konkretes gibst du erst preis, wenn der Interviewer gezielt und gut nachfragt. Du bist nicht unfreundlich, nur effizient.",
  },
  {
    id: "enthusiast",
    fallbackLabel: "Enthusiastisch",
    prompt:
      "Du bist ein begeisterter Early Adopter. Du probierst gern neue Tools aus und redest offen und ausführlich über deine Erfahrungen. Du hast viele konkrete Wünsche und Ideen, erzählst gern kleine Geschichten aus deinem Arbeitsalltag und bist grundsätzlich positiv eingestellt. Du neigst dazu, abzuschweifen und mehr zu erzählen, als gefragt wurde.",
  },
  {
    id: "skeptic",
    fallbackLabel: "Skeptisch",
    prompt:
      "Du bist skeptisch und kritisch. Du misstraust Anbieter-Versprechen und hinterfragst vieles. Von dir aus nennst du Schwächen, Risiken und Gründe, warum etwas in der Praxis nicht funktioniert. Informationen gibst du nur zögerlich preis und willst erst verstehen, worauf das Gespräch hinausläuft. Du bist höflich, aber distanziert.",
  },
  {
    id: "price_conscious",
    fallbackLabel: "Preisbewusst",
    prompt:
      "Du bist preisbewusst und budgetorientiert. Du arbeitest in einem kleinen bis mittleren Unternehmen und musst jede Ausgabe rechtfertigen. Du fragst früh nach Kosten, Nutzen und ob sich das überhaupt lohnt. Du bist nicht abweisend, aber zurückhaltend und vergleichst im Kopf ständig mit günstigeren oder kostenlosen Alternativen. Konkrete, belegbare Vorteile überzeugen dich, Marketing-Versprechen nicht.",
  },
] as const;

/** O(1) lookup of a default persona's canonical character sheet by id. */
const DEFAULT_PERSONA_BY_ID = new Map(DEFAULT_PERSONAS.map((p) => [p.id, p]));

export function getDefaultPersona(
  id: string,
): SyntheticPersonaDefinition | undefined {
  return DEFAULT_PERSONA_BY_ID.get(id);
}
