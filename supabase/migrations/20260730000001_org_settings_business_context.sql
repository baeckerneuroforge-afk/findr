-- Org-Profil-Kontext (E3, Leitfaden-Spezifität 2026-07-02):
-- Einmalig pro Organisation gepflegter Unternehmens-/Produkt-Kontext
-- (Settings → Organisation). Der Studien-Wizard prefillt damit das
-- Kontextfeld jeder neuen Studie (editierbar; die Studie überschreibt die
-- Org). Gelesen/geschrieben NUR über die isolierten Getter/Setter in
-- src/lib/settings/org-settings.ts (getOrgBusinessContext /
-- setOrgBusinessContext) — bewusst getrennt von getOrgSettings, damit ein
-- Pre-Migration-Read die bestehenden Settings-Selects nicht kippen kann
-- (gleiche Begründung wie interview_retention_days).
--
-- Nullable, kein DEFAULT, kein Backfill. App-Cap 2000 Zeichen (eine Zahl
-- end-to-end mit research_plans.business_context).
alter table org_settings
  add column if not exists business_context text;

comment on column org_settings.business_context is
  'Org-weiter Unternehmens-/Produkt-Kontext (Freitext, App-Cap 2000). Prefill für das Studien-Kontextfeld im Wizard; NULL = unset.';
