-- Studien-Kontext (E1, Leitfaden-Spezifität 2026-07-02):
-- Freitext "Unternehmen / Produkt / Idee", den der Forscher beim Anlegen
-- mitgibt. Fließt in die Leitfaden-Generierung (guide-generator.ts, Block
-- KONTEXT) und ist am Plan persistiert, damit später auch Live-Interviewer
-- und Synthese denselben Hintergrund lesen können (bewusst noch NICHT
-- verdrahtet — reine Persistenz + Generierung in E1).
--
-- Nullable, kein DEFAULT, kein Backfill: NULL = "kein Kontext angegeben" →
-- Generierungs-Prompt bleibt byte-identisch zum Vor-Verhalten. Der Cap
-- (2000 Zeichen) wird end-to-end in UI + API-Zod erzwungen (Lehre aus dem
-- persona-Cap-Bug: EINE Zahl über alle Schichten); die DB bleibt weiches
-- text wie persona.
alter table research_plans
  add column if not exists business_context text;

comment on column research_plans.business_context is
  'Optionaler Unternehmens-/Produkt-/Ideen-Kontext (Freitext, App-Cap 2000). Hintergrund für Leitfaden-Generierung; NULL = ohne Kontext, Verhalten unverändert.';
