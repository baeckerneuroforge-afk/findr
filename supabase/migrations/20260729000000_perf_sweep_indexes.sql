-- Perf-Audit 2026-07-01 (Paket E1): Indizes für die GLOBALEN Retention-/Abandon-
-- Sweeps des nightly Crons (/api/cron/retention). Alle bestehenden Indizes der
-- betroffenen Tabellen führen mit org_id — die Sweeps filtern aber global
-- (ohne org_id) über status/Zeitspalten und liefen deshalb als Seq-Scan über
-- die größte Tabelle (interview_sessions inkl. conversation-JSONB-Rows).
--
-- Rein additiv, keine Verhaltensänderung. Die Konsoul-Tabellen sind mit
-- to_regclass geguardet: in Umgebungen, in denen ihre Feature-Migration noch
-- nicht angewandt ist, ist dieser Teil ein No-Op (der Cron toleriert fehlende
-- Relationen dort ebenfalls via isMissingRelation).

-- F7-Abandon-Sweep: status='open' AND created_at < cutoff.
-- Partial Index: 'open' ist ein kleiner, wandernder Ausschnitt der Tabelle —
-- der Index bleibt winzig und deckt exakt das Sweep-Prädikat.
create index if not exists interview_sessions_open_created_idx
  on public.interview_sessions (created_at)
  where status = 'open';

do $$
begin
  if to_regclass('public.konsoul_action_log') is not null then
    -- Retention-Sweep: proposed_at < cutoff (global, ohne org_id).
    create index if not exists konsoul_action_log_proposed_idx
      on public.konsoul_action_log (proposed_at);
  end if;

  if to_regclass('public.konsoul_threads') is not null then
    -- Retention-Sweep: updated_at < cutoff (Clock = letzte Aktivität).
    create index if not exists konsoul_threads_updated_idx
      on public.konsoul_threads (updated_at);
  end if;

  if to_regclass('public.konsoul_metrics') is not null then
    -- Retention-Sweep: occurred_at < cutoff.
    create index if not exists konsoul_metrics_occurred_idx
      on public.konsoul_metrics (occurred_at);
  end if;
end $$;
