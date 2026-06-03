# findr — Performance-Audit (Befund)

> **Status:** Reine Analyse. **Es wurde kein Code verändert.**
> **Datum:** 2026-06-01
> **Methodik:** Multi-Agent-Audit (41 Agenten) über 8 Performance-Dimensionen. Jeder Roh-Fund wurde von einem zweiten, skeptischen Agent gegen den echten Code + Stack-Constraints (Clerk erzwingt Dynamic, next-intl ohne Routing, Supabase, Next 16.2.6) gegengeprüft.
> **Ergebnis:** 33 Roh-Funde → **28 bestätigt, 1 unsicher, 4 widerlegt**. Severities unten sind die **nach Verifikation korrigierten** Werte.
> **Zweck:** Grundlage für einen priorisierten Umsetzungsplan. Noch nichts entschieden, noch nichts angefasst.

## Stack-Kontext (verifiziert)

- Next.js **16.2.6** App Router, React 19.2.4, TypeScript.
- **Clerk** via `clerkMiddleware()` in `src/proxy.ts` (server-seitig, global).
- **next-intl 4.13 ohne Routing** — Locale aus Cookie via `getRequestConfig` (`src/i18n/request.ts:18`).
- **Supabase** mit per-Call Client-Factories.
- **framer-motion 12.39** (in `optimizePackageImports`), `@react-spring/web` installiert (0 Imports), cmdk, geist + next/font, pdfkit + pptxgenjs (server-only Export-Routen), `@anthropic-ai/sdk`.
- Gemessene Baseline: 508 ts/tsx-Dateien, 45 `page.tsx`, 109× `"use client"`, **3 `loading.tsx`**, **1 `Suspense`**, **0 `next/dynamic`**, **0 explizites Link-`prefetch`**.

### Severity- & Aufwands-Legende

- 🔴 **high** · 🟡 **medium** · ⚪️ **low**
- Aufwand: `S` klein · `M` mittel · `L` groß (strukturell/Architektur)

---

## 0. Wurzel-Befund: Das Root-Layout vergiftet den gesamten Marketing-Tree

Fünf separate Funde haben **eine gemeinsame Ursache**: `src/app/layout.tsx` zieht ClerkProvider, einen Cookie-Read, den vollen i18n-Katalog und alle Fonts in ein schweres, dynamisch gerendertes Root-Layout — und der `(marketing)`-Tree erbt das, obwohl er nichts davon nutzt.

| # | Fund | Kosten | Severity | Aufwand |
|---|------|--------|----------|---------|
| 0.1 | `<ClerkProvider>` (Root) shippt Clerk-React-Bindings an Public-Marketing-Seiten, die 0× Clerk nutzen | **~45 KB gz JS** pro Public-Page (~37 % des Homepage-JS = 120,9 KB gz) | 🔴 high | M |
| 0.2 | `getLocale()` liest Cookie im Root-Layout → **gesamter Marketing-Subtree ist `ƒ` dynamisch** (per `pnpm build` verifiziert: alle Marketing-Routen dynamisch, nur `robots.txt`/`sitemap.xml` statisch) | kein CDN-Cache, Function-Cold-Start + voller RSC-Render pro Aufruf auf der höchst-traffic SEO-Fläche; höheres TTFB | 🔴 high | L |
| 0.3 | `NextIntlClientProvider` serialisiert den vollen i18n-Katalog in den RSC-Payload **jeder** Seite | **~23 KB gz / ~70 KB raw** (inkl. 30 KB `research`-Namespace); Marketing braucht 0 Namespaces, Interview nur `interview` (2,8 KB) | 🟡 medium (war high) | M |
| 0.4 | `Bricolage_Grotesque` + `Space_Grotesk` (9 Gewichte) im Root geladen, nur für toten `landing-comic`-Code | 2 unnötige Font-Preloads pro Document, app-weit | ⚪️ low | S |
| 0.5 | `generateStaticParams` + `dynamicParams=false` auf `/insights/[slug]` ist **wirkungslos** (durch 0.2 neutralisiert) | die cachebarsten Seiten (immutable Blog-Artikel) rendern pro Request neu | 🟡 medium | S (folgt aus 0.2) |

**Betroffene Dateien:** `src/app/layout.tsx:25-35,97,101,122-148`, `src/i18n/request.ts:18`, `src/i18n/messages.ts:11`, `src/app/(marketing)/layout.tsx`, `src/app/(marketing)/insights/[slug]/page.tsx:28-36`, `src/app/globals.css:72-73`.

**Wichtige Stack-Nuancen (aus Verifikation):**
- Der **server-seitige** `clerkMiddleware()` (`src/proxy.ts`) ist unabhängig vom **client-seitigen** `ClerkProvider`. ClerkProvider aus dem Root entfernen bricht `auth()` in Dashboard/API **nicht** — der Provider muss nur in den Trees bleiben, die Clerk-Client-Hooks nutzen: `(dashboard)`, `(auth)`, `onboarding`, `shared/synthesis`. **Nicht** in `(marketing)`.
- Der Dynamic-Auslöser für Static-Rendering ist der **Cookie-Read** in `getLocale()`, **nicht** ClerkProvider (Clerk ohne `dynamic`-Prop liest keine Header beim Render).
- framer-motion (siehe 1.3) liegt vermutlich im geteilten Vendor-Chunk → wiederkehrende Dashboard-Nutzer haben ihn gecacht; **kalte** Marketing-Besucher (der Funnel) zahlen voll.

**Fix-Richtung:** Marketing-Subtree vom Root-Layout entkoppeln — eigenes minimales Root-Layout für `(marketing)` (`<html lang="de">` hart, kein ClerkProvider, kein `getLocale()`-Cookie-Read, keine i18n-Provider, nur die wirklich genutzten Fonts). Das löst 0.1–0.5 in einem Zug und aktiviert die bereits vorhandene statische Generierung von `/insights/[slug]`. **Constraint:** Nested Route-Group-Layouts rendern kein eigenes `<html>/<body>` — ein zweites Root-Layout (Multi-Root-Layout-Pattern, in den Next-16-Docs dokumentiert) ist nötig. Dashboard/Interview/Shared bleiben bewusst dynamisch.

---

## 1. Client/Server-Grenze & JS-Bundle

| # | Fund | Severity | Aufwand |
|---|------|----------|---------|
| 1.1 | Clerk-Bindings an Marketing-Pages → siehe **0.1** | 🔴 high | M |
| 1.2 | Voller i18n-Katalog im RSC-Payload jeder Seite → siehe **0.3** | 🟡 medium | M |
| 1.3 | **Volle framer-motion-Engine (38 KB gz) auf allen Marketing-Pages** für 1 Fade + 2 Reduced-Motion-Checks | 🟡 medium | M |
| 1.4 | **cmdk Command-Palette (17,6 KB gz) eager im Dashboard-Shell auf jeder Seite** | 🟡 medium | S |
| 1.5 | 2 ungenutzte Font-Familien für toten Code → siehe **0.4** | ⚪️ low | S |

**1.3 — framer-motion auf Marketing**
`src/components/marketing/Reveal.tsx:3-37` importiert `{ motion }` und rendert eine `motion.div` (whileInView Fade). `StatBand.tsx:4` und `SalesLiveDemo.tsx:4` importieren framer-motion **nur** für `useReducedMotion` (als Boolean). `Reveal` läuft auf 9 von 10 Marketing-Pages. Der `motion`-Proxy zieht das **volle** Feature-Bundle (animations + gestures + drag + **layout-projection/spring**, ~38 KB gz, 53× `projection`-Treffer im Chunk) — viel mehr als ein Fade braucht. `optimizePackageImports` hilft hier nicht (rewrited nur Barrel-Imports, tree-shaked `motion` selbst nicht).
**Fix-Richtung:** `useReducedMotion`-only-Imports durch winzigen `matchMedia`-Hook ersetzen; `Reveal` per `LazyMotion` + `m`-API oder `IntersectionObserver` + CSS-Transition reimplementieren, damit die Projection/Spring-Engine auf Marketing nie lädt.

**1.4 — cmdk eager**
`(dashboard)/layout.tsx` → `DashboardHeader.tsx:4` → `SearchHeaderWidget.tsx:5` → `CommandPalette.tsx:3` (`import { Command } from "cmdk"`). Der cmdk-Chunk (`030j42i…`, 56 KB raw / **17,6 KB gz**, inkl. Radix DismissableLayer/FocusScope) liegt im client-reference-manifest **jeder** Dashboard-Page; `CommandPalette` wird immer gemountet, sichtbar nur bei Cmd+K. Zweitgrößter Shared-Dashboard-Chunk.
**Fix-Richtung:** `CommandPalette` per `next/dynamic({ ssr: false })` in `SearchHeaderWidget` lazy laden (leichten `GlobalSearchTrigger` im statischen Shell lassen). Idealer erster `next/dynamic`-Einsatz (aktuell 0× im Code). Kein SSR-Hydration-Problem, da reine Client-Komponente die zu `document.body` portalt.

---

## 2. Rendering- & Caching-Strategie

| # | Fund | Severity | Aufwand |
|---|------|----------|---------|
| 2.1 | Marketing-Subtree force-dynamic → siehe **0.2** | 🔴 high | L |
| 2.2 | `generateStaticParams` auf `/insights/[slug]` wirkungslos → siehe **0.5** | 🟡 medium | S |
| 2.3 | **Kein Segment-`revalidate` / `cacheComponents` / `use cache` irgendwo** — Dynamik ist all-or-nothing | ⚪️ low | M |

**2.3:** Grep über `src/app` findet keine `export const revalidate`, kein `dynamic`, kein `fetchCache`, kein `"use cache"`, kein `cacheLife`/`cacheTag` (nur `generateStaticParams`/`dynamicParams` auf der insights-Route); `cacheComponents` ist in `next.config.ts` aus. **Wichtig:** `revalidate` als Pflaster würde **nicht** helfen, solange das Root-Layout den Cookie liest (Dynamic-Taint propagiert von oben). Der saubere Weg ist 0.2 (statisch), nicht ISR — Marketing-Content ist build-time-bekannt und DE-only.

---

## 3. Navigation & Übergänge (Hauptanliegen: „flüssiger zwischen Seiten")

| # | Fund | Severity | Aufwand |
|---|------|----------|---------|
| 3.1 | **42 von 45 Seiten ohne `loading.tsx`/`Suspense`** → Content-Bereich friert auf der alten Seite ein, bis voller Server-Render fertig ist | 🟡 medium (war high) | M |
| 3.2 | Link-Prefetch bringt fast nichts ohne Loading-Boundary | ⚪️ low (war medium) | S (folgt aus 3.1) |
| 3.3 | `requireOrgId()` = fixer auth()+DB-Roundtrip vor jeder Navigation | ⚪️ low (war medium) | S |
| 3.4 | `router.refresh()` nach Mutationen re-rendert ganzen Server-Tree | ⚪️ low | M |

**3.1 — der zentrale Navigation-Fund.** Nur `coaching/`, `deals/[id]/`, `forecast/` haben `loading.tsx`; nur die Dashboard-Root nutzt `<Suspense>`. Alle anderen Seiten sind voll-awaited async Server-Components (z. B. `health/page.tsx:108` awaitet `requireOrgId → getAccounts → getRetentionSummary → getLatestHealthScoresForAccounts` bevor JSX zurückkommt). Ohne Segment-`loading.tsx` hat der App-Router keinen Instant-Fallback → Klick auf Sidebar-Link lässt den User auf der alten Seite (bzw. leerem Content-Bereich) für den ganzen Server-Roundtrip + DB-Zeit. **Die Shell (Sidebar/Header) bleibt sichtbar** (Layout ist synchron, kein blocking await) — daher medium statt high, aber genau das „träge"-Gefühl beim Seitenwechsel.
**Betroffen u. a.:** `health`, `accounts`, `accounts/[id]`, `research-plans`, `research-plans/[id]`, `research-plans/[id]/synthesis`, `product-discovery`, `market-research`, `market-research/[id]`, `loss-analysis`, `insights`.
**Fix-Richtung:** Pro schwerer Dashboard-Route eine `loading.tsx`-Skeleton (Muster existiert in `forecast/loading.tsx`: `StatCardSkeleton`/`ChartSkeleton`/`Skeleton`). Rein additiv → Shell + Skeleton erscheinen sofort beim Klick; entriegelt zugleich 3.2 (Prefetch wärmt die Boundary vor).

**3.3:** `src/lib/auth/org.ts:75-108` — `auth()` (header-only, billig) + Supabase-SELECT auf `organizations` per `clerk_org_id` (indizierter Single-Row-Lookup, ~1–2 ms) bei **jeder** Navigation und jedem `router.refresh()`; in `settings/` doppelt (Layout + Page). **Caveat:** `React.cache()` dedupliziert nur **pro Render**, nicht über Navigationen — hilft also nur gegen den settings-Doppelaufruf, nicht cross-nav. Cross-Nav-Caching ist im serverless/dynamic Stack nicht via `React.cache()` lösbar.

**3.4:** ~20 Komponenten rufen `router.refresh()` nach Mutationen (`AccountMasterCard`, `AccountStatusControl`, `PlanQuotaPanel`, `BulkInviteForm`, `SendInviteAction`, `OpenLinkPanel`, `ScreeningQuestionsPanel` …). Einige (z. B. `AccountMasterCard`, `AccountStatusControl`) machen es schon richtig (lokaler State + `startTransition`). Die research-plan-Mutations-Panels ohne `startTransition` frieren beim Refresh kurz ein.
**Fix-Richtung:** Wo die API die aktualisierte Entity zurückgibt → lokalen State setzen statt `router.refresh()`; sonst in `startTransition` wickeln.

---

## 4. Datenabruf & DB-Queries (Supabase)

> Skaliert schlecht pro Org, ist aber bei heutigen Datenmengen meist latent. Unabhängig von der Clerk/next-intl-Dynamik.

| # | Fund | Severity | Aufwand |
|---|------|----------|---------|
| 4.1 | **Unbounded List-Reads ohne `.limit()`/Pagination** | 🟡 medium | M |
| 4.2 | `getDealsByOrg` feuert zweite Volltabellen-Query als Fallback | ⚪️ low | S |
| 4.3 | Detail-Seiten-Waterfalls: unabhängige Reads seriell statt `Promise.all` | 🟡 medium (deal-page) / ⚪️ low | S |
| 4.4 | „Latest-per-Entity"-Helfer holen volle Historie, behalten 1 Zeile | ⚪️ low | M |
| 4.5 | Gong-Sync: sequentielle Upserts pro Call (Timeout-Risiko bei Backfill) | 🟡 medium | M |
| 4.6 | `requireOrgId`/`getOrgName` nicht request-memoisiert (Doppel-Query) | ⚪️ low | S |

**4.1:** Ohne Limit/Pagination — `getAccounts` (`accounts/service.ts:160-170`), `getDealsByOrg` (`deals/service.ts:122-146`), `getAllInsightsForOrg` (`product-discovery/service.ts:432-489`, aggregiert **alle** Insight-Zeilen in JS für KPIs), **`getCallsByDealId`** (`calls/service.ts:37-63`, lädt **volle Transkripte + alle `transcript_segments(*)` + `call_speakers(*)`** aller Calls eines Deals — rendert sie alle eager). Akutester Fall = `getCallsByDealId` (KB–MB pro Call). Gegenbeispiel: `getCallsByAccountId` (`calls/service.ts:81-97`) ist bewusst schlank (nur `id, account_id, call_type, recorded_at, transcript_summary`) — dieselbe Technik auf Deal-Ebene anwenden.
**Fix-Richtung:** `.limit()` + explizites Ordering, Cursor/Offset-Pagination auf den List-Pages, kleinere Column-Projektion bzw. server-seitiges Aggregat statt „alle Zeilen in JS zählen".

**4.2:** `getDealsByOrg` selektiert erst `data_source='hubspot'`; bei 0 Zeilen feuert es eine **zweite** `select(*)` aller Deals der Org. Jede Nicht-HubSpot-Org (manuell/seeded) zahlt 2 sequentielle Reads auf `/dashboard`, `/forecast`, `/accounts`. (Indizes vorhanden → kein Seq-Scan, aber unnötiger zweiter Roundtrip.)
**Fix-Richtung:** Alle Org-Deals in **einer** Query holen und in JS nach `data_source` partitionieren; zweite Query nur bei echtem Fehler, nicht bei „leer".

**4.3:** Stärkster Fall `deals/[id]/page.tsx:63-97` — `getCallsByDealId` (66) + `getRiskScoreHistory` (73) sind voneinander unabhängig, laufen aber seriell; `getDealInterview` + `getOrgSettings` (90-97) ebenso parallelisierbar. ~1–2 sparbare Roundtrips. `synthesis`, `research-plans/[id]`, `market-research/[id]` je ~1 Roundtrip. **`accounts/[id]` und `market-research/[id]` nutzen schon `Promise.all`** (Finder hatte sie teils falsch gelesen — siehe unsicheren Fund unten).
**Fix-Richtung:** Mutuell unabhängige Reads in eine `Promise.all`-Stufe gruppieren (echte Abhängigkeiten wie `getLatestInsightsForCalls` → braucht Call-IDs als zweite Stufe behalten).

**4.4:** `getLatestRiskScoresForDeals` (`risk/service.ts:102-125`) und `getLatestHealthScoresForAccounts` (`accounts/health-service.ts:143-166`) ziehen **alle** Score-Zeilen aller Entities (inkl. `signals` JSONB), behalten in JS nur die neueste pro Key.
**Fix-Richtung:** `DISTINCT ON (entity_id) … ORDER BY analyzed_at DESC` View/RPC oder Window-Function. **Caveat:** `risk_scores` fehlt der passende Composite-Index (Migration `20260520000000` hat ihn gedroppt) — Index-Add nötig; `account_health_scores` hat ihn bereits.

**4.5:** `gong/service.ts:749-795` — pro Call seriell: 1 Upsert + (in `replaceCallSegments`) 3 DELETEs + N Speaker-Inserts + 2 Bulk-Inserts = `(6+N)` Roundtrips pro Call, alle in **einem** Route-Handler (`POST /api/integrations/gong/sync`, **kein `maxDuration`**, keine Queue). `fetchGongCalls` paged bis 1.000 Calls → großer Backfill kann das Function-Timeout reißen (silent partial sync). Background-Pfad, **keine** User-Navigation.
**Fix-Richtung:** Multi-Row-Upsert + bounded `Promise.all`-Concurrency; Segment-Replacement in weniger Roundtrips. Off dem User-Latenz-Budget halten.

**4.6:** `requireOrgIdOrError()` + `getOrgName()` feuern auf Export-/AI-Pfaden (PDF/PPTX-Routen, `analyzeAccountHealth`) zwei SELECTs auf `organizations`. **Caveat:** `React.cache()` greift in API-Routen (kein React-Tree) **nicht** — korrekter Fix ist eine kombinierte Query (id + name) oder `orgName` durchreichen. Niedrig, weil diese Pfade ohnehin von PDF/LLM dominiert werden.

---

## 5. Client-React-Render-Performance

> Die 109 Client-Komponenten sind insgesamt sorgfältig gebaut (useMemo auf abgeleiteten Daten, lokaler State + Client-Filter, self-cancelnde Timer). **Ein** echter Hot-Path-Defekt.

| # | Fund | Severity | Aufwand |
|---|------|----------|---------|
| 5.1 | **Deals-Tabellen-Suchfeld: voller RSC-Refetch + volle Tabellen-Neurender pro Tastenanschlag** | 🔴 high | S |

**5.1:** `DealTableWithFilters.tsx:185-229` — das Suchfeld ist voll URL-controlled: `value={filters.search}` (aus `getFilterState(useSearchParams())`), `onChange` ruft `updateParam("q", …)` → `router.replace(…)`. Da die Dashboard-Page dynamisch ist (Clerk + next-intl, kein Client-Cache für dynamische Pages), feuert **jeder Tastenanschlag** einen RSC-Request: `getDealsByOrg` (ohne Limit, ggf. 2 Queries durch 4.2) + `getLatestRiskScoresForDeals` über alle Deals + `buildForecastSummary`, dann re-rendert die `filteredDeals.map`-Liste komplett. Gefiltert wird ohnehin schon 100 % clientseitig (`applyDealFilters`) — der Server-Roundtrip bringt **nichts**. Auf langsamer Verbindung „hängen" getippte Zeichen sichtbar (Input-Value erst nach Navigation aktualisiert).
**Fix-Richtung:** Suchfeld auf lokalen `useState` (instant, keine Navigation); URL nur als optionaler teilbarer Snapshot (debounced bzw. `window.history.replaceState` — Next-16-Pattern für URL-Updates ohne RSC-Re-Render). Dropdown-Filter (selten geändert) dürfen URL-Params behalten.

---

## 6. AI/LLM — wahrgenommene Latenz

| # | Fund | Severity | Aufwand |
|---|------|----------|---------|
| 6.1 | **Live-Interview-Chat blockt auf volle Opus-Antwort, kein Streaming** | 🔴 high | L |
| 6.2 | Chat-with-Data & Mission-Control: gleiches Blocking-Muster, statischer Spinner | 🟡 medium (war high) | L |
| 6.3 | **Kein Anthropic Prompt-Caching** — stabiler Prompt + Korpus pro Turn neu gesendet | 🟡 medium (war high) | M |
| 6.4 | Post-Loss-Interview feuert 2 serielle Opus-Calls vor der Antwort | 🟡 medium | M |

**6.1:** `InterviewChat.tsx:139-174` macht ein `fetch`, zeigt `<TypingBubble/>` während `loading`, rendert erst nach der **vollen** JSON-Response. Route → `advanceInterview` → `callJson` → `callClaudeStructured` (Default Opus, `maxTokens 1024`, SDK-Timeout 120 s; Code-Kommentar: „Opus ~40–60 s"). Höchst-Traffic interaktiver AI-Pfad, schlechtester Ort für Blocking.
**Fix-Richtung:** Konversations-Antwort streamen. **Caveat:** Forced-Tool-Use (`tool_choice: {type:"tool"}` in `structured.ts:148`) streamt Tool-Input als JSON-Blob, nicht als Prosa-Tokens → echtes Streaming braucht Umbau auf freien Text-Channel + separates `done`-Handling. Schneller Zwischenschritt: Model via `VOICE_MODEL`-Env auf Sonnet/Haiku (0 Code).

**6.2:** `ChatWithDataPanel.tsx:91-143,241-252` + `chat-with-data.ts:42` (Default Opus) + `mission-control/engine.ts:48` (Default Opus). Statischer „Suche…"-Text bis volle Antwort. **Caveat:** Streaming gleich architektonisch erschwert wie 6.1; Env-Override (`CHAT_WITH_DATA_MODEL`/`MISSION_CONTROL_MODEL`) auf Sonnet wäre 0-Code, hat aber **kein** grünes Eval für diese Pfade (das Research-Agent-Sonnet-OK überträgt sich nicht automatisch → Anchor-Integrität war der Opus-Grund).

**6.3:** `cache_control` 0× im Code (grep). `chat-with-data.ts:143-148` baut `CHAT_WITH_DATA_SYSTEM_PROMPT` + `buildChatDataSection` (voller Studien-Insights/Synthesis-Dump) **jeden Turn** neu — eigener Kommentar sagt „cacheable across turns", nie verdrahtet. Mission-Control analog. SDK 0.96.x typisiert `CacheControlEphemeral` auf `TextBlockParam` **ohne** beta-Header. Größter Gewinn auf Multi-Turn-Chats (Korpus-große × Turn-Anzahl); Agent-Loops + Single-Shot weniger.
**Fix-Richtung:** `cache_control: {type:'ephemeral'}` auf den stabilen System-Prefix (+ statischen Daten-Block) in `callClaudeStructured` und den beiden Loop-Callern; volatile Frage/History außerhalb des gecachten Spans halten.

**6.4:** `session-service.ts:828-839` (Post-Loss-Branch) — `nextInterviewMessage` (Opus) für die Closing-Message, dann **direkt** blockierend `extractLossReasonFromInterview` (zweiter Opus-Call) vor DB-Update + Response. Die Extraktion ist reine Analytics, die der Teilnehmer nie sieht → ~doppelte Wartezeit vor „abgeschlossen".
**Fix-Richtung:** Extraktion vom Request-Pfad entkoppeln (Session mit `status=completed` schreiben + Closing-Message sofort zurückgeben, Extraktion als Background-Task/Queue — kein floating Promise ohne `waitUntil`).

---

## 7. Toter/überflüssiger/duplizierter Code (Repo-Hygiene, ~0 Runtime-Kosten)

> Alle bereits tree-shaken → kein Bundle-/Runtime-Effekt heute. Kosten = Repo-Gewicht, tsc/eslint-Fläche, Verwirrung, Risiko eines versehentlichen Re-Imports (würde Client-Bundle still aufblähen).

| # | Fund | Severity | Aufwand |
|---|------|----------|---------|
| 7.1 | 3 tote Komponenten-Trees: `landing/` (859 LOC) + `landing-comic/` (1170) + `pricing/` (628) = **~2.657 LOC / 30 Dateien, 0 Importer** | ⚪️ low (war medium) | S |
| 7.2 | Toter Static-HTML-Pfad: `page-source.ts` (`loadMarketingPage`), `MarketingScripts.tsx`, `src/marketing/landing.html` (68 K) + `pricing.html` (24 K) — 0 Aufrufer | ⚪️ low (war medium) | S |
| 7.3 | `@react-spring/web` direkte Dependency, **0 Imports** (framer-motion deckt alles ab) | ⚪️ low | S |
| 7.4 | Service-Role-Supabase-Factory **10× byte-identisch copy-paste** über lib-Module | ⚪️ low | M |

**7.1:** Nur Provenance-Kommentare verweisen noch auf die Trees (`marketing/icons.tsx:3`, `PlatformDiagram.tsx:10`); `/preise` nutzt eigenes `@/components/marketing/PricingTable`. 18 der Dateien tragen `"use client"` + framer-motion.
**7.4:** `createAdminSupabaseClient` (`supabase/admin.ts:16`) + 9 Klone (`research/db.ts:658`, `synthesis/engine.ts:208`, `research/chat-with-data.ts:595`, `research/highlight-reels.ts:611`, `bridge/*`, `mission-control/engine.ts:328`, `product-discovery/service.ts:165`, `voice/inbox-service.ts:73`, `auth/voice-token.ts:73`) — identischer Body, nur Generic-Typ unterscheidet sich. Drift passiert schon (Mission-Control wirft anderen Error). Server-only → kein Bundle-Effekt.
**Fix-Richtung:** Eine generische Factory `createServiceRoleClient<T extends Database = Database>()`, alle Call-Sites delegieren; `DatabaseWith*`-Aliase behalten.

---

## 8. Assets — Bilder/Fonts/Static

> Bild-/Asset-Hygiene ist gut: `public/` winzig (größte Datei `og-image.png` 43 KB, korrekt 1200×630), rohe `<img>` nur legitime Fälle (user-uploaded White-Label-Logos mit fixer Größe, kein CLS), Marketing nutzt Inline-SVG-Icons (keine Icon-Dependency).

| # | Fund | Severity | Aufwand |
|---|------|----------|---------|
| 8.1 | 7 Font-Familien im Root-Layout; 2 (Bricolage + Space Grotesk, 9 Gewichte) nur für toten Code → siehe **0.4** | ⚪️ low (war medium) | S |

**8.1:** `layout.tsx:2-59,122-125` lädt Inter, Bricolage_Grotesque, Space_Grotesk, Fraunces, Hanken_Grotesk, JetBrains_Mono (next/font/google) + GeistSans (geist) und hängt alle 7 `.variable`-Klassen ans `<html>` für **jede** Route. **Fraunces ist NICHT tot** (Marketing nutzt `font-marketing`); tot sind nur Bricolage + Space Grotesk (nur `landing-comic/`). Tailwind purged ungenutzte Font-Utilities → echtes Problem sind 2 unnötige Latin-woff2-Preloads pro Document, nicht 9 Downloads.
**Fix-Richtung:** Bricolage + Space Grotesk aus `layout.tsx`/`globals.css` entfernen (zusammen mit 7.1).

---

## Unsicherer Fund (Finder teils widerlegt)

**„Heavy Detail-Pages = 4–6× serieller DB-Waterfall, Seite unsichtbar bis langsamstes Glied"** — *unsicher / überzeichnet.*
Verifikation: `accounts/[id]` (Z. 75-82) und `market-research/[id]` (Z. 134-141) nutzen **bereits `Promise.all`** — Finder hatte sie falsch gelesen. Realer Gewinn nur ~1 Roundtrip auf `deals/[id]` (calls + history parallel) und `health` (retention + healthMap parallel) → siehe **4.3**. Zudem: Supabase nutzt PgBouncer (Transaction-Pooling) → per-Call-Factories zahlen **nicht** je vollen TCP/TLS-Connect; und `deals/[id]` **hat** eine `loading.tsx`. Korrigierte Severity: ⚪️ low. (Inhaltlich in 4.3 + 3.1 abgedeckt.)

---

## Widerlegte Funde (zur Transparenz — geprüft & verworfen)

1. **„Beide Cross-Study-Panels eager gemountet, eines versteckt"** — nur ~3–5 KB App-Code, kein splitbarer Lib-Chunk; das Always-Mounted-Pattern ist bewusstes Design (Session-State-Erhalt über Tab-Wechsel, `InsightsModeSwitcher.tsx:17-19`).
2. **„framer-motion in ~12 Live-Marketing/Pricing-Komponenten"** — real nur **3** Live-Dateien (`Reveal` nutzt `motion`; StatBand/SalesLiveDemo nur `useReducedMotion`). Der Rest war der **tote** `pricing/`-Tree (0 Importer); `/preise` nutzt das framer-motion-freie `marketing/PricingTable`. (Echter Teil → 1.3.)
3. **„Cron-Reanalyse hängt an sequenziellen AI-Calls"** — `analyzeRisk` (`risk/orchestrator.ts:40-70`) ist **rein regelbasiert** (8 Detektoren in `Promise.all`), kein LLM. Cron-Kommentar bestätigt das explizit. Per-Deal-Arbeit = leichte DB-Roundtrips, kein Time-Budget-Problem bei B2B-Mengen.
4. **„Alle Font-Variablen am Root → jede Route trägt fremde Fonts"** — strukturell korrekt, aber `next/font` `.variable` injiziert CSS-Custom-Properties, **keine** unbedingten Preloads; Tailwind purged ungenutzte `font-*`-Utilities → fremde Fonts werden auf der Route nicht geladen. Echtes Problem ist nur eng = die 2 toten Familien (→ 8.1).

---

## Übersicht nach Wirkung × Aufwand (Vorschlag für Paketierung)

### Paket 1 — Sofortige Wahrnehmungs-Wins (klein, additiv, geringes Risiko)
- **3.1** `loading.tsx`-Skeletons pro schwerer Dashboard-Route `M` 🟡 (entriegelt 3.2)
- **5.1** Deals-Such-Feld auf lokalen State `S` 🔴
- **1.4** cmdk per `next/dynamic` `S` 🟡

### Paket 2 — Marketing-Layout-Split (großer Hebel, strukturell, mehr Risiko)
- **0.1–0.5 / 2.1 / 2.2** Eigenes statisches Root-Layout für `(marketing)` `L` 🔴
- **1.3** framer-motion auf Marketing entschärfen `M` 🟡

### Paket 3 — AI-Latenz
- **6.3** Prompt-Caching `M` 🟡 (kein Architektur-Blocker)
- **6.4** Post-Loss-Extraktion entkoppeln `M` 🟡
- **6.1 / 6.2** Streaming der Konversations-Agents `L` 🔴/🟡 (Forced-Tool-Use-Umbau — später)

### Paket 4 — DB-Skalierung + Hygiene
- **4.1** Limits/Pagination `M` 🟡 · **4.2** Deals-Query `S` ⚪️ · **4.3** Deal-Page parallelisieren `S` 🟡 · **4.5** Gong-Sync `M` 🟡 · **4.4/4.6** `M`/`S` ⚪️
- **7.1–7.4 / 8.1** Dead-Code & Font-Cleanup `S`–`M` ⚪️

---

*Erzeugt aus dem Multi-Agent-Audit `wkxkvqzx7` (41 Agenten, ~1.018 Tool-Calls). Alle Funde sind code-verankert (file:line) und adversarial verifiziert. Severities = korrigierte Werte nach Verifikation.*
