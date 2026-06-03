# Findr Marketing-Site — Multi-Page Rebuild-Plan (v2)

> Status: **Plan / Bau-Vorlage** (kein Code geändert). v2 erweitert den ursprünglichen 2-Seiten-Plan auf eine
> **echte Multi-Page-Site**. Erstellt 2026-06-01.
> Grundlage: Read-only-Audit der Live-Site + Verifikation gegen die **lokalen** Next-16.2.6-Docs
> (`node_modules/next/dist/docs/`, wie in `AGENTS.md` vorgeschrieben) + verbatim aus `src/marketing/*.html`
> extrahierte DE-Copy. Stack: Next 16.2.6 · React 19.2.4 · Tailwind v4 · next-intl 4.13.0 · Clerk · Vercel.
> **Gesetzte Entscheidungen (v2):** alles **Deutsch**, EN-Switch bewusst **später**; `metadataBase` =
> `https://findr.de` als **Platzhalter an EINER Stelle** (Domain noch nicht final, später tauschbar);
> **Komponenten-Rebuild bestätigt** (nicht „nur Aufbohren").

---

## 0. Was sich gegenüber v1 ändert

v1 war auf „2 Seiten neu bauen" geschnitten (`/` + `/pricing`). Das ist zu klein und zementiert das heutige
**Modul-Ungleichgewicht** (~70 % Sales). v2 macht aus der Site eine **Multi-Page-Architektur**, in der **jedes
der 4 Module eine eigene, gleichwertige SEO-Landefläche** bekommt, plus Conversion- (`/loesungen`) und
SEO-Motor-Flächen (`/insights`). Die in v1 erarbeiteten **Audit-, SEO-, Design- und API-Fakten bleiben gültig**
und sind unten eingearbeitet.

**Kern-Rebalancing:** Der tiefe Sales-Funnel (Live-Analyse-Demo, 5-Schritt, Lösungsebene, Voice) wandert von der
Startseite **auf die eigene Seite `/produkt/sales-intelligence`**. Die Startseite zeigt die 4 Module **gleichwertig**
im Überblick und verteilt in die Modul-Seiten.

---

## 1. Ziel-Seitenstruktur (URL-Baum) & Routing

Alles in **einer `(marketing)`-Route-Group** mit **eigenem hellem Layout** (nested unter dem bestehenden Root-Layout —
verifiziert, s. §8). Die Klammern `(marketing)` erscheinen **nicht** in der URL.

| URL | Datei | Zweck | JSON-LD |
|---|---|---|---|
| `/` | `src/app/(marketing)/page.tsx` | Startseite: Hero + 4 Module **gleichwertig** + CTA | `Organization` |
| `/produkt` | `(marketing)/produkt/page.tsx` | Plattform-Übersicht („ein KI-Gehirn", 4 Module als System) | `SoftwareApplication` |
| `/produkt/sales-intelligence` | `(marketing)/produkt/sales-intelligence/page.tsx` | Modul-Seite (real copy vorhanden) | `SoftwareApplication` (opt.) |
| `/produkt/customer-health` | `(marketing)/produkt/customer-health/page.tsx` | Modul-Seite (neue Copy) | `SoftwareApplication` (opt.) |
| `/produkt/product-discovery` | `(marketing)/produkt/product-discovery/page.tsx` | Modul-Seite, B2B Voice-of-Customer (neue Copy) | `SoftwareApplication` (opt.) |
| `/produkt/market-research` | `(marketing)/produkt/market-research/page.tsx` | Modul-Seite, B2C KI-Interviews (neue Copy) | `SoftwareApplication` (opt.) |
| `/loesungen` | `(marketing)/loesungen/page.tsx` | Use-Cases nach Rolle/Branche (Conversion-Treiber) | — |
| `/insights` | `(marketing)/insights/page.tsx` | Blog/Ressourcen-Index (SEO-Motor) | `Blog`/`ItemList` (opt.) |
| `/insights/[slug]` | `(marketing)/insights/[slug]/page.tsx` | Einzelartikel (Struktur jetzt, Inhalte später) | `BlogPosting` |
| `/preise` | `(marketing)/preise/page.tsx` | Pricing **auf Deutsch** (heute EN) | `Product`/`Offer` |
| `/demo` | `(marketing)/demo/page.tsx` | CTA-Ziel (Demo-Buchung / Trial) | — |
| `/ueber-uns` | `(marketing)/ueber-uns/page.tsx` | optional | — |
| `/impressum` | `(marketing)/impressum/page.tsx` | DE-Pflicht | — |
| `/datenschutz` | `(marketing)/datenschutz/page.tsx` | DE-Pflicht | — |
| `/agb` | `(marketing)/agb/page.tsx` | DE-Pflicht | — |
| — | `src/app/sitemap.ts` | listet **alle** Seiten + Artikel-Slugs | — |
| — | `src/app/robots.ts` | Crawl-Policy + Sitemap-Verweis | — |
| — | `src/app/not-found.tsx`, `error.tsx`, `global-error.tsx` | Fehlerflächen (helle Marketing-Fläche) | — |

> ⚠️ **Routen-Kollision (wichtig für Etappe A):** `(marketing)/page.tsx` **und** das heutige `src/app/page.tsx`
> lösen beide `/` auf → Next bricht mit Duplikat-Route ab. Etappe A muss das alte `src/app/page.tsx`
> (statisches `landing.html`) **gleichzeitig entfernen/ersetzen**. Das alte `src/app/pricing/` bleibt live, bis
> `/preise` in Etappe C steht; danach `/pricing → /preise` per `redirects()` (308) für Altlinks. `loadMarketingPage`,
> `MarketingScripts`, `src/marketing/*.html` und die toten Trees werden in Etappe D gelöscht.

---

## 2. Komponenten-Architektur (einmal bauen, überall wiederverwenden)

### 2.1 Shell (einmal, in `(marketing)/layout.tsx` + `components/marketing/`)

- **`(marketing)/layout.tsx`** — **Server-Komponente, KEIN `<html>/<body>`** (das Root-Layout liefert die schon;
  Doppel-`<html>` wäre ein Bug). Reclaimt die **helle Fläche** über einen Wrapper `bg-white text-neutral-900 min-h-dvh`
  (der globale `<body>` ist `bg-obsidian` — der Wrapper muss ihn überdecken). Rendert `<MarketingHeader/>` + `{children}`
  in `<main>` + `<MarketingFooter/>`.
- **`MarketingHeader`** — Logo `findr.` (lowercase + roter Punkt), Nav (Plattform → `/produkt`, Lösungen, Preise,
  Insights), rechts `Log in` (`/sign-in`) · `Kostenlos testen` (`/sign-up`) · `Demo buchen` (`/demo`). Mobile-Burger.
- **`MarketingFooter`** — Sitemap-Links + **Compliance-Zeile** (In Deutschland gebaut · Frankfurt · DSGVO-konform ·
  EU-AI-Act-konform) + **Legal-Links** (Impressum/Datenschutz/AGB — heute fehlend, DE-Pflicht) + © findr.
- **`CTASection`** — wiederverwendbarer Schluss-CTA-Block (Headline + Demo-/Trial-Buttons), auf **jeder** Seite.
- **`Container`/`Section`** — Layout-Primitive (max-width, vertikale Rhythmik, Eyebrow-Label-Stil).

### 2.2 Wiederverwendbare Sektions-Komponenten

| Komponente | Wofür | Verwendet auf |
|---|---|---|
| `Hero` | Eyebrow + H1 + Subhead + 2 CTAs (+ optionale Side-Visual) | `/`, jede Modul-Seite, `/produkt` |
| `ModuleHero` | Modul-Hero-Variante (Modulname, One-Liner, „passt zu"-Zeile) | 4 Modul-Seiten |
| `PlatformModules` | 4 Module **gleichwertig** (Karten oder Tab-Selector), je → Modul-Seite | `/`, `/produkt` |
| `PlatformDiagram` | „ein KI-Gehirn → 4 Module ← Datenquellen" (array-getrieben) | `/produkt`, `/` (kompakt) |
| `HowItWorks` | nummerierte Schritte (2–5), „Phase"-Label optional | jede Modul-Seite, `/produkt` |
| `ProofPoints`/`FeatureGrid` | belegte Capability-Bullets mit Icon | jede Modul-Seite |
| `DemoPlaceholder` | Produkt-Screenshot/Demo-Platzhalter (später echtes Bild via `next/image`) | jede Modul-Seite |
| `ExampleCard` | „Mini-Insight"/Beispiel (evidence-anchored, „belegt nicht geraten") | jede Modul-Seite |
| `Integrations` | Konnektoren + Live/Bald-Status | `/produkt`, ggf. `/` |
| `StatBand` | Count-up-Kacheln (4 Produkte / 100 % EU / 14 Tage / 1 Gehirn) | `/`, `/produkt` |
| `InsightTeaser` | Artikel-Karte (Titel/Excerpt/Datum) | `/insights`, Cross-Links |
| `FAQ` | Akkordeon (Pricing-FAQ, allgemeine FAQ) | `/preise`, `/loesungen` |
| `PricingTable` | 3 DE-Tiers + Enterprise-Band | `/preise` |
| `LegalProse` | schlichte Prosa-Fläche (Überschriften/Absätze) | Impressum/Datenschutz/AGB |
| `Reveal` | reduced-motion-korrektes Scroll-Reveal (Wrapper) | überall (Animation) |

### 2.3 Salvage-Map (aus den toten Trees lift-bar — verifiziert)

| Quelle (tot) | Aktion | Detail |
|---|---|---|
| `landing-comic/Reveal.tsx` | **verbatim liften** | 37 Z., token-frei, `useReducedMotion`-korrekt (rendert immer `motion.div`, setzt `initial={false}` bei reduced-motion → kein „opacity:0 stuck"). DAS Keystone-Primitive. |
| `landing-comic/icons.tsx` | **verbatim liften** | 7 Inline-SVG-Icons, `stroke=currentColor` → token-agnostisch. |
| `landing-comic/Modules.tsx` (Skeleton) | **Struktur liften** | Tab-Selector: `useState(active)` + `<button aria-pressed>` + sticky Detail-Panel (`key={active}`, reduced-motion-aware). Datshape (→ DE umbenennen): `{phase, preis, name, hook, fuer, problem, liefert[]}`. → `PlatformModules`. |
| `landing-comic/PlatformArchitecture.tsx` | **Struktur liften** | Server-Komponente: `phases[] → core(coreCards[]) → inputs[]` mit statischen SVG-Connectors. → `PlatformDiagram` (Tokens + DE neu). |
| `landing-comic/constants.ts` | **prüfen + nutzen** | `DEMO_BOOKING_URL = 'https://cal.com/findr/demo'` (TODO: echte URL bestätigen). → `/demo`-CTAs. |
| `landing-comic/doodles.tsx` | **skip/optional** | hardcodierte Comic-Ink `#1a1a1a`; nur falls hand-drawn-Motiv gewünscht. |
| `landing/PlatformVisualization.tsx`, `ModuleShowcase.tsx`, `Hero.tsx` | **NICHT liften** | Gen-1, dark-only Tokens, `useInView` **ohne** reduced-motion (Regression). Nur Copy-Referenz. |

> **Re-authored (NICHT liften):** alle EN-Strings → DE; `„90% accuracy"`-Claim (`ModuleShowcase.tsx:16`) raus; alle
> Comic/Dark-Tokens (obsidian/violet/glass-card/comic-*/shadow-hard); Gen-1-Animationen ohne reduced-motion → durch
> `Reveal` ersetzen.

---

## 3. Design-System (eine Sprache über alle Seiten)

- **Akzent: Violett `#5B2FD4` bleibt** = `--color-primary-600` (byte-identisch). Nutzung: `bg-primary-600` /
  `text-primary-600`, Hover `primary-700`, Wash `primary-50`, Borders `primary-200`.
- **Headline-Stimme: Fraunces aktivieren** (heute geladen, aber ungenutzt) → Marketing-Headings auf Fraunces
  (Serif, distinktiv), **weg vom Inter-Klischee**. **Body: Hanken Grotesk** (`--font-hanken`, = App-Body). Mono nur
  bei Bedarf (JetBrains).
- **Helle Fläche** durchgehend (`bg-white`/`neutral-50`, Ink `neutral-900`); bewusster, sauberer Übergang zum dunklen
  Dashboard (kein Schock — z. B. dunkler Footer als Brücke optional).
- **Weg vom „AI-Slop"-Muster** (Violett-auf-Weiß + Verläufe + Inter): Fraunces-Headlines + editorial restraint
  (Haarlinien, 4px-Radius, Corner-Bracket-Akzente, großzügiges Whitespace) + die semantische Sekundärpalette
  (coral/amber/green) nur funktional (Sentiment/Status).

### 3.1 Verifiziertes Token-Mapping (Marketing → App `@theme`, kein Raten)

```
--purple      #5B2FD4  ==  --color-primary-600 #5b2fd4   (BYTE-IDENTISCH → bg-primary-600 / text-primary-600)
--purple-700  (hover)   ~~  --color-primary-700 #4a25ab   (hover/active)
--purple-soft #F3EFFE   ~~  --color-primary-50  #f5f2fe   (Wash-BG → bg-primary-50)
--purple-line #D9CFFA   ~~  --color-primary-200 #cab9f6   (zarte Violett-Borders)
--bg          #FFFFFF   ==  --color-neutral-0   #ffffff   (bg-white)
--ink         #0E0A1F   !=  --color-neutral-900 #18181b   ⚠ NICHT exakt → reuse-vs-add-Token entscheiden
--muted       #6B6680   ~~  --color-neutral-500 #71717a
--green       #2E9E6B   !=  --color-success-500 #10b981   ⚠ NICHT exakt → entscheiden
--coral/--amber          —  kein App-Analogon (Sentiment-Palette) → ggf. als Marketing-Token additiv
```

Fonts (`globals.css` `@theme`): `--font-heading: var(--font-hanken)` heute → **für Marketing auf Fraunces umstellen**
(eigener Marketing-Heading-Token oder lokale Klasse, App-Heading unangetastet lassen). **Cleanup:** tote
`globals.css`-Tokens (`comic-*`, `glass-card`, `shadow-hard`, `gradient-mesh`, Legacy `--color-primary #6d28d9`,
`--color-violet-*`) mit den toten Trees in Etappe D entfernen.

---

## 4. Pro-Seite Content-Specs

> Tonalität (durchgängig, aus der echten Copy abgeleitet): **Deutsch, du-Form**, Brand `findr.` (lowercase, Punkt);
> **evidence-anchored** als Leitmotiv („belegt, nicht geraten", „Keine Floskeln. Kein Raten.", „was nicht belegt ist,
> sagt er nicht"); **anti-hype**, konkrete Zahlen statt Fluff; **DSGVO/DACH-Souveränität** load-bearing; **Live vs.
> Bald** ehrlich kennzeichnen (keine „Bald"-Features als „Live" verkaufen).

### 4.1 `/` — Startseite (4 Module **gleichwertig**)
- **Sektionen:** Hero · Platform-Thesis (kompakt) · **`PlatformModules` (4 gleichwertige Karten → Modul-Seiten)** ·
  `PlatformDiagram` (kompakt) · `StatBand` · `InsightTeaser` (3 neueste) · `CTASection`.
- **Kernaussage:** „Ein KI-Gehirn. Vier Produkte. Keine Datensilos." (H1, verbatim, `landing.html:1061`).
- **Real verfügbare Copy:** Hero (Subhead :1062, Trust-Chips :1068–1070), Platform-Thesis (:1452), Stats (:1538–1553).
- **CTA:** primär „Demo buchen →" (`/demo`), sekundär „Plattform ansehen" (`/produkt`).
- **Wichtig:** **Kein** tiefer Sales-Funnel hier — die 4 Module bekommen je eine Karte mit gleicher Tiefe und linken auf ihre Seite.

### 4.2 `/produkt` — Plattform-Übersicht
- **Sektionen:** Hero (Plattform-Pitch) · `PlatformDiagram` (voll: Module → Core → Datenquellen) · `PlatformModules`
  (4 gleichwertig) · `Integrations` (Gong/HubSpot/Slack = Live, Salesforce/Zoom = Bald, :1429–1433) ·
  „Module reden miteinander" (Cross-Modul-Flows, :1452/:1393) · `StatBand` · `CTASection`.
- **Kernaussage:** Die 4 Module als **ein System** auf einer Conversation-Intelligence-Engine; Daten kumulieren statt Silos.
- **CTA:** „Demo buchen". **JSON-LD:** `SoftwareApplication`.

### 4.3 Modul-Seiten — **einheitliche Vorlage** (Konsistenz = Gleichwertigkeit)

Jede der 4 Seiten folgt **derselben Struktur** (so wirken sie gleichwertig, egal wie viel Alt-Copy existiert):

1. **`ModuleHero`** — Modulname (Eyebrow) + H1 (One-Line-Value) + Subhead + „passt zu / für wen" + 2 CTAs.
2. **`HowItWorks`** — „So funktioniert's" in 2–5 Schritten (evidence-anchored).
3. **`DemoPlaceholder`** — Produkt-Screenshot/Demo-Platzhalter (Etappe A: statischer Platzhalter; später `next/image`).
4. **`ExampleCard`** — Mini-Insight/Beispiel mit echtem Beleg-Zitat (das „belegt nicht geraten"-Versprechen sichtbar).
5. **`ProofPoints`** — 3–6 belegte Capability-Bullets.
6. **`CTASection`** + Cross-Links zu `/produkt` und den 3 Schwester-Modulen.

**SEO:** jede Modul-Seite = eigene Landefläche mit eigener Metadata/OG/canonical (+ optional `SoftwareApplication`-JSON-LD).

**Die 4 Instanzen** (mit Copy-Status — *das* ist die eigentliche Schreibarbeit, damit alle gleichwertig werden):

- **`/produkt/sales-intelligence`** — **reiche Real-Copy vorhanden.** Quelle: Live-Analyse-Demo (:1109–1229),
  5-Schritt „So funktioniert" (:1231–1278), Lösungsebene (:1280–1327), Voice/„Bald" (:1329–1384).
  Proof: 0–100-Risiko-Score nach jedem Call, 8 belegte Signale, Verlustgrund-Erkennung, risiko-adjustierte
  Pipeline (Best/likely/Worst → HubSpot), Lösungs-PDF (kein Login), Voice-Loss-Loop (Bald). H1-Kandidat:
  „Sieh einem Deal beim Zerfallen zu — in 30 Sekunden." Die interaktive Demo wird `'use client'`-Komponente.
- **`/produkt/customer-health`** — **nur Grid-Blurb vorhanden → neue Copy schreiben.** Grundlage: „Churn-Früherkennung
  aus jedem Kunden-Call: Health-Score pro Account, Risiko-Signale und Expansions-Chancen, bevor es zu spät ist."
  (:1466) + Cross-Modul-Hook „gewonnener Deal startet CS-Onboarding" (:1452). **Anker an echte Produkt-Features**
  (im App-Code real, für Copy nutzbar): Health-Score, **NRR/Renewal-Forecast**, **Save-Plays**, Account-Value.
- **`/produkt/product-discovery`** (B2B Voice-of-Customer) — **nur Grid-Blurb + Research-Agent-Card → neue Copy.**
  Grundlage: „KI-geführte Nutzer-Interviews und automatische Studien-Synthese — verankert im Transkript statt im
  Bauchgefühl." (:1473) + Research-Agent-Card (:1497–1509: „Zusammenfassungen & Rankings auf Zuruf … was nicht belegt
  ist, sagt er nicht"). **Anker:** Screening-Gate, offener Link/Walk-ins, KI-Interviews auf Deutsch.
- **`/produkt/market-research`** (B2C KI-Interviews) — **nur Grid-Blurb + Cross-Study-Card → neue Copy.**
  Grundlage: „Studienübergreifende Insights … exakt gezählt und je Studie belegt." (:1480) + Cross-Study-Card
  (:1511–1523: „In 3 von 7 Studien — jede mit Zitat belegt … keine erfundenen Trends"). **Anker:** Cross-Study-Agent,
  exakte deterministische Zählung, `study_type`.

> **PD vs. MR schärfen** (heute laut Audit unscharf): Product Discovery = **B2B**, internes Voice-of-Customer aus
> bestehenden Calls/Interviews; Market Research = **B2C**, dedizierte KI-Interview-Studien + offener Link. Die
> Modul-Hero-„passt zu"-Zeile macht den Unterschied explizit.

### 4.4 `/loesungen` — Use-Cases (Conversion-Treiber)
- **Sektionen:** Hero · Use-Case-Grid **nach Rolle** (Sales-Leader, CS-Lead, Product/Research) **und/oder Branche** ·
  je Use-Case: Problem → wie findr. es löst → welches Modul → Mini-Beleg · `FAQ` · `CTASection`.
- **Kernaussage:** „Was man konkret damit macht" (übersetzt Features in Outcomes je Rolle).
- **Copy:** **neu** (kein Alt-Material) — leitet aus Modul-Proof-Points + Tonalität ab. **CTA:** Demo/Lösung ansehen.

### 4.5 `/insights` + `/insights/[slug]` — SEO-Motor
- **`/insights` (Index):** Hero + `InsightTeaser`-Grid (+ später Kategorien/Tags). Kernaussage: Ressourcen zu
  Conversation Intelligence, Revenue, Research, DSGVO-KI. **Jetzt Struktur, Inhalte später.**
- **`/insights/[slug]` (Artikel):** `BlogPosting`-JSON-LD, `generateStaticParams` (Slugs aus einer Quelle, z. B.
  `src/lib/insights/` oder MDX/CMS), `generateMetadata` (per-Artikel Title/Description/canonical/OG `type:'article'`),
  `dynamicParams = false` für geschlossenen, voll-statischen Satz (sofern **Cache Components AUS** — sonst nicht
  verfügbar, s. §8). **Etappe C** baut Index + `[slug]`-Gerüst mit 1–2 Seed-Artikeln; Redaktion folgt.

### 4.6 `/preise` — Pricing auf **Deutsch**
- **Sektionen:** Hero („Eine Plattform. Ehrliche Preise.") · `PricingTable` (Starter 499 € / Growth 999 € „Beliebteste
  Wahl" / Scale 1.999 €) · Enterprise-Band („Individuell, für komplexe Organisationen", CTA „Sprich mit uns") ·
  Trial-Timeline („Der Discovery-Prozess") · `FAQ` · `CTASection`.
- **EN→DE & Korrektheit (verifiziert):** Währung DE-Format **„1.999 €"** (Symbol hinten, Punkt-Tausender — Spans
  umordnen); „free trial" → „kostenlos testen"; Audience-Zeilen „Für kleine/wachsende/große Teams";
  Produktnamen Starter/Growth/Scale/Enterprise **nicht** übersetzen; `soon`-Badge wird per CSS `::after content`
  injiziert → DE-Build muss Pseudo-Content auf **„bald"** überschreiben. **Bugs fixen:** „3 simple steps" aber 4
  rendern; Timestamps `00:00`-Platzhalter; verirrtes `<li>` im Enterprise-Block; tote `href="#"`-CTAs verdrahten.
- **Gating-Widerspruch (entscheiden):** heute **Sales-Rep-Count-Bänder** (5/15/30) für **ein** Sales-Produkt, während
  „vier gleichwertige Produkte" behauptet wird (3 Module als „soon"-Upsell versteckt). Optionen: (a) ehrlich als
  Sales-Pricing framen + Module als sichtbare Roadmap, oder (b) Plattform-Fee + Module/Per-Modul — **Produktentscheidung
  André** (§9). **JSON-LD:** `Product`/`Offer`/`AggregateOffer`.

### 4.7 `/demo` — CTA-Ziel
- **Sektionen:** Hero („Sieh, was findr. in deinen Gesprächen findet") · Buchungs-Embed/Link (`DEMO_BOOKING_URL`,
  echte URL bestätigen) **oder** kurzes Formular · Trust-Zeile (DSGVO/EU) · Alternativ-CTA „Lieber direkt testen" →
  `/sign-up`. Alle Site-CTAs „Demo buchen" zeigen hierher.

### 4.8 `/ueber-uns` — optional
- Hero · Mission/„Warum DACH-souverän" · Team (optional) · `CTASection`. Copy neu. Niedrige Priorität.

### 4.9 Recht — `/impressum`, `/datenschutz`, `/agb` (DE-Pflicht, fehlen heute)
- `LegalProse`-Komponente. **Inhalt = Rechtstexte von André/Legal** (Platzhalter-Gerüst in Etappe D, Texte liefert André).
- Im `MarketingFooter` verlinkt. Indexierbar, niedrige Priorität; ggf. `/agb` `robots: noindex` nach Wahl.

---

## 5. SEO pro Seite

**Prinzip:** jede Seite eigene `title`/`description`/`canonical`/`openGraph`; `sitemap.ts` listet **alle**; JSON-LD
wo sinnvoll; `metadataBase` als **Platzhalter an einer Stelle**.

- **Root-Layout** (`src/app/layout.tsx`, Etappe A): `metadataBase: new URL('https://findr.de')` *(Platzhalter,
  später tauschbar)*; `title: { template: '%s — findr.', default: 'findr. — Conversation-Intelligence-Plattform für
  B2B-SaaS' }`; **stale Fallback-Title fixen**; Default-`openGraph` (siteName/locale `de_DE`/type/`images:'/og-image.png'`)
  + `twitter.card`; separater `export const viewport` (themeColor). Geteiltes **`ogDefaults`-Objekt** exportieren.
- **Pro Seite** (`generateMetadata`/`metadata`): eigener `title` (→ Template), `description`, `alternates.canonical`
  (relativ, z. B. `/produkt/sales-intelligence`), und `openGraph` **nur via `{ ...ogDefaults, title, url }`** (Shallow-Merge!).

| Route | Title (→ `%s — findr.`) | canonical | OG-type | JSON-LD | prio |
|---|---|---|---|---|---|
| `/` | (absolut) `findr. — Conversation-Intelligence-Plattform …` | `/` | website | `Organization` | 1.0 |
| `/produkt` | `Plattform` | `/produkt` | website | `SoftwareApplication` | 0.8 |
| `/produkt/sales-intelligence` | `Sales Intelligence` | … | website | `SoftwareApplication` (opt) | 0.8 |
| `/produkt/customer-health` | `Customer Success Health` | … | website | `SoftwareApplication` (opt) | 0.8 |
| `/produkt/product-discovery` | `Product Discovery` | … | website | `SoftwareApplication` (opt) | 0.8 |
| `/produkt/market-research` | `Market Research` | … | website | `SoftwareApplication` (opt) | 0.8 |
| `/loesungen` | `Lösungen` | `/loesungen` | website | — | 0.7 |
| `/insights` | `Insights` | `/insights` | website | `Blog` (opt) | 0.6 |
| `/insights/[slug]` | `<Artikeltitel>` (absolut) | `/insights/<slug>` | article | `BlogPosting` | 0.6 |
| `/preise` | `Preise` | `/preise` | website | `Product`/`Offer` | 0.8 |
| `/demo` | `Demo buchen` | `/demo` | website | — | 0.5 |
| `/ueber-uns` | `Über uns` | `/ueber-uns` | website | — | 0.4 |
| `/impressum` `/datenschutz` `/agb` | `Impressum` … | … | website | — | 0.3 |

- **`sitemap.ts`** (root): static-Routen-Array + Artikel-Slugs aus **derselben Quelle wie `generateStaticParams`**
  (build-time, hält Sitemap & prebuilt Routen synchron). DE-only → kein hreflang nötig; `alternates.languages` erst
  beim späteren EN-Switch.
- **`robots.ts`** (root): `allow:'/'`, Sitemap-Verweis, `disallow` für `/dashboard`,`/api`,`/onboarding`,`/interview`.
- **JSON-LD:** native `<script type="application/ld+json" dangerouslySetInnerHTML>` in der Server-Komponente, **`<`
  escapen** (`.replace(/</g,'\\u003c')`) — `JSON.stringify` sanitisiert nicht.
- **OG-Bild:** statisches `/public/og-image.png` (~1200×630) zuerst; dynamische `ImageResponse`/`next/og` optional
  später (Satori = nur Flexbox, kein Grid).

---

## 6. Etappen-Schnitt (jede einzeln baubar + verifizierbar)

> Verifikation pro Etappe: **`pnpm tsc` + `pnpm next build`** (NIE `pnpm dev` — Mac-Problem). Additiv; geschützte Pfade
> (Clerk-`proxy.ts`, Dashboard, Interview/Open-Link) nicht anfassen. Jede Etappe nutzt die **drei Befunde** aus §7.

### Etappe A — Fundament + Vorlage beweisen
- `(marketing)/layout.tsx` (helle Shell, nested) + `MarketingHeader` + `MarketingFooter` + `CTASection` + `Container`/`Section`.
- `Reveal.tsx` + `icons.tsx` liften; `PlatformModules` (Tab/Karten) + `Hero`.
- **Startseite `/`** (4 Module gleichwertig) — **ersetzt das alte `src/app/page.tsx`** (Kollision! altes entfernen).
- **EINE Modul-Seite als Vorlage**: `/produkt/sales-intelligence` (reiche Real-Copy) — beweist die einheitliche Vorlage
  inkl. `'use client'`-Demo-Interaktion.
- **SEO-Basis:** Root-Layout (`metadataBase` findr.de, `title.template`, `ogDefaults`, viewport, stale Title fix),
  `robots.ts`, `sitemap.ts` (erste Routen), `/public/og-image.png`, `not-found.tsx`/`error.tsx`/`global-error.tsx`.
- **Verifizieren:** `tsc` + `build` grün; `/` + `/produkt/sales-intelligence` rendern; `<head>` hat OG/canonical.

### Etappe B — Modul-Parität
- Restliche 3 Modul-Seiten nach der A-Vorlage: `/produkt/customer-health`, `/produkt/product-discovery`,
  `/produkt/market-research` (**neue DE-Copy**, an echten Features verankert) + `/produkt` (Übersicht) + `PlatformDiagram`
  + `Integrations` + `StatBand`.
- `sitemap.ts` um die neuen Routen erweitern. **Verifizieren:** alle 4 Modul-Seiten + `/produkt` grün, konsistente Vorlage.

### Etappe C — Conversion + SEO-Motor + DE-Pricing
- `/loesungen` (Use-Cases) · `/insights` (Index) + `/insights/[slug]` (Gerüst, `generateStaticParams`,
  `BlogPosting`-JSON-LD, 1–2 Seed-Artikel) · **`/preise` auf Deutsch** (EN→DE, Bugs gefixt, CTAs verdrahtet).
- `/pricing → /preise` Redirect (308) in `next.config.ts`; altes `src/app/pricing/` entfernen.
- **Verifizieren:** grün; `[slug]` prebuilt; Pricing DE korrekt; Redirect greift.

### Etappe D — Recht, CTA, Hardening, Aufräumen
- `/demo` (CTA-Verdrahtung, `DEMO_BOOKING_URL` bestätigt) · `/impressum`/`/datenschutz`/`/agb` (Gerüst, Texte von André)
  · optional `/ueber-uns`.
- **SEO-Feinschliff:** `Product`/`Offer`-JSON-LD (`/preise`), `Organization` (`/`), `SoftwareApplication` (`/produkt`);
  **Security-Header** via `next.config headers()` (HSTS, nosniff, Referrer, `frame-ancestors`); CSP per **SRI oder
  headers()** (kein Nonce); `manifest.ts` optional.
- **Aufräumen:** `loadMarketingPage` + `MarketingScripts` + `src/marketing/*.html` + **tote Trees** (`landing/`,
  `landing-comic/`, `pricing/`) löschen (nach grünem Build + grep „0 Importeure"); tote `globals.css`-Tokens entfernen.
- **Verifizieren:** `tsc` + `build` grün; Lighthouse/Head-Check; keine toten Referenzen.

---

## 7. Die drei tragenden Befunde (auf jeder Etappe beachten)

1. **Shallow-Merge-Footgun:** Metadata-Merge ist **per-Key REPLACE**, `openGraph` wird wholesale ersetzt. → immer
   `openGraph: { ...ogDefaults, title, url, type }` pro Seite; nie nur ein Teilfeld setzen.
2. **Server-Component-only Metadata:** `metadata`/`generateMetadata` nur in Server-Komponenten. Interaktive Teile
   (Sales-Demo, Tab-Selector, Mobile-Nav) als `'use client'`-Kinder; die `page.tsx` bleibt Server-Komponente.
3. **CSP ohne Nonce:** Nonce-CSP erzwingt dynamisches Rendering (kein Static/CDN-Cache, PPR-inkompatibel). Für
   Marketing **SRI** (`experimental.sri`) oder `headers()`-CSP. Echte Komponenten (kein Inline-`<script>`-Inject)
   machen das überhaupt erst sauber möglich.

---

## 8. Verifizierte API-Referenz (Next 16.2.6, gegen lokale Docs)

> Quelle: `node_modules/next/dist/docs/01-app/…` (verifiziert, nicht aus Trainingsdaten).

**Route-Group + Layout:** `(marketing)/` erscheint **nicht** in der URL. `(marketing)/layout.tsx` ist **kein**
Root-Layout, solange `app/layout.tsx` darüber existiert → **kein `<html>/<body>`** darin (sonst Duplikat), nur Wrapper;
es erbt `<html>/<body>` vom Root. Pages in der Group exportieren Metadata ganz normal. (Eigenes Root-Layout für
`(marketing)` wäre möglich, erzwingt aber Full-Page-Reload zwischen Marketing↔Dashboard und `/` muss in eine Group —
**nested Wrapper ist der sichere Pfad**.)

**Dynamische Route `[slug]`:** `params` ist in 16 ein **Promise** → `const { slug } = await params`. Reines `await params`
(ohne `searchParams`/`cookies`/`headers`) = **statisch** gerendert. `searchParams` (auch Promise) → opt-in dynamic →
auf Artikel-Seiten **nicht** anfassen.

**`generateStaticParams`:** `return slugs.map(s => ({ slug: s }))` (`{slug:string}[]`); läuft zur Build-Zeit, prebuildet
ein HTML pro Slug. **Immer Array zurückgeben** (sonst dynamisch). `export const dynamicParams = false` → geschlossener
Satz, unbekannter Slug → 404. **⚠ Cache-Components-Caveat:** falls `cacheComponents` AN, muss `generateStaticParams`
≥1 Param liefern (leeres `[]` = Build-Error) und `dynamicParams` ist **nicht** verfügbar → vor `dynamicParams=false`
`next.config` prüfen.

**`generateMetadata` für `[slug]`:** `({params}: {params: Promise<{slug:string}>})` → `await params`; per-Artikel
`alternates.canonical` (relativ, via `metadataBase`) + `openGraph` (volles Objekt wegen Shallow-Merge). Server-only;
nicht zusammen mit `metadata` im selben Segment; file-based `opengraph-image.tsx` überschreibt `generateMetadata`.

**`sitemap.ts`:** `MetadataRoute.Sitemap`-Array, darf `async` sein → Slugs aus derselben Quelle wie
`generateStaticParams` laden + mit Static-Routen concaten. Build-time gecacht (refresht nicht auto bei neuem Artikel
ohne Revalidate/Request-API). 1 Datei reicht < 50 000 URLs.

**JSON-LD:** natives `<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(obj).replace(/</g,'\\u003c')}} />`
in der Server-Komponente (NICHT `next/script`). `<` escapen (XSS).

**Metadata-Kern:** statisches `export const metadata` (kein `generateMetadata`, wenn nicht request-abhängig);
`metadataBase` Pflicht für relative OG/canonical (sonst Build-Error); `viewport`/`themeColor` separater Export;
`<style>`/`<script>` sind „Unsupported Metadata".

**Fonts/Images:** next/font-CSS-Var-Pattern aktuell. **next/image v16:** `priority`→`preload`; `images.qualities`
gated (Default `[75]`); `domains`→`remotePatterns`; **kein `images`-Block** in `next.config.ts` → vor `next/image` mit
Remote/`quality!=75` ergänzen.

**CSP/Proxy/Headers:** Middleware→**`proxy.ts`** (Repo hat `src/proxy.ts`=`clerkMiddleware()`, genau eine Datei).
`headers()`/`redirects()` in `next.config.ts` (`redirects` `has type:host` für www→apex). Turbopack ist Default
(keine webpack-Config). `next lint` entfernt (eslint direkt).

**Repo-Fakten:** globaler `<body>` = `bg-obsidian text-white` (#16101e) → Marketing-Shell muss helle Fläche selbst
setzen. Button-Primary = `bg-primary-600 hover:bg-primary-700`. `geist` ist Dep. `next.config.ts` = pdfkit +
framer-motion-optimize + `withNextIntl`, **kein** images/headers/redirects. next-intl **ohne** Routing (Cookie) →
Marketing-Routing davon entkoppeln (DE-only macht das jetzt irrelevant).

---

## 9. Offene Entscheidungen & Content-Lücken (für André)

| # | Punkt | Status |
|---|---|---|
| D1 | **Domain** final (für `metadataBase`) | Platzhalter `https://findr.de` an einer Stelle gesetzt — bei Bedarf tauschen |
| D2 | Sprache | **gesetzt: DE-only**, EN später (eigene `/en`-Routen, additiv) |
| D3 | **UWG-Claims** („einzige", „EU-AI-Act-konform") | vor Live klären — entschärfen oder belegen |
| D4 | **Social-Proof-Assets** (Logos/Testimonials/Zahlen) | liefern? Slot ist eingeplant (Startseite/Lösungen) |
| D5 | CSP-Strategie | **SRI** oder `headers()`-CSP (kein Nonce) — Etappe D |
| D6 | **Demo-/Trial-Ziel** | echte `DEMO_BOOKING_URL` (cal.com?) bestätigen |
| D7 | **Pricing-Modell** | Rep-Count-Bänder vs. Plattform+Module (§4.6) — Produktentscheidung |
| D8 | **Recht** (Impressum/Datenschutz/AGB-Texte) | von André/Legal — Etappe D braucht die Texte |
| C1 | **Neue Copy** für 3 Modul-Seiten (CS Health, Product Discovery, Market Research) + `/loesungen` + Insights-Seed | Schreibarbeit in Etappe B/C — an echten Features verankert |

---

## 10. Nächste Aktion

**Etappe A bauen** (Fundament + Startseite + Sales-Intelligence-Vorlage + SEO-Basis), `tsc`+`build` grün, dann
Etappe B–D nach diesem Plan. Offene Entscheidungen D3–D8 blocken Etappe A **nicht** (Platzhalter/Defaults greifen);
sie werden in den jeweiligen Etappen (C/D) relevant.
