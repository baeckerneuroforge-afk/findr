-- White-Label (Phase-4-Baustein) — Org-Branding für teilnehmer-/stakeholder-
-- sichtbare Flächen.
--
-- Findr-Kunden (orgs) versehen die NEUTRALEN, extern sichtbaren Flächen mit
-- eigenem Branding: Markenname, Akzentfarbe, Logo. Rein additiv — ohne Branding
-- bleibt das heutige Verhalten exakt erhalten (research = neutral, post_loss =
-- Findr). Die drei Spalten docken an die bestehende org_settings-Tabelle an
-- (eine Zeile/Org, RLS, service-role), exakt wie product_name (20260606000000).
--
-- accent_color ist hex-validiert (CHECK), damit kein freier String als CSS-/
-- HTML-/PDF-Farbe injiziert werden kann. logo_url zeigt auf eine Datei im (unten
-- angelegten) public-read Storage-Bucket 'org-branding'; Uploads laufen
-- server-seitig über den service-role-Client (RLS-bypassing), der Lesepfad
-- (Interview-Seite/Mail/Export) nutzt die öffentliche URL.

alter table org_settings
  add column if not exists brand_name text;

alter table org_settings
  add column if not exists accent_color text;

alter table org_settings
  add column if not exists logo_url text;

-- Akzentfarbe nur als 6-stelliger Hex (#RRGGBB) — verhindert CSS/HTML-Injection
-- über einen freien Farb-String. NULL = nicht gesetzt (Default-Akzent greift).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'org_settings_accent_color_hex'
  ) then
    alter table org_settings
      add constraint org_settings_accent_color_hex
      check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

-- Storage-Bucket für Org-Logos. public-read (die Interview-Seite ist unauth und
-- E-Mail/Export brauchen eine öffentlich erreichbare URL). Schreibzugriff läuft
-- ausschließlich server-seitig über den service-role-Client; deshalb sind hier
-- KEINE storage.objects-Insert-Policies nötig. file_size_limit + allowed_mime_
-- types sind eine bucket-seitige Schranke auf dem deklarierten Content-Type +
-- der Größe (ergänzt, ersetzt aber nicht die App-Validierung in der Route).
-- BEWUSST RASTER-ONLY (kein image/svg+xml): ein public-read SVG würde inline
-- ausgeliefert und könnte aktiven Inhalt (<script>/onload) tragen — die
-- Export-Seite lehnt SVG ohnehin ab, also halten wir den Upload konsistent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-branding',
  'org-branding',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
