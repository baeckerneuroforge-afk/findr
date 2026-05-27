-- Phase 3 — Study-Synthesis-Foundation, Migration 1 of 2.
--
-- Erweitert product_discovery_insights um die respondent- und studien-
-- bezogenen Felder, die die Outset-artige Stage-2-Synthese braucht. Stage 1
-- (der per-call Classifier) befüllt sie ab diesem Commit aus dem Transkript;
-- Stage 2 (cross-call Synthese pro research_plan) folgt in einer parallelen
-- Etappe und liest sie nur.
--
-- WHY HERE (additive auf insights, nicht eine neue respondents-Tabelle)?
-- Der Respondent ist heute IMMER 1:1 an den Call gekoppelt — eine call:1-
-- insight-Beziehung gibt es per source_call_id schon. Eine separate
-- respondents-Tabelle würde nur einen Join erzwingen ohne neues Wissen
-- (ein Call hat genau einen Respondent). Wenn künftig ein Respondent über
-- mehrere Calls auftritt, ist die normalisierende Migration ein 1:1-Lift
-- weg von hier — bis dahin ist embedded billiger und genau so korrekt.
--
-- Idempotent — alle ALTERs sind `add column if not exists`.

alter table product_discovery_insights
  add column if not exists respondent_role text;

alter table product_discovery_insights
  add column if not exists respondent_segment text;

-- sentiment: per-call Tonalität des respondent ÜBER das Produkt (nicht des
-- Gesprächs als Ganzes). Die Werte spiegeln die vier Optset-Buckets:
--   positive — Lob, "wir sind sehr zufrieden", Promoter-tone
--   neutral  — sachlich, weder Lob noch Beschwerde, Default für reine
--              Feature-Discovery-Calls ohne emotionalen Inhalt
--   negative — Klage, Frust, "das ist eine Katastrophe"
--   mixed    — beide Pole sichtbar im selben Gespräch ("super, aber X
--              treibt uns in den Wahnsinn")
-- CHECK-Constraint enforced die vier Werte; NULL ist erlaubt für legacy
-- Zeilen vor dieser Migration. Stage 1 schreibt ab sofort einen Wert.
alter table product_discovery_insights
  add column if not exists sentiment text
    check (sentiment is null or sentiment in ('positive', 'neutral', 'negative', 'mixed'));

-- plan_id: Studien-Bezug. Set NUR bei Calls, die im Rahmen einer
-- research_plans-Studie geführt wurden (research-Flow). Calls die
-- passiv aus dem normalen Sales/CS-Strom geanalysiert werden (deal_id
-- oder account_id, ohne Studie) bleiben hier NULL.
-- ON DELETE SET NULL: ein gelöschter Plan kapt nicht die Insight-Zeile —
-- die Extraktion bleibt erhalten, nur der Studien-Pointer verschwindet.
alter table product_discovery_insights
  add column if not exists plan_id uuid
    references research_plans(id) on delete set null;

-- respondent_source: Wie die respondent_*-Felder befüllt wurden.
--   'ai'        — der Classifier hat sie aus dem Transkript extrahiert (Stage 1).
--   'screening' — sie kamen aus einem Recruiting-/Screening-Schritt (z.B.
--                 künftiger external-Research-Pool, wo ein Teilnehmer sich
--                 vorab als "Founder, B2B SaaS" qualifiziert hat). Heute
--                 nicht verdrahtet, Wert ist reserviert.
-- NOT NULL DEFAULT 'ai': der Backfill für existing rows reflektiert wie
-- diese Daten produziert WURDEN (nämlich AI), nicht was sie heute haben.
-- Neue Zeilen ab heute setzen explizit 'ai' aus dem Classifier-Service.
alter table product_discovery_insights
  add column if not exists respondent_source text not null default 'ai'
    check (respondent_source in ('ai', 'screening'));

-- Index für die Synthese-Abfrage: pro Studie alle Insights einer Org. plan_id
-- ist meist NULL (passive Calls), partial WHERE plan_id IS NOT NULL hält den
-- Index lean — die Stage-2-Synthese filtert sowieso auf gesetzte plan_id.
create index if not exists product_discovery_insights_org_plan_idx
  on product_discovery_insights (org_id, plan_id)
  where plan_id is not null;

notify pgrst, 'reload schema';
