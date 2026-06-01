-- Phase M0 (Market Research als eigener Bereich) — study_type-Diskriminator.
--
-- Siehe docs/findr-market-research-separation-plan.md §5 (Mittelweg, Phase M0)
-- und §8 (Timing). KERN-ENTSCHEIDUNG: KEIN eigenes Schema. Die geteilte Tabelle
-- product_discovery_insights bleibt die gemeinsame Basis; Market Research wird
-- ein ADDITIVER Diskriminator auf research_plans + eigener Markt-Prompt +
-- eigenes Kategorien-Set — NICHT eine zweite Tabelle, NICHT eine zweite
-- Synthese-Engine, NICHT ein zweiter Cross-Study-Pfad.
--
-- Diese Migration legt NUR die Diskriminator-Spalte an (M0 = reines
-- Daten-/Typ-Fundament). NICHTS wird scharf geschaltet: kein bestehender
-- Extraktions-/Synthese-/Cross-Study-Pfad liest study_type. Das Markt-Prompt-
-- und Kategorien-Set (TS-Konstanten) sind definiert, aber NICHT verdrahtet
-- (das ist M1/M2). Die Erlebnis-/UI-Trennung ist M3.
--
-- ADDITIV & BACKFILL-FREI: ein einziges `add column if not exists` mit
-- NOT NULL DEFAULT 'product_discovery'. KEINE Änderung an einer bestehenden
-- Spalte, KEIN ALTER an einem Bestands-CHECK. Idempotent.
--
-- BYTE-IDENTISCHES BESTANDSVERHALTEN: Jeder vor dieser Migration angelegte Plan
-- erhält durch den DEFAULT automatisch study_type = 'product_discovery' und
-- verhält sich exakt wie heute. Es gibt keinen separaten Backfill-Schritt — der
-- Spalten-DEFAULT IST der Backfill für alle Bestandszeilen. Spiegelt die
-- least-breaking-Philosophie von accounts.value_type (20260625000000) und
-- research_plans.screening_questions (20260628000000).
--
-- RLS: study_type ist eine neue Spalte auf der bestehenden Tabelle
-- research_plans. RLS ist row-level — die bestehende
-- research_plans_org_isolation-Policy (org_id = current_org_id(),
-- 20260611000000) regelt Lese-/Schreibzugriffe dieser Spalte bereits. Keine
-- neue Policy nötig.

-- ── Die Spalte ──────────────────────────────────────────────────────────────
-- NOT NULL mit DEFAULT 'product_discovery', damit JEDE bestehende Zeile ihre
-- heutige Bedeutung behält (alle Bestandspläne sind Product Discovery). Der
-- CHECK spiegelt den status-/value_type-CHECK-Stil dieser bzw. der accounts-
-- Tabelle. Erweiterung um weitere Studientypen ist später ein additiver
-- CHECK-Tausch (drop + re-add), keine Datenmigration.
alter table research_plans
  add column if not exists study_type text not null default 'product_discovery'
    check (study_type in ('product_discovery', 'market_research'));

notify pgrst, 'reload schema';
