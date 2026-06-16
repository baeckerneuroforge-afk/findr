# Plan: Zwei unbounded Queries entschärfen (Health-Scores + Deal-Calls)

**Datum:** 2026-06-16 · **Status:** PLAN, nichts umgesetzt · **Branch-Vorschlag:** je ein eigener Worktree/Feature pro Track

Zwei Reads skalieren mit der Zeit/Datenmenge statt mit dem Bedarf. Beide sind **kein** Haupt-Engpass fürs „flüssige" Gefühl (das bleibt LLM-Latenz), aber echte **Kosten-/Skalierungs-Lecks**, die zwangsläufig schlechter werden. Reihenfolge-Empfehlung: **Track A zuerst** (niedriges Risiko, quasi mechanisch), **Track B danach** (mehr Arbeit + eine UX-Entscheidung).

---

## Track A — Health-Scores: „latest pro Account" als DB-RPC

### Problem
[`getLatestHealthScoresForAccounts`](../src/lib/accounts/health-service.ts) holt **alle** `account_health_scores`-Zeilen der angefragten Accounts (`select("*") … order analyzed_at desc`) und behält in JS pro Account die neueste. Die täglichen Check-in/Reanalyze-Crons schreiben **pro Account pro Lauf eine neue Zeile** → gelesene Zeilen wachsen mit `Accounts × Tage-Historie`, ~99 % davon weggeworfen. Betrifft `/dashboard/health` und `/dashboard/accounts`.

### Lösung
Exakt der schon bewährte Risk-Fix spiegeln: eine Postgres-`DISTINCT ON`-RPC, die **eine** neueste Zeile pro Account direkt in der DB liefert. Vorlage: `get_latest_risk_scores_for_deals` ([Migration 20260710000000](../supabase/migrations/20260710000000_get_latest_risk_scores_fn.sql), [risk/service.ts:102](../src/lib/risk/service.ts)).

**Warum risikoarm:**
- `account_id` ist **TEXT** (Parität zu `risk_scores.deal_id`) → Param ist `text[]`.
- `analyzed_at` ist nullable → `nulls last` (wie beim Risk-Fix).
- **Kein neuer Index nötig:** `account_health_scores_account_idx on (org_id, account_id, analyzed_at desc)` ([20260604000000:47](../supabase/migrations/20260604000000_account_health.sql)) deckt `DISTINCT ON (account_id) … ORDER BY account_id, analyzed_at DESC` bei fixem `org_id` exakt ab. (Health ist sogar besser indiziert als Risk.)
- RPC liefert `setof account_health_scores` (volle Zeile) → der `toRecord`-Mapper bleibt **unverändert**, alle `signals`-JSONB-Felder (`.type/.confidence/.quotes`) reisen intakt mit.
- Beide Call-Sites bleiben unberührt: der Vertrag `Map<account_id, HealthScoreRecord>` ist identisch.

### 3 koordinierte Edits

**1. Neue Migration** `supabase/migrations/20260716000003_get_latest_health_scores_fn.sql`

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Perf — neuester account_health_score pro Account ohne die volle Historie.
--
-- getLatestHealthScoresForAccounts (src/lib/accounts/health-service.ts) holte
-- bisher JEDE Zeile der angefragten Accounts und dedupte in JS. Die täglichen
-- Check-in/Reanalyze-Crons hängen pro Account pro Lauf eine Zeile an → der Read
-- wächst unbegrenzt auf /dashboard/health und /dashboard/accounts. DISTINCT ON
-- liefert genau eine (neueste) Zeile pro Account direkt in der DB.
--
-- Spiegelt get_latest_risk_scores_for_deals (20260710000000). account_id ist
-- TEXT → p_account_ids text[]. analyzed_at ist nullable → `nulls last`. Der
-- bestehende Index account_health_scores_account_idx (org_id, account_id,
-- analyzed_at desc) bedient DISTINCT ON/ORDER BY bereits — KEIN neuer Index.
--
-- SECURITY INVOKER (Default): wird nur über den service-role Admin-Client
-- aufgerufen (umgeht RLS); auf service_role gesperrt, damit die Funktion NICHT
-- auf der anon/authenticated PostgREST-RPC-Fläche liegt. Der Body filtert
-- weiterhin nach p_org_id, weil service-role die RLS-Policy umgeht.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function get_latest_health_scores_for_accounts(
  p_org_id uuid,
  p_account_ids text[]
)
returns setof account_health_scores
language sql
stable
security invoker
set search_path = 'public'
as $$
  select distinct on (account_id) *
  from account_health_scores
  where org_id = p_org_id
    and account_id = any(p_account_ids)
  order by account_id, analyzed_at desc nulls last;
$$;

revoke all on function get_latest_health_scores_for_accounts(uuid, text[])
  from public, anon, authenticated;
grant execute on function get_latest_health_scores_for_accounts(uuid, text[])
  to service_role;

notify pgrst, 'reload schema';
```

> Hinweis: `set search_path = 'public'` ist von Anfang an drin (der Risk-Fix bekam das erst per Nachzügler-Hardening 20260613000000; die neueste Read-RPC `list_sessions_for_plan` macht es schon so). `revoke … from public, anon, authenticated` muss anon+authenticated **explizit** nennen (Supabase grantet ihnen sonst direkt EXECUTE → stille Lücke).

**2. Service** [`src/lib/accounts/health-service.ts`](../src/lib/accounts/health-service.ts) — nur den Query-Chain-Teil tauschen, `toRecord` bleibt:

```ts
// vorher: .from("account_health_scores").select("*").eq(...).in(...).order(...)
//         + JS-Dedup mit if(!latest.has(...))
// nachher:
const { data, error } = await supabase.rpc(
  "get_latest_health_scores_for_accounts",
  { p_org_id: orgId, p_account_ids: accountIds },
);

if (error || !data) return new Map();

const latest = new Map<string, HealthScoreRecord>();
for (const row of data as unknown as HealthRow[]) {
  latest.set(row.account_id, toRecord(row)); // DISTINCT ON → 1 Zeile/Account, kein has()-Guard mehr nötig
}
return latest;
```

Die `if (accountIds.length === 0) return new Map();`-Frühausfahrt bleibt (spart einen sinnlosen RPC).

**3. Typen** [`src/types/database.ts`](../src/types/database.ts) Functions-Block (hand-gepflegt!) — Eintrag ergänzen, sonst ist `.rpc(...)` ein TS-Fehler:

```ts
get_latest_health_scores_for_accounts: {
  Args: { p_org_id: string; p_account_ids: string[] }
  Returns: Json
}
```

### Verifikation
- `pnpm exec tsc --noEmit` + `pnpm exec eslint …` grün.
- `execute_sql` (Supabase-MCP) auf einer Branch/lesend: RPC-Resultat gegen den alten JS-Dedup für eine Test-Org vergleichen (gleiche Zeilen, gleiche `analyzed_at`-Auswahl).
- `get_advisors` nach Apply (Security/Perf-Lint) — keine Regression.
- Bestehende Health/Accounts-Tests + ggf. ein fokussierter Service-Test (Mock-RPC) im Muster von [`risk/service`-Tests](../src/lib/risk).

### Rollout (Sequenz wichtig)
1. Migration **zuerst** in Prod anwenden (Supabase-MCP `apply_migration`; vorher `list_tables`, nachher `get_advisors`).
2. **Dann** den Code (Service + database.ts) deployen. Reihenfolge zählt: der Code ruft den RPC — der muss vorher existieren. (Dokumentierte Lehre: Migration vor Push.)

### Risiko: **niedrig.** Quasi-mechanischer Spiegel eines bereits live bewährten Fixes; kein Index, kein Datenmodell-Change, Call-Sites unberührt.

---

## Track B — Deal-Calls: Payload kappen ohne die Analyse-Pipelines zu brechen

### Problem
[`getCallsByDealId`](../src/lib/calls/service.ts) lädt **jeden** Call eines Deals samt `transcript` (Volltext) + `transcript_summary` + `call_speakers(*)` + `transcript_segments(*)` (oft hunderte Segment-Zeilen/Call), **ohne Limit**. Auf [`deals/[id]/page.tsx:224`](../src/app/(app)/(dashboard)/dashboard/deals/[id]/page.tsx) wird **alles eager gerendert** (`calls.map(... <CallDetail call={call}/>)`) → jedes Segment jedes Calls landet im RSC-Payload. Das ist die größte Einzel-Datenmenge der App und wächst mit der Call-Zahl je Deal.

### Die Falle (warum kein simples `.limit()`)
`getCallsByDealId` hat **7 Caller**, davon **6 server-seitige Pipelines, die die volle Historie + schwere Joins brauchen:**

| Caller | Braucht |
|---|---|
| `deals/[id]/page.tsx:77` (UI) | nur Anzeige — **das ist das Ziel** |
| `api/risk/route.ts` + `voice/router.ts` | Risk-Scoring über **gesamte** Deal-Historie |
| `lib/solution/service.ts` | `buildTranscript(calls)` über alle Calls |
| `lib/loss/service.ts` | Segment-Mapping über alle Calls |
| `api/cron/reanalyze/route.ts` | Detector-Input über alle Calls |
| `api/solution/[dealId]/pdf` | `calls.length` + erster Call |

→ **`getCallsByDealId` NICHT anfassen/cappen** — das würde stillschweigend Risk/Solution/Loss/Voice/Cron/PDF korrumpieren. Nur der **Seiten-Read** wird verschlankt.

### Lösung (empfohlen): List-then-Detail-on-Demand
Spiegelt das Muster, das die Account-Seite via [`getCallsByAccountId`](../src/lib/calls/service.ts) (schon schlank) bereits nutzt.

**B1 — Schlanke Listen-Funktion** (neu, lässt die schwere Funktion unangetastet):
```ts
// nur die Spalten, die die Liste/Kopfzeile braucht — KEINE segments/speakers/transcript
export async function getCallSummariesByDealId(orgId, dealId, limit?) :
  Promise<DealCallSummary[]>  // {id, call_type, duration_seconds, recorded_at, transcript_summary}
// optional .limit(limit) / .range(...) für „neueste N"
```

**B2 — Detail on demand über die schon vorhandene, ungenutzte `getCallById`**
[`getCallById(orgId, callId)`](../src/lib/calls/service.ts:99) existiert bereits mit exakt dem schweren Select — **0 Caller**. Beim Aufklappen eines Calls lädt eine dünne Server-Action/Route genau diesen einen Call (segments+speakers+transcript). → Payload pro Seitenaufruf: von „alle Segmente aller Calls" auf „Zusammenfassungen + 1 Call bei Bedarf".

**B3 — Echte Gesamtzahl separat zählen**
`calls.length` wird sichtbar genutzt (Überschrift `callHistory`, `RiskSignalDrilldown sourceCallCount`, PDF `totalCalls`). Bei gekappter Liste eine **COUNT-Query** ergänzen (Muster: `getAccountTranscriptCount`) → `getDealCallCount(orgId, dealId)`, sonst unterzählt die Anzeige.

**Betroffene Dateien:** `src/lib/calls/service.ts` (neue Lean-Fn + COUNT, `getCallById` wiederverwenden), `deals/[id]/page.tsx` (Lean-Liste + Count), `CallDetail.tsx` (Body lädt on demand statt eager) — plus ggf. eine kleine Route/Server-Action fürs Nachladen.

### Offene Produkt-Entscheidung (brauche ich von dir)
Track B impliziert eine **UX-Änderung**: Calls starten eingeklappt und laden Transkript/Segmente beim Aufklappen (statt alle sofort sichtbar). Zwei Varianten:

- **Variante 1 — „Detail-on-Demand" (empfohlen, größter Gewinn):** Liste = nur Zusammenfassungen aller Calls; Klick lädt den vollen Call. Maximale Payload-Reduktion, aber Calls sind erst nach Klick im Volltext da.
- **Variante 2 — „Recent N eager + Rest nachladen" (kleinerer Eingriff):** die neuesten N Calls voll rendern wie heute, ältere per „mehr laden". Weniger UX-Bruch, aber bei Deals mit vielen langen Calls weiterhin großer Initial-Payload.

### Verifikation
- tsc/eslint/`next build` grün; Parität: die 6 Pipeline-Caller bleiben byte-identisch (lesen weiter `getCallsByDealId`).
- Manuell: Deal mit mehreren Calls — Liste lädt schnell, Count stimmt, Aufklappen lädt Detail, Risk/Solution/PDF unverändert.

### Risiko: **mittel.** Kein DB-Migrationszwang, aber Eingriff in eine Client-Komponente + neue Nachlade-Route + UX-Änderung; mehrere Caller müssen sauber getrennt bleiben.

---

## Empfohlene Reihenfolge
1. **Track A** (eigener Worktree): klein, risikoarm, sofortiger Skalierungs-Gewinn auf 2 Dashboard-Seiten. Migration → verifizieren → Code → Push (Merge+Push zusammen).
2. **Track B** (separat, nach deiner Variante-1/2-Entscheidung): größerer, UX-relevanter Umbau.

## Erwartetes Ergebnis (Zusammenfassung)
| | vorher | nachher |
|---|---|---|
| **Health-Read** | `O(Accounts × Tage-Historie)` Zeilen, JS-Dedup | `O(Accounts)` Zeilen, 1 indizierte DB-Query, kein Index-Add, Call-Sites unverändert |
| **Deal-Calls-Payload** | alle Segmente aller Calls eager im RSC-Payload | Zusammenfassungen + 1 Call on demand; Analyse-Pipelines unverändert; echte Count-Query |
