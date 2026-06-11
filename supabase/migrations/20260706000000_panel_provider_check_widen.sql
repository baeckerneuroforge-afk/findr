-- Phase 4 — Baustein 3 (Panel-Anbieter), Etappe E8: Multi-Provider-Vorbereitung.
--
-- Die provider-Spalten von panel_provider_credentials und panel_studies
-- trugen CHECK (provider in ('prolific')) — ein zweiter Anbieter hätte damit
-- IMMER einen Schema-Schnitt gebraucht. E8 weitet das: die CHECKs fallen,
-- die Gültigkeit des Provider-Schlüssels erzwingt ab jetzt die App-Schicht
-- (PanelProviderKey-Union in src/lib/panel/providers.ts + Registry in
-- registry.ts — alle Schreibpfade laufen durch typisierte Service-
-- Funktionen, freie Strings erreichen die Spalte nicht). Ein neuer Anbieter
-- ist damit NUR noch: Union-Eintrag + Provider-Objekt + Registry-Zeile.
--
-- Additiv + idempotent: der DO-Block droppt gezielt CHECK-Constraints
-- (contype 'c') auf den beiden Tabellen, deren Definition die provider-
-- Spalte referenziert — Namen sind auto-generiert und können je nach
-- Anlage-Historie variieren, deshalb Lookup statt hartem Namen. Unique-
-- Constraints (contype 'u') und die status-CHECK der Credentials-Tabelle
-- (referenziert provider nicht) bleiben unberührt.

do $$
declare
  c record;
begin
  for c in
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where contype = 'c'
      and conrelid in (
        'panel_provider_credentials'::regclass,
        'panel_studies'::regclass
      )
      and pg_get_constraintdef(oid) ilike '%provider%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

notify pgrst, 'reload schema';
