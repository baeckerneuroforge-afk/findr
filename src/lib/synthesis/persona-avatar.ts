/**
 * Deterministischer, illustrierter Avatar für eine Audience-Persona
 * (Spec docs/klymeo-personas-feature-spec-2026-06-21.md, Avatar-Politur v1.1).
 *
 * Bewusst KEINE KI-Gesichtsbilder (kein Generierungs-Call pro Persona, kein
 * Bild-Hosting, und bei einem Research-Tool mit echten Befragten heikel) und
 * KEINE Fotos (Spec §0). Stattdessen ein prozedural aus dem Seed erzeugter,
 * klar illustrierter Avatar (DiceBear, Stil „notionists"): gleiche Persona →
 * gleicher Avatar, jede Persona anders, garantiert keine echte Person.
 *
 * Der Seed ist der Persona-Name (kein Befragten-PII) — eine umbenannte oder
 * neue Persona bekommt ein neues Bild. Reine URL-Bildung über die DiceBear-
 * HTTP-API: keine npm-Abhängigkeit, kein next.config-Eingriff. Die committete
 * CSP erlaubt externe Bilder (img-src … https:). Schlägt der Abruf fehl, fällt
 * die PersonaCard hart auf das Monogramm zurück.
 */

export const PERSONA_AVATAR_STYLE = "notionists";

export function personaAvatarUrl(seed: string): string {
  const s = encodeURIComponent(seed.trim() || "persona");
  return `https://api.dicebear.com/9.x/${PERSONA_AVATAR_STYLE}/svg?seed=${s}`;
}
