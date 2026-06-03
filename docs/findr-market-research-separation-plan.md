# Market Research als eigener Bereich? — Trennungs-Plan (ehrlich abwägend)

> **Status:** reiner Plan, kein Code. Am echten Code gegroundet (HEAD `f8127b6`, alles auf `main`).
> **Frage:** Braucht „Market Research" getrennte **DATEN** (eigenes Schema) — oder nur ein getrenntes
> **ERLEBNIS** (eigener UI-Bereich + Diskriminator auf derselben Engine)?
> **Timing-Rahmen:** Onboardings in wenigen Tagen. Die Kernmodule (Extraktion, Synthese,
> Cross-Study, Session-Orchestrierung) sind LIVE und eval-verifiziert.

---

## 0. TL;DR — Empfehlung zuerst

**Deine These „Market Research und Product Discovery produzieren fundamental unterschiedliche Datentypen
→ eigenes Schema" hält am echten Code NICHT auf der Struktur-Ebene.** Sie hält auf der **Analyse-Linsen-Ebene**
(Ebene 2) — und zwar stärker, als ein bloßes `study_type`-Label abdeckt, weil der heutige Extraktions-Prompt
das Markt-Signal *aktiv wegwirft*. Aber das ist ein **Prompt-/Vokabular-Problem, kein Schema-Problem**.

- Die **Speicher-Struktur** von `product_discovery_insights` ist ein **generischer qualitativer Coding-Container**
  (kodierte Items `{category, title, description, intensity, confidence, evidence[]}` + Themen-Clustering +
  Summary + Sentiment + Respondent-Demografie + `plan_id`). Diese Form trägt Market-Research-Interviews
  **ohne Schema-Migration**.
- Die **Synthese-Engine** ist bereits **typ-agnostisch** (emergente Themen + Spannungen + Frequenz über
  Interviews — nicht an Feature/Pain gekoppelt; `synthesis/prompts.ts:57-61`).
- **B2B-spezifisch** sind nur drei Schichten, alle additiv parametrisierbar: (a) der Extraktions-Prompt,
  (b) die Kategorien-Enums, (c) die Spaltennamen `feature_requests`/`pain_points`.

→ **Empfehlung: Mittelweg = „Weg A+".** Erlebnis-Trennung (eigener Sidebar-Bereich + Kampagnen-Flow +
`study_type`-Diskriminator + Ziel-Pool-Fortschritt) **auf der geteilten Engine**, plus eine **dünne, additive
Daten-Erweiterung** (eigener Market-Research-Prompt + eigenes Kategorien-Set, optional **eine** additive
JSONB-Spalte) — **kein** zweites Schema, **keine** zweite Synthese-Tabelle, **keine** Cross-Study-UNION.

**Weg B (tiefes eigenes Schema)** ist NICHT gerechtfertigt: hohe Blast-Radius über 7+ Live-Module + 5 Routen,
und der gefährlichste Bruch ist **leises Verschwinden** von Studien aus Cross-Study/Mission-Control
(eine Korrektheits-Regression, die „grün aussieht").

**Vor Onboarding nötig: NICHTS.** Kein Anfassen der Live-Kernmodule. Alles unten ist Post-Onboarding und additiv.
Die einzige echte Schwachstelle heute (KPI-Kontamination der PD-Übersicht) ist ein WHERE-Filter, kein Refactor.

---

## 1. Was die Engine HEUTE konkret produziert (die echten Felder)

`product_discovery_insights` — eine Zeile pro analysiertem Call. Spalten (mit Migration-Quelle):

| Spalte | Typ | Quelle |
|---|---|---|
| `id`, `org_id`, `created_at`, `analyzed_at` | infra | `20260609000000_product_discovery_insights.sql:20-44` |
| `source_call_id` | FK→`calls` CASCADE | `…:26` |
| `deal_id` (TEXT), `account_id` (FK→`accounts`) | CRM-Anker (XOR, oder beide NULL) | `…:31-32`, retyped `20260610000000:30,33` |
| `feature_requests` | jsonb `[]` | `…:33` |
| `pain_points` | jsonb `[]` | `…:34` |
| `themes` | jsonb `[]` | `…:35` |
| `summary` | text | `…:36` |
| `analysis_method` | `ai`\|`heuristic` | `…:41` |
| `respondent_role` | text, null | `20260616000000_…_respondent_context.sql:20` |
| `respondent_segment` | text, null | `…:23` |
| `sentiment` | `positive`\|`neutral`\|`negative`\|`mixed` | `…:36` |
| `plan_id` | FK→`research_plans` SET NULL, null | `…:46` |
| `respondent_source` | `ai`\|`screening` (heute immer `ai`) | `…:59` |

Was `analyzeProductDiscovery` extrahiert (Zod-Emit-Shape, `src/lib/schemas/product-discovery.ts:282-313`):

- `featureRequests[]` (max 15) — `{category(enum 9), title, description, intensity, confidence, evidence[]}`
- `painPoints[]` (max 15) — `{category(enum 9), title, description, severity, confidence, evidence[]}`
- `themes[]` (max 8) — `{label, summary, relatedFeatureRequestIndices[], relatedPainPointIndices[]}` (nur Clustering, nie neuer Inhalt)
- `summary`, `respondentRole`, `respondentSegment`, `sentiment`

Die **Kategorien** (`product-discovery.ts:30-54`) sind eine **SaaS-Produkt-Taxonomie**:
- Feature: `NEW_CAPABILITY · ENHANCEMENT · INTEGRATION · UI_UX · AUTOMATION · REPORTING · PERFORMANCE · MOBILE · API`
- Pain: `BUG · MISSING_FEATURE · UX_FRICTION · PERFORMANCE_ISSUE · RELIABILITY · ONBOARDING · DATA_QUALITY · INTEGRATION_GAP · SUPPORT`
- `intensity/severity`-Stufe `blocker` = explizite **Vertrags-/Renewal-Stop-Bedingung** (`product-discovery.ts:60-63`; `prompts.ts:102`).

Der **Extraktions-Prompt** ist hart B2B-produktgeframt (`src/lib/product-discovery/prompts.ts:45-52`):
„*senior B2B SaaS Product Discovery analyst extracting actionable PRODUCT FEEDBACK*", „*report ONLY what
the customer actually SAID about the product*". Und — entscheidend — er **verwirft aktiv** (`prompts.ts:107-113`):
> *„Commercial topics: pricing, contract terms, billing, renewal mechanics, discounts — not product feedback. Skip."*
> *„Wishes about a COMPETITOR'S product … Otherwise skip."*
> *„General product praise … that is HEALTH signal … Skip."*

Das ist **genau das Signal, das eine Markt-Studie behalten WILL.** Hier sitzt der eigentliche Unterschied — nicht im Schema.

---

## 2. Die Drei-Ebenen-Analyse (präzise, nicht vage)

### Ebene 1 — Anderer Zweck/Kontext (B2C vs B2B)? → **JA, aber trivial lösbar**
Market Research = anonymer Markt-Outreach (B2C/Markt), Product Discovery = eigene Kunden (B2B, CS-Health-gekoppelt).
Das ist real, aber allein mit **`study_type`-Feld + anderem Agenten-Script** gelöst — **keine** getrennten Daten nötig.
Belege, dass es heute schon „nur ein Plan-Typ mehr" wäre: `research_plans` hat **keinen** Typ/Bereich-Diskriminator
und **keinen** Account-FK (`20260611000000_research_layer.sql`), `plan_id` ist generisch „welche Studie".

### Ebene 2 — Andere Analyse-Linse? → **JA, und das ist mehr als ein Label**
Market Research will **andere Erkenntnis-Typen** als Feature-Requests/Pain-Points. Konkrete Divergenz:

**Was Market Research braucht — und die B2B-Extraktion NICHT liefert (sondern wegwirft):**
| Markt-Erkenntnis | Heutiger Status |
|---|---|
| Preis-Sensitivität / Zahlungsbereitschaft | **verworfen** (`prompts.ts:109` „pricing … Skip") |
| Wettbewerbs-Wahrnehmung / Positionierung | **verworfen** (`prompts.ts:111` „competitor's product … skip") |
| Kaufabsicht / Consideration / Kauf-Trigger | keine Kategorie |
| Markt-Segmente / unerfüllte Marktbedürfnisse (Population, nicht Produkt-Feature) | nicht modelliert |
| Allgemeine Einstellung / Markenwahrnehmung | als „Health-Signal" **verworfen** (`prompts.ts:108`) |
| Prämisse: Respondent **nutzt** bereits ein Produkt | hart angenommen (`prompts.ts:48` „about the product") — B2C-Markt-Respondent hat oft gar keine Produkt-Beziehung |

**Was B2B-Discovery hat — und Market Research NICHT braucht:**
- `feature_requests` mit SaaS-Taxonomie (9 Enums), `pain_points` mit Produkt-Friction-Taxonomie (9 Enums)
- `blocker`-Severity als Vertrags-Stop (`prompts.ts:102`)
- `deal_id`/`account_id` CRM-Verankerung

**ABER — braucht das andere FELDER/SYNTHESE, oder anderen PROMPT?** Antwort am Code: **anderer Prompt + anderes
Vokabular, NICHT andere Struktur.** Denn jede Markt-Erkenntnis landet weiterhin als
`{category(enum), title, description, intensity, confidence, evidence[]}` — ein **umbenanntes Enum**, kein neuer
Spaltentyp. Beispiel: „hohe Preis-Sensitivität, würde max. 20 €/Monat zahlen" = ein kodiertes Item mit
`category=PRICE_SENSITIVITY`, Evidenz-Quote, Confidence. Die generischen Felder tragen das (Grounding-Verdict:
„*SAME shape, different purpose/audience*").

### Ebene 3 — Fundamental andere Datenstruktur? → **NEIN**
Keine neuen Entitäten, keine neuen Beziehungen, keine andere Synthese-Logik:
- **Synthese ist bereits typ-agnostisch:** `STUDY_SYNTHESIS_SYSTEM_PROMPT` (`synthesis/prompts.ts:57-61`) sucht
  „*what is true ACROSS interviews — emergent themes and real tensions*" mit Frequenz — das funktioniert für
  jede qualitative Studie. Output-Schema = `emergent_themes` + `tensions` + `overview` (`synthesis/service.ts:47-48`),
  nirgends an Feature/Pain gekoppelt.
- **Respondent-Demografie existiert schon** generisch (`respondent_role`/`respondent_segment` — B2C würde
  „Elternteil, urban" statt „Head of Ops" eintragen).
- **Sentiment** (`positive|neutral|negative|mixed`) ist ein Lehrbuch-Markt-/CX-Konstrukt, schon vorhanden.
- **`plan_id`-Synthese** ist pro-Studie partitioniert (`study_synthesis` UNIQUE `org_id+plan_id`,
  `20260617000000_study_synthesis.sql:62`) — eine Markt-Studie ist einfach eine weitere `plan_id`.

**Einzige strukturelle Unsauberkeit:** die Spaltennamen `feature_requests`/`pain_points`. Sie mit
Markt-Erkenntnissen zu füllen wäre semantisch eine „lügende Spalte". Das ist ein **Benennungs-Problem**,
lösbar mit *einer* additiven JSONB-Spalte oder einem generalisierten `coded_findings` — **kein** Grund für ein zweites Schema.

**Befund:** Listen divergieren bei **Vokabular & Prompt** (Ebene 2), nicht bei **Struktur** (Ebene 3).
→ `study_type` + Markt-Prompt/Kategorien + UI-Trennung (+ optional 1 additive Spalte) reicht. **Getrennte Daten sind nicht erzwungen.**

---

## 3. Weg A — Erlebnis-Trennung (auf der geteilten Engine)

**Was existiert schon (Wiederverwendung, kein Neubau):**
- `research_plans` + `sample_target` (Ziel-Größe, s. §5) — `20260611000000_research_layer.sql:42`
- Offener Link end-to-end: `OpenLinkPanel`, `research_open_links`, Screening-Gate, `max_sessions`-Cap (E1–E5, alle auf `main`)
- Synthese + Chat-with-Data + Highlight-Reels + Research-Agent (pro Studie)
- Cross-Study/Mission-Control (org-weit über alle Synthesen)
- CS→Research-Brücke (`BridgeSuggestionsPanel`, `cs-to-research.ts`)

**Was neu/gebündelt werden müsste:**
1. **`study_type`-Diskriminator** auf `research_plans` — `text NOT NULL DEFAULT 'product_discovery'`,
   CHECK `('product_discovery','market_research')`. Additiv, **backfill-frei** (alle Bestandszeilen = Default).
2. **Eigener Sidebar-Bereich** „Market Research" (neue Gruppe in `DashboardSidebar.tsx` + `nav-routes.ts` +
   i18n-Keys) — oder als Filter-Tab innerhalb „Research". Reine IA.
3. **Kampagnen-Flow gebündelt** an einem Ort: Topics + Agenten-Script + Screening + offener Link +
   **Ziel-Pool-Größe** + Synthese/Chat/Export — größtenteils Komposition bestehender Panels auf einer neuen Route.
4. **Markt-Research-Prompt + Kategorien-Set** (s. §4-Daten-Erweiterung) — vom `study_type` ausgewählt.
5. **KPI-Entkontaminierung** (s. §6, der eine echte Fix): PD-Übersicht filtert auf Product-Discovery-Zeilen.

**Aufwand:** mittel, fast vollständig **additiv** (neue Route + Panels + 1 Diskriminator-Spalte + Prompt-Set).
**Risiko:** niedrig — die Live-Kernpfade (Extraktion-Transport, Synthese, Cross-Study, Orchestrierung) bleiben unangetastet.

---

## 4. Weg B — Tiefe Daten-Trennung (eigenes Schema) — EHRLICHER Blast-Radius

Wenn Market-Research-Insights in **eigene Tabellen** (`market_research_insights` + `market_research_synthesis`) zögen,
ist **JEDE** dieser Live-Stellen betroffen (Grounding-verifiziert, `eq`-Filter geprüft):

| Stelle | Datei:Zeile | Was bricht |
|---|---|---|
| **Extraktion** | `product-discovery/service.ts:588-615` (`analyzeCallForProductDiscovery`) | Muss verzweigen/duplizieren, um in die neue Tabelle zu schreiben |
| **Insights-Tabelle** | — | Es gibt **keine Partition-Spalte** heute; der Split muss erst einen Diskriminator einführen |
| **Synthese-Read** | `synthesis/engine.ts:453-457` (`eq org_id + plan_id`) | Muss pro Plan-Typ die richtige Insights-Tabelle treffen |
| **Synthese-Upsert** | `synthesis/engine.ts:494-508` (`onConflict org_id,plan_id`) | Muss in die richtige Synthese-Tabelle schreiben |
| **Session-Orchestrierung** | `voice-agent/session-service.ts` → `transcript-service.ts:96` | Finish-Pfad muss zur richtigen Insights-Tabelle routen |
| **Cross-Study / Mission-Control** | `mission-control/engine.ts:344` (`eq org_id` **ONLY**) | **🔴 LEISER Bruch** — siehe unten |
| **Cross-Study-Agent** | `cross-study-agent/tools.ts:200` (erbt `loadOrgSyntheses`) | Erbt denselben leisen Bruch |
| **CS→Risk-Brücke (Bridge #2)** | `bridge/research-to-sales.ts:520` (`eq org_id` **ONLY**) | Zweiter org-weiter Scan — leiser Bruch |
| **`getStudySynthesis`** (5 Konsumenten) | `synthesis/service.ts:61` (`eq org_id + plan_id`) | Markt-Plan-`plan_id` → `null` → „keine Synthese". Fan-out: Research-Agent, Share-Service (public 404!), PDF-, PPTX-Route, Synthese-Seite |
| **Chat-with-Data** | `chat-with-data.ts:600,605` (eigene Inline-Reads) | Umgeht `getStudySynthesis` → **eigener** Routing-Edit nötig |
| **Highlight-Reels** | `highlight-reels.ts:627,632` (eigene Inline-Reads) | Dito — eigener Routing-Edit |
| **„N neue Interviews"-Badge** | `synthesis/service.ts:98` (`countInsightsForPlanSince`) | Bricht für Markt-Pläne |
| **PD-Übersicht** | `product-discovery/page.tsx:302` (`getAllInsightsForOrg`, `eq org_id` only) | Markt-Insights verschwinden (evtl. gewünscht — aber stiller Inhalts-Wechsel) |
| **Deal-/Account-Detail** | `deals/[id]/page.tsx:69`, `accounts/[id]/page.tsx:86` | **Sicher** (call-ID-scoped, lesen nie `study_synthesis`) |

### 🔴 Der gefährlichste Bruch: leises Verschwinden in Cross-Study
`loadOrgSyntheses` (`mission-control/engine.ts:344`) und die Bridge (`research-to-sales.ts:520`) lesen mit
**`eq org_id` ALLEIN** über **eine** `study_synthesis`-Tabelle. Zieht man Markt-Synthesen in eine zweite Tabelle,
liefern beide Aggregatoren **stillschweigend einen verkürzten Satz** — keine Exception, kein Fehler, nur fehlende
Zeilen. Der Anchor-Filter „besteht" weiter auf den verbliebenen Daten → **eine Korrektheits-Regression, die grün aussieht.**

### Cross-Study über ZWEI Schemas — wie ginge das?
Es müsste ein **UNION** beider Synthese-Tabellen (keyed by `plan_id`) **plus** ein gemergter
Per-Study-Anchor-Haystack (`haystackByStudy`) werden. Ein Fix an `loadOrgSyntheses` deckt Mission-Control **und**
Cross-Study-Agent ab (gemeinsamer Seam), aber die Bridge braucht denselben UNION separat. Außerdem
`getStudySynthesis` + Chat-with-Data + Highlight-Reels je eigenes Tabellen-Routing → ein **Plan-Typ-Diskriminator
ist faktisch Pflicht**, damit jeder `plan_id`-Read weiß, welche Tabelle.

**Aufwand:** hoch (7+ Lib-Module + 5 Routen, Mehrtages-Refactor). **Risiko:** hoch, an LIVE eval-verifizierten Modulen.
**Sicherheitsnetz:** die bestehenden Evals (Mission-Control / Cross-Study-Agent / Chat-with-Data / Research-Agent
Anchoring) würden eine UNION-Regression wahrscheinlich fangen — vor Ship zwingend erneut fahren.
**Verdict:** Nicht gerechtfertigt — kein einziger Forcing-Case erzwingt das (s. §6).

---

## 5. Mittelweg = Empfehlung im Detail (gemeinsame Basis + dünne Erweiterung)

Der Clou: **die geteilte Tabelle IST bereits die gemeinsame Basis.** Du musst keinen „shared base + extension"-Bau
machen — die Basis existiert. Die „Erweiterung" ist minimal:

**Phase M0 — Diskriminator (1 additive Spalte, backfill-frei)**
- `research_plans.study_type text NOT NULL DEFAULT 'product_discovery'` (CHECK 2 Werte). Migration additiv, kein Backfill.
- Bestandsverhalten byte-identisch (alle alten Pläne = Product Discovery).

**Phase M1 — Markt-Linse (additiv, kein Tabellen-Bruch)**
- Neues Kategorien-Set (z. B. `PRICE_SENSITIVITY`, `PURCHASE_INTENT`, `COMPETITIVE_PERCEPTION`, `SEGMENT_NEED`,
  `BRAND_ASSOCIATION` …) als eigene Konstanten neben den bestehenden Enums.
- Neuer **Markt-Extraktions-Prompt**, der die heutigen „Skip"-Regeln (`prompts.ts:107-113`) **invertiert**
  (Preis/Wettbewerb/Markt-Bedarf behalten statt verwerfen). Der Classifier nimmt schon einen Prompt entgegen — additiv.
- **Speicher-Entscheidung (Produkt-Call für André):**
  - *(a) günstigste:* dieselben zwei JSONB-Arrays mit `study_type`-abhängigem Kategorien-Enum (milde Namens-Dehnung,
    **null** Migration), oder
  - *(b) sauberste:* **eine** additive JSONB-Spalte `market_findings` (bzw. generalisiertes `coded_findings`),
    nur bei `study_type='market_research'` befüllt (eine additive Spalte, kein Backfill, kein Bruch).
  - **Empfehlung: (b)** — vermeidet die „lügende Spalte" und bleibt trotzdem eine Tabelle/ein Synthese-Pfad.

**Phase M2 — Synthese typ-bewusst (Mini-Edit, kein Strukturwechsel)**
- Synthese bleibt **eine** Tabelle, ein Pfad. Nur der System-Prompt-Persona-Satz optional `study_type`-bewusst
  („Markt-Analyst" statt „B2B-Produkt-Analyst"). Output-Schema unverändert (`emergent_themes/tensions/overview`).
- **Cross-Study/Mission-Control bleibt unberührt** — Markt-Studien sind weitere `plan_id`s in derselben
  `study_synthesis`. **Kein UNION, kein leiser Bruch.** ⇐ der Hauptgewinn ggü. Weg B.

**Phase M3 — Erlebnis (Weg A)**
- Sidebar-Bereich/Tab + gebündelter Kampagnen-Flow + Ziel-Pool-Fortschritt (§6).

**Warum das deine These ehrlich behandelt:** Du hast bei Ebene 2 recht (die Linse ist echt anders, und der heutige
Prompt wirft das Markt-Signal weg). Aber die richtige Antwort darauf ist **Prompt + Vokabular + 1 Spalte**, nicht
ein Parallel-Schema. Der Mittelweg gibt **~90 % des Nutzens für ~10 % des Risikos** von Weg B.

---

## 6. Der EINE echte Defekt heute: KPI-Kontamination (nicht der Schema-Split)

`/dashboard/product-discovery` ruft `getAllInsightsForOrg(orgId)` **ohne Quell-Filter** (`page.tsx:302`,
`service.ts:407-454`) und faltet **jede** Insight — Sales-Deal, CS-Account UND Research-/Walk-in (
`deal_id=null, account_id=null, plan_id=set`) — in dieselben org-weiten KPIs (`page.tsx:322-340`). Ein
Markt-Walk-in-„Blocker" zählt gegen denselben Zähler wie ein zahlender Kunde.

**Fix (Stunden, keine Migration, kein Backfill):** `getAllInsightsForOrg` auf Produkt-Discovery-Zeilen filtern —
der Diskriminator existiert **bereits** auf jeder Zeile: `plan_id IS NULL` (passive Kunden-Calls) vs.
`plan_id IS NOT NULL` (Studie/Walk-in), und es gibt schon den Partial-Index
`product_discovery_insights_org_plan_idx` (`20260616000000:65-67`). Alternativ `calls.source='research'`
(`transcript-service.ts:65-66`). Mit `study_type` (M0) wird der Filter noch sauberer.

> Nebenbefund (kosmetisch, vom selben Filter geheilt): `toRecord`/`source_kind` (`service.ts:241`) berechnet für
> Research-Zeilen `'account'`, weil `deal_id` null ist — Research-Insights „maskieren" als Account-Quelle in
> UIs, die auf `source_kind` bauen.

**Steelman gegen den Schema-Split — kein Forcing-Case übersteht:**
- **PII/Anonymität:** Die Insight-Zeile trägt **keine Identität** (kein Name/Mail/Consent; `service.ts:56-76`);
  `deal_id`/`account_id` sind für **alle** Research+Walk-in-Insights NULL (`transcript-service.ts:62-64`).
  Walk-in ist in der geteilten Tabelle **schon** identitätsfrei. Kein Zwang.
- **Retention/Consent:** Keine Retention-/Consent-Spalte existiert irgendwo; `source_call_id` CASCADE wischt
  abgeleitete Insights schon beim Call-Delete. Ein Split würde keinen Retention-Mechanismus *schaffen*. Kein Zwang.
- **Externes/cross-org-Panel (anderer GDPR-Controller):** der **einzige** echt-getrennte Fall — aber das ist
  **nicht** der heutige offene Link (`research_open_links.org_id` **NOT NULL**, `20260629000000:9-18,35`).
  Es ist die bereits **reservierte** Zukunfts-Schicht mit **nullable `org_id`** (`research_layer.sql:7-18`;
  `respondent_source='screening'` reserviert) — vom Projekt bewusst als **Flag (org_id NULL) + zweite RLS-Policy**
  geplant, **nicht** als Parallel-Tabelle (`study_synthesis.sql:70-73` dokumentiert denselben Plan).

**Verdict:** Kein Live-Fall erzwingt tiefe Daten-Trennung über einen Flag/Filter. Der einzige echte Defekt ist ein WHERE-Filter.

---

## 7. Ziel-Pool-Größe + Fortschritt (Outset-Stil „47 von 200") — additiv

**Wichtige Disambiguierung — es gibt heute DREI „Quota/Target"-Konzepte, das Feature meint das ERSTE:**
1. **`research_plans.sample_target`** (studienweites Ziel „N abgeschlossene Interviews") — **existiert**, voll
   verdrahtet, aber **nur statisch angezeigt**, nie gemessen (`plans-service.ts:33,96`; Detail-Seite
   `[id]/page.tsx:201-214`; Liste `:160`). **Hier bindet „47 von 200".**
2. `listQuotaProgress`/`PlanQuotaPanel`/`research_plan_quotas` — **per-Rolle Pool-Invite-Quoten**; „invited"
   zählt **Pool-Einladungen pro Rolle**, NICHT abgeschlossene Interviews (`participant-pool.ts:434-489`). **Nicht** anfassen.
3. **E5 `max_sessions`-Cap** — link-scoped, **all-status** Spend-Bremse (`open-links.ts:230-257`; Screen-Route `:151-162`).

**Minimaler additiver Bau (kein Migration, rein read-side):**
1. **Keine Migration.** `sample_target` ist bereits die Ziel-Spalte (Kommentar: „Anzahl angestrebter abgeschlossener Interviews").
2. Neue Funktion `countCompletedSessionsForPlan(orgId, planId)` — byte-genauer Klon von `countOpenLinkSessions`
   (`open-links.ts:230-242`), aber: `interview_sessions … .eq("org_id",…).eq("plan_id",…).eq("status","completed")`.
   Nutzt den vorhandenen `interview_sessions_plan_idx`; gibt `number | null` (null→„—", fail-open).
3. In der Detail-Seite (`[id]/page.tsx`, neben dem bestehenden `Promise.all :126-128`) aufrufen und an den
   `sample_target`-Block (`:201-214`) als „47 von 200" geben (nur wenn `sampleTarget !== null`, sonst heutiges „open-ended").
   Optional dünner Fortschrittsbalken (Markup aus `PlanQuotaPanel.tsx:141-146` wiederverwenden).

**Ehrliche Trade-offs:**
- **`completed` vs. `all`:** Fortschritt zählt `status='completed'` (passt zur Bedeutung von `sample_target`); der E5-Cap
  zählt bewusst **alle** Sessions (Spend-Schutz). → Zähler ≠ Cap-Nenner, **mit Absicht** — ein Kommentar verhindert,
  dass das jemand „vereinheitlicht" und den Cap kaputtmacht.
- **Scope:** Zählung per `plan_id` aggregiert Invite- **und** Walk-in-Sessions zu einer studienweiten Zahl — genau
  was „47 von 200" will. Überlappt **nicht** mit (2)/(3).
- **Verworfen:** neues `target_sessions` am offenen Link — dupliziert `sample_target`, deckt Invite-Studien nicht ab,
  verletzt die additiv/keine-Parallel-Pfade-Regel.

**Unabhängig von der Trennungs-Frage — kann jederzeit shippen, niedriges Risiko.**

---

## 8. Timing & Phasen — was VOR Onboarding (Antwort: nichts)

| Phase | Inhalt | Risiko | Wann |
|---|---|---|---|
| — | **Nichts an Live-Kernmodulen anfassen** | — | **vor Onboarding** |
| (optional) Ziel-Pool §7 | `countCompletedSessionsForPlan` + Anzeige | niedrig (read-side, additiv) | jederzeit, gern vor Onboarding wenn gewünscht |
| KPI-Fix §6 | `getAllInsightsForOrg` Quell-Filter | niedrig (WHERE) | **nach** Onboarding (heute eher kosmetisch) |
| M0 | `study_type`-Spalte | niedrig (additiv, backfill-frei) | nach Onboarding |
| M1 | Markt-Prompt + Kategorien (+ optional 1 JSONB-Spalte) | niedrig–mittel (additiv) | nach Onboarding |
| M2 | Synthese typ-bewusster Prompt | niedrig | nach Onboarding |
| M3 | Sidebar-Bereich + Kampagnen-Flow | mittel (UI-Komposition) | nach Onboarding |
| Weg B (tiefer Split) | — | **hoch** | **nicht empfohlen**, nur falls externes cross-org-Panel real wird (→ nullable-org-Pfad, nicht Parallel-Schema) |

---

## 9. Offene PRODUKT-Entscheidungen für André (keine Code-Defekte)

1. **Speicher der Markt-Linse:** dieselben JSONB-Arrays mit anderem Enum *(a, billiger)* vs. eine additive
   `coded_findings`/`market_findings`-Spalte *(b, sauberer — empfohlen)*.
2. **IA:** eigener Sidebar-Bereich „Market Research" vs. Filter-Tab innerhalb „Research".
3. **CS→Research-Brücke:** Die churn-getriebenen Pläne sind **interne Kunden-Studien** — sie sollten auf der
   internen/Research-Seite bleiben, nicht unter „Market Research" wandern (sonst Placement-Mismatch; die Brücke
   selbst braucht **keinen** Code-Change, sie ist orthogonal — `cs-to-research.ts`, `research_plans` ohne Typ-FK).
4. **KPI-Semantik:** Soll die PD-Übersicht künftig **nur** Kunden-Calls zählen (empfohlen) — dann §6-Filter setzen.

---

### Ein-Satz-Fazit
Deine These ist halb richtig: die **Analyse-Linse** unterscheidet sich real (und der heutige Prompt wirft das
Markt-Signal weg), aber die **Datenstruktur** tut es nicht — also lös es mit `study_type` + Markt-Prompt/Vokabular
(+ optional einer additiven Spalte) auf der geteilten Engine, **nicht** mit einem zweiten Schema; vor den
Onboardings ist davon **nichts** nötig.
