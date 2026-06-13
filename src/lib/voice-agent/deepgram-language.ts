/**
 * Deepgram-Sprachauflösung für die EU-STT/TTS (F2 per-Studie-Sprache).
 *
 * Zentralisiert, damit /api/interview/[token]/voice (STT, nova-3) und
 * /api/interview/[token]/speak (TTS, Aura-2) konsistent dieselbe
 * Studiensprache verwenden — und damit die Zuordnung OHNE den server-only-
 * Import-Pfad der Routen testbar ist. "de" bleibt überall der sichere Default.
 */

/** nova-3-Sprachcode aus der Interviewsprache; alles außer "en" → "de". */
export function sttLanguageCode(language: string): "de" | "en" {
  return language === "en" ? "en" : "de";
}

/**
 * Aura-2-Stimme aus der Interviewsprache. Deutsch ist der Fallback für jede
 * unbekannte Sprache. Beide Modellnamen sind über env überschreibbar
 * (DEEPGRAM_TTS_MODEL_DE / _EN) — Sicherheitsnetz, falls ein Stimmenname ohne
 * Code-Deploy angepasst werden muss. Env wird pro Aufruf gelesen (vernachläs-
 * sigbar, eine TTS-Synthese pro /speak-Request).
 */
export function ttsModelForLanguage(language: string): string {
  const de = process.env.DEEPGRAM_TTS_MODEL_DE || "aura-2-aurelia-de";
  const en = process.env.DEEPGRAM_TTS_MODEL_EN || "aura-2-thalia-en";
  return language === "en" ? en : de;
}
