/**
 * Konsoul-INTERVIEWER-PERSONA — additiver Marken-Charakter für den
 * TEILNEHMER-seitigen Research-Interviewer (Text + Voice). Default AUS.
 *
 * Gibt dem Interviewer Konsouls NAME + TON („mehr Persönlichkeit"), OHNE sein
 * Verhalten, seinen Scope oder seine Vertrauensgrenze zu ändern. Bei aktivem
 * Flag hängt interviewer.ts (researchCore) diesen Block additiv an den
 * unveränderten RESEARCH_INTERVIEWER_CORE — alle Transparenz-, No-Affekt-,
 * Saturation- und Stop-Regeln des CORE bleiben wörtlich erhalten und haben laut
 * letzter Persona-Zeile Vorrang.
 *
 * TRUST-BOUNDARY (hart): Diese Datei lebt BEWUSST unter src/lib/voice-agent/,
 * NICHT unter src/lib/konsoul/. Sie importiert NICHTS aus src/lib/konsoul/** —
 * kein Engine, kein Tool, keine Allowlist, keine orgId. „Konsoul" ist hier nur
 * ein NAME/Ton; der teilnehmer-seitige Interviewer bekommt NIE die org-seitigen
 * Fähigkeiten des Konsoul-Orchestrators (der mit Forschern spricht). Ein
 * Grep-Wächter-Test hält den Interviewer-Pfad frei von @/lib/konsoul-Imports.
 *
 * Bewusst KEIN `server-only`: Server (Prompt-Bau in interviewer.ts) UND
 * Client-Komponenten (i18n-Gating der KI-Offenlegungs-Copy) lesen das Flag.
 * Öffentliche Env-Variable.
 *
 * Aktivierung (default aus): NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA = "true".
 * Jeder andere Wert (unset / "false" / "0" / leer) ⇒ AUS. NEXT_PUBLIC_* wird zur
 * Build-Zeit eingebacken → Flag-Flip braucht Redeploy (wie P3/P4/Kalender).
 */

/**
 * Additiver Persona-Block. Wird NUR bei aktivem Flag an den CORE gehängt.
 * Reiner String — keine Logik, kein Tool. Ändert ausschließlich Name + Ton; die
 * KI-Offenlegung wird durch den Namen ERGÄNZT, nie ersetzt oder abgeschwächt.
 * Die letzte Zeile gibt den CORE-Regeln (Transparenz, No-Affekt, Scope, Stop)
 * ausdrücklich Vorrang.
 */
export const KONSOUL_INTERVIEWER_PERSONA = `IDENTITY (micro-personality — does NOT change your behavior):
- Your name is "Konsoul". In your OPENING message, introduce yourself BY NAME as "Konsoul, an AI research assistant" (translated into the required interview language). This name is ADDED to the transparency intro above — it never replaces or softens the AI disclosure: you always make unmistakably clear that you are an AI, not a human.
- Tone: calm, factual, concise; warm without filler. No emoji, never alarmist, no smalltalk.
- Honesty: if you don't know something, or it lies outside the plan, say so plainly. Invent nothing.
- This identity affects ONLY your name and tone. Every interview, scope, saturation, stop, transparency and no-affect rule above stays unchanged and takes ABSOLUTE precedence over this block. Never label, infer, or mirror the participant's emotions.`;

/** True NUR wenn die Env-Variable exakt "true" ist. Default (unset) ⇒ false. */
export const KONSOUL_INTERVIEWER_PERSONA_ENABLED: boolean =
  process.env.NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA === "true";

/** Laufzeit-Lese-Helfer (statt der Konstante) — dieselbe Variable, gleiche
 *  Default-AUS-Semantik (für Tests mit gepatchter Env via vi.stubEnv). */
export function isKonsoulInterviewerPersonaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KONSOUL_INTERVIEWER_PERSONA === "true";
}

/**
 * Konsoul-INTERVIEWER-GESICHT — separates Visual-Flag (default AUS). Schaltet im
 * VOICE-Interview den abstrakten Orb auf Konsouls reagierendes Gesicht (Mimik:
 * sprechen/hören/denken + ruhige Warte-Präsenz). BEWUSST getrennt vom Persona-
 * Flag, damit Name und Gesicht unabhängig scharfgeschaltet werden können. AUS ⇒
 * der Orb rendert byte-identisch wie heute (leerer Kern). NEXT_PUBLIC_* → wird
 * zur Build-Zeit eingebacken, Flag-Flip braucht Redeploy.
 *
 * COMPLIANCE: Die Mimik reagiert AUSSCHLIESSLICH auf Konsouls EIGENEN Zustand
 * (lk.agent.state / eigene Sprech-Aktivität) — NIE auf das Ablesen/Spiegeln des
 * Teilnehmer-Affekts (No-Affekt-Linie; sonst Emotionserkennung = Hochrisiko).
 * Nur Voice (der Text-Pfad hat keinen sprechenden Agenten). */
export const KONSOUL_INTERVIEWER_FACE_ENABLED: boolean =
  process.env.NEXT_PUBLIC_KONSOUL_INTERVIEWER_FACE === "true";

export function isKonsoulInterviewerFaceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KONSOUL_INTERVIEWER_FACE === "true";
}
