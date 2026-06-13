-- Perf: list_sessions_for_plan(p_org_id, p_plan_id, p_limit)
--
-- Die MR-Übersicht (30s-Auto-Refresh) lud bisher das VOLLE conversation-JSONB
-- jeder Session, nur um daraus turnCount + eine 140-Zeichen-Vorschau abzuleiten
-- (plans-service.ts: listSessionsForPlan/sessionPreview/coerceConversation).
-- Diese Funktion berechnet beides server-seitig, sodass nur noch die schmalen
-- Felder über die Leitung gehen — nicht die kompletten Transkripte.
--
-- Semantisch äquivalent zur bisherigen JS-Logik (für reine ASCII/BMP-Texte
-- byte-identisch, empirisch über alle Echtdaten-Sessions 0 Abweichungen):
--   turnCount = Anzahl GÜLTIGER Turns = coerceConversation(conv).length
--               (role ∈ {agent,customer} UND text ist ein String; Nicht-Array → 0)
--   preview   = erster customer-Turn mit nicht-leerem, getrimmtem String-Text,
--               getrimmt; bei > 140 Zeichen auf 140 gekürzt + '…'; sonst der Text;
--               kein solcher Turn → NULL
-- Reihenfolge created_at desc, Cap über p_limit (Default 50, = SESSION_LIST_LIMIT).
--
-- BEWUSSTE, MINIMALE ABWEICHUNG bei Nicht-BMP-Zeichen (Emoji): length()/left()
-- zählen Unicode-CODEPOINTS, das alte JS .length/.slice UTF-16-EINHEITEN. Steht
-- ein Emoji in den ersten ~140 Zeichen der ersten Antwort, schneidet die
-- Vorschau ein Zeichen anders — und im Grenzfall liefert diese SQL den SAUBEREN
-- String, während das alte .slice ein Surrogatpaar zerschnitt (kaputtes „�").
-- Also gleichwertig oder besser, nie schlechter. (Ebenso vernachlässigbar:
-- exotische Whitespace U+0085/U+FEFF, in den Prod-Daten 0 Vorkommen.)
--
-- Sicherheit (Lehre aus Audit-Paket 3): SECURITY INVOKER (läuft als der
-- aufrufende service_role-Client, der RLS ohnehin bypassed und org/plan als
-- Parameter filtert), search_path gepinnt, EXECUTE von public/anon/authenticated
-- entzogen — nur service_role darf die Funktion aufrufen.

create or replace function public.list_sessions_for_plan(
  p_org_id uuid,
  p_plan_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  status text,
  mode text,
  created_at timestamptz,
  completed_at timestamptz,
  turn_count integer,
  preview text
)
language sql
stable
security invoker
set search_path = 'public'
as $$
  select
    s.id,
    s.status,
    s.mode,
    s.created_at,
    s.completed_at,
    (
      -- coerceConversation(...).length : nur gültige Turns zählen
      select count(*)::integer
      from jsonb_array_elements(
        case when jsonb_typeof(s.conversation) = 'array'
             then s.conversation else '[]'::jsonb end
      ) as e
      where e ->> 'role' in ('agent', 'customer')
        and jsonb_typeof(e -> 'text') = 'string'
    ) as turn_count,
    (
      -- sessionPreview(...) : erster nicht-leerer customer-Turn, getrimmt + gekürzt
      select case
        when length(q.txt) > 140
          then regexp_replace(left(q.txt, 140), '\s+$', '') || '…'
        else q.txt
      end
      from (
        select regexp_replace(arr.elem ->> 'text', '^\s+|\s+$', '', 'g') as txt
        from jsonb_array_elements(
          case when jsonb_typeof(s.conversation) = 'array'
               then s.conversation else '[]'::jsonb end
        ) with ordinality as arr(elem, ord)
        where arr.elem ->> 'role' = 'customer'
          and jsonb_typeof(arr.elem -> 'text') = 'string'
          and regexp_replace(arr.elem ->> 'text', '^\s+|\s+$', '', 'g') <> ''
        order by arr.ord
        limit 1
      ) as q
    ) as preview
  from public.interview_sessions s
  where s.org_id = p_org_id
    and s.plan_id = p_plan_id
  order by s.created_at desc
  limit p_limit;
$$;

revoke execute on function public.list_sessions_for_plan(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.list_sessions_for_plan(uuid, uuid, integer)
  to service_role;
