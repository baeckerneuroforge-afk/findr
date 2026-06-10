-- Erweiterung des research-stimuli-Buckets um Video-Stimuli (Etappe 3).
--
-- Video-Uploads laufen NICHT durch die Next-Route (4,5-MB-Request-Body-Limit
-- der Vercel-Functions), sondern per createSignedUploadUrl DIREKT in den
-- Bucket. Die Bucket-Limits sind damit die primäre Durchsetzung für MIME und
-- Größe des Videos (die Route sieht die Bytes nie); die Stimulus-Route
-- verifiziert das Objekt nach dem Upload zusätzlich (org/plan-Pfad-Präfix,
-- content_type, Größe), bevor es als Stimulus übernommen wird.
--
-- v1 bewusst NUR video/mp4 (H.264): die Frame-Extraktion passiert clientseitig
-- im Browser, und webm/HEVC sind dort nicht überall dekodierbar (Safari).
-- 100-MB-Cap (Freigabe O1) — gilt bucket-weit; Bilder bleiben über die Route
-- weiterhin auf 4 MB begrenzt (die Route ist der einzige Bild-Schreibpfad).
--
-- UPDATE statt INSERT: die Anlage-Migration (20260703000006) nutzt
-- `on conflict do nothing` — ein erneutes INSERT würde die bestehende Zeile
-- nie ändern.

update storage.buckets
set
  file_size_limit = 104857600, -- 100 MB
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'video/mp4']
where id = 'research-stimuli';

notify pgrst, 'reload schema';
