# findr — Dark Mode / System-Farbschema: Plan

**Status:** Nur Plan, kein Code geändert. Stand 2026-06-12.
**Scope:** Plattform (Dashboard) UND Marketing-Webseite. System-adaptiv (`prefers-color-scheme`) als Kern-Anforderung, manueller Override optional.

---

## 0. Befund (Ist-Zustand)

Die Codebase ist für Dark Mode **strukturell gut vorbereitet, inhaltlich bei null**:

| Bereich | Befund |
|---|---|
| Tailwind | **v4** mit `@theme`-Block in `src/app/globals.css` — kein `tailwind.config`, ~70 Farb-Tokens als CSS-Variablen. `darkMode` nicht konfiguriert, **0 echte `dark:`-Varianten** im ganzen Repo. |
| Layout-Architektur | Multi-Root: `(app)`-Tree (Root-Layout mit Clerk, body `bg-obsidian text-white` — **Auth-Screens sind heute schon dunkel**) und `(marketing)`-Tree (eigenes Root-Layout, `.studio`-Wrapper). Dashboard-Child-Layout erzwingt hell (`bg-neutral-50 text-neutral-700`). |
| Komponenten-Farben | ~2.350 Farbklassen in `src/`: 1.611× `*-neutral-*`, 329× white/black, 413× primary/danger/success. Rohe Hex nur in 30 Dateien — fast alle bewusst (PDF, E-Mail, Clerk-Appearance, Teilnehmer-Shell). |
| Marketing | 29 Komponenten, eigenes Token-System: 4 Surface-Tokens in globals.css (`canvas/warm/anchor/accent-warm`) + 23 `--st-*`-Tokens in `studio.css` (alles hell-only). 24× `prefers-reduced-motion` sauber umgesetzt — **0× `prefers-color-scheme`**. Nur 2 Hex-Ausreißer (`CTASection` #ff8a75, `StudioHero` rgba-Inline). |
| Meta | `themeColor: "#fafafa"` hart im Marketing-Layout, kein `color-scheme`, Favicon-SVG farb-gebacken (#4A51A8/#FFF). |
| Settings-Infra | Settings-Seiten existieren (`/dashboard/settings/*`), aber keine Theme-Präferenz-Spalte, kein Toggle. |

**Glücksfälle:**
- Teilnehmer-Interview (`ParticipantShell`) nutzt Inline-Hex → von Token-Umschaltung automatisch unberührt.
- PDF/PPTX/E-Mail sind statisch hex-codiert → automatisch sicher.
- Marketing und Plattform teilen zwar `globals.css`, hängen aber an getrennten Root-Layouts → unabhängige Schalt-Mechanismen möglich.

---

## 1. Grundsatzentscheidungen (Empfehlungen)

### G1 — Zwei verschiedene Mechanismen für zwei Welten

| | Plattform (Dashboard) | Marketing-Site |
|---|---|---|
| Mechanismus | **`.dark`-Selector** (Klasse), gesteuert per Script | **Reine Media-Query** `prefers-color-scheme: dark` |
| Steuerung | System-Default + manueller Override (Hell/Dunkel/System) | Folgt nur dem System, **kein Toggle** |
| Persistenz | `localStorage` (E1), DB-Spalte optional später | keine nötig |
| Flash-Schutz | Inline-Script vor First Paint (next-themes-Pattern) | keiner nötig (CSS-only, SSG-kompatibel) |

Begründung: Die Marketing-Site ist statisch/SSG, ohne Auth, ohne Client-State — eine reine CSS-Lösung ist flash-frei, JS-frei und SEO-neutral. Die Plattform braucht den Override (Nutzer mit dunklem OS, die das Dashboard hell wollen, und umgekehrt), also Klasse + Script.

### G2 — Tailwind v4: Dark-Variante als Custom-Variant

```css
/* globals.css */
@custom-variant dark (&:where(.dark, .dark *));
```

Damit funktioniert `dark:` überall; die Klasse kann auf `<html>` ODER auf einem Wrapper-`div` sitzen (wichtig für G3).

### G3 — Scoping: `.dark` NICHT auf `<html>` des (app)-Trees, sondern auf dem Dashboard-Layout-Wrapper

Der `(app)`-Tree enthält neben dem Dashboard auch `interview/[token]` (Teilnehmer, white-label, MUSS hell bleiben) und `shared/synthesis/[token]` (öffentlicher Report, MUSS hell bleiben). Eine `.dark`-Klasse auf `<html>` würde via Tailwind-Utilities (`bg-neutral-50` etc.) in den Shared-View durchschlagen.

**Empfehlung:** Theme-Klasse auf dem Wrapper-`div` in `src/app/(app)/(dashboard)/layout.tsx` setzen (dort, wo heute `bg-neutral-50` hart steht). Das Custom-Variant `&:where(.dark, .dark *)` greift auch auf Wrapper-Ebene. Zusätzlich `style={{colorScheme: 'dark'}}` auf dem Wrapper für native Controls/Scrollbars im Dashboard.

Konsequenz: Teilnehmer-, Shared-, Auth- und Onboarding-Routen sind per Konstruktion ausgeschlossen — kein Force-Light-Hack nötig.

### G4 — Token-Strategie Plattform: Semantik-Schicht statt Ramp-Flip

Zwei Optionen für die 1.611 `neutral-*`-Nutzungen:

- **(a) Ramp-Flip:** Unter `.dark` die Neutral-Rampe invertieren (`neutral-50`↔`neutral-900` …). Schnell, aber semantisch lügnerisch: bricht bei Shadows, Overlays, `bg-white`-Karten, Disabled-States; jede Ausnahme wird zum Whack-a-Mole.
- **(b) Semantische Tokens (EMPFOHLEN):** Eine kleine Schicht semantischer Variablen einführen, die unter `.dark` umdefiniert wird, und die Dashboard-Komponenten darauf migrieren:

```css
@theme {
  --color-surface: #fafafa;        /* heute bg-neutral-50 (Canvas) */
  --color-card: #ffffff;           /* heute bg-white */
  --color-card-hover: #f4f4f5;
  --color-ink: #18181b;            /* heute text-neutral-900 */
  --color-ink-secondary: #3f3f46;  /* text-neutral-700 */
  --color-ink-muted: #71717a;      /* text-neutral-500 */
  --color-line: #e4e4e7;           /* border-neutral-200 */
  --color-line-strong: #d4d4d8;
  /* + ring, shadow-card-Anpassung, skeleton, overlay */
}
.dark {
  --color-surface: #121016;        /* Obsidian-Familie — Rampe existiert schon */
  --color-card: #1b1822;
  --color-ink: #f4f4f5;
  /* … */
}
```

Vorteil: Die Obsidian-Rampe (50–950) existiert bereits als Dark-Fundament; die Auth-Screens definieren den dunklen Look schon (violett-getöntes Dunkel statt totem Grau) — das Dashboard-Dark-Theme sollte diese Familie nutzen, nicht generisches `zinc`.

Migration: Mechanisch pro Klassen-Paar (`bg-neutral-50`→`bg-surface`, `bg-white`→`bg-card`, `text-neutral-900`→`text-ink`, …), gut parallelisierbar und per Grep verifizierbar ("0 verbleibende `neutral-*` in Dashboard-Komponenten" als Abnahmekriterium). Primary/Success/Danger-Rampen bleiben unverändert (funktionieren auf dunkel, ggf. Feinjustage der 50er-Tints für Badges → `--color-*-soft`-Tokens).

### G5 — Token-Strategie Marketing: Dark-Set für die `--st-*`-Schicht per Media-Query

Die Marketing-Site ist durch `studio.css` bereits perfekt vorbereitet: praktisch alle Farben laufen durch 23 `--st-*`-Variablen + 4 Surface-Tokens. Dark Mode = ein einziger Block:

```css
@media (prefers-color-scheme: dark) {
  .studio {
    --color-canvas: #100f1c;      /* Twilight-Nacht statt Lab-Hell */
    --color-warm: #16152a;
    --st-paper: #1a1930;
    --st-ink: #eeeff8;            /* Ink und Cream tauschen die Rollen */
    --st-line: rgba(238,239,248,0.12);
    --st-rec-bright als Akzent häufiger als --st-rec-deep;
    /* anchor/dark-Sektionen bleiben fast unverändert — sie SIND schon dunkel */
  }
}
```

Pointe: Footer, CTA, MethodStack, PlatformModules (die „Tape-Cards") sind heute schon dunkel (`--st-dark` #141734) — im Dark Mode ändern sich primär Canvas, Paper-Karten und Ink. Das „Twilight"-Konzept hat seinen Nachtmodus quasi eingebaut. Die ~122 Tailwind-Klassen (`text-neutral-900` etc.) in Marketing-Komponenten müssen auf `--st-*`/semantische Tokens umgezogen oder mit `dark:`-Pendants versehen werden — da Media-Query-basiert, hier via `@custom-variant dark` Alternative: zweite Variante `@media`-gebunden definieren oder die Klassen auf Token-Utilities umstellen (empfohlen, konsistenter mit studio.css).

### G6 — Was NIEMALS dunkel wird (explizite Ausschlussliste)

1. Teilnehmer-Interview `interview/[token]` (white-label, Branding-Akzent des Kunden)
2. Shared-Synthesis-View `shared/synthesis/[token]` (öffentlicher Report)
3. PDF-Exporte (`src/lib/pdf/*`), PPTX (`src/lib/pptx/*`)
4. E-Mail-Templates (`src/lib/email/*`)
5. OG-Image (statisches PNG, bleibt hell)

Diese Liste gehört als Kommentar-Block in `globals.css` über die Dark-Tokens, damit sie nicht versehentlich „mitmodernisiert" wird.

---

## 2. Etappen

### E1 — Fundament Plattform (S)
- `@custom-variant dark` + `color-scheme`-Handling in `globals.css`
- Semantische Token-Paare (hell + `.dark`-Block) auf Obsidian-Basis definieren
- Theme-Provider fürs Dashboard: kleiner eigener Hook oder `next-themes` (mit `attribute`/Wrapper-Scoping gem. G3), Inline-No-Flash-Script, `localStorage`-Key `findr-theme`
- Toggle-UI: Dreizustand Hell/Dunkel/System — Vorschlag: im `DashboardHeader` (Icon-Button) UND in `/dashboard/settings/profile` als Setting; ⌘K-Command-Palette-Eintrag als Bonus
- i18n-Keys de+en
- **Abnahme:** Umschalten ohne Flash, Teilnehmer-/Shared-Routen unverändert (Byte-Vergleich des gerenderten HTML), Reload behält Wahl, System-Wechsel live via `matchMedia`-Listener

### E2 — Dashboard-Migration auf semantische Tokens (L — der Brocken)
- Mechanischer Umzug der Dashboard-Komponenten: `bg-neutral-50/bg-white/text-neutral-*/border-neutral-*` → Semantik-Tokens (gut in parallele Pakete pro Komponenten-Ordner zerlegbar: dashboard/, research/, settings/, search/, layout-Komponenten)
- Sonderfälle einzeln: `shadow-card` (Dark: Schatten → Hairline/Elevation-Fläche), Skeletons, Toasts, `CommandPalette` (cmdk), Fokus-Ringe, Scrollbars
- Charts: `RiskHistoryChart` LEVEL_COLORS auf bestehende Risk-Tokens umstellen; SVG-Achsen/Grid auf `--color-line`
- **Abnahme:** Grep-Null für `neutral-*`/`bg-white` unter den Dashboard-Pfaden, Screenshot-Durchlauf (Playwright) aller Hauptseiten in beiden Modi, WCAG-AA-Stichprobe (Ink auf Surface, Muted auf Card, Badges)

### E3 — Clerk & Drittflächen (M)
- Clerk-Appearance dynamisch: `resolvedTheme` → `appearance`-Prop umschalten (eigene Dark-Variante von `findrDashboardClerkAppearance`, Farbwerte aus den E1-Tokens; alternativ `@clerk/themes` dark als Basis + Brand-Overrides). Betrifft `/settings/profile`, `/settings/team`, `UserButton`
- Auth-Screens (`sign-in/sign-up`): bleiben dunkel wie heute — ggf. später vereinheitlichen, nicht Teil dieses Plans
- LiveKit-Voice-UI prüfen (nutzt eigene Defaults; Dashboard-seitige Voice-Ansichten auf Tokens)
- **Abnahme:** UserProfile/OrgProfile in beiden Modi ohne weiße Blitzer-Container

### E4 — Marketing Dark (M)
- `@media (prefers-color-scheme: dark)`-Block in `studio.css` (Dark-Werte für die 23 `--st-*` + 4 Surface-Tokens, Twilight-Nacht-Palette auf Violet-950-Basis)
- Die ~122 Tailwind-Palette-Klassen in Marketing-Komponenten auf Token-Utilities umziehen (analog studio.css-Stil); 2 Hex-Ausreißer (`CTASection` #ff8a75, `StudioHero`-rgba) tokenisieren
- `viewport.themeColor` → Array mit Media-Bindung: `[{media:'(prefers-color-scheme: light)', color:'#fafafa'}, {media:'(prefers-color-scheme: dark)', color:'#100f1c'}]`
- `color-scheme: light dark` via Meta/CSS im Marketing-Layout
- Favicon: `prefers-color-scheme`-Regel direkt ins SVG (Indigo-Mark heller auf dunklem Browser-Chrome)
- Dunkle Sektionen (Footer/CTA/Tape-Cards) feinjustieren: im Dark Mode verschmelzen sie mit dem Canvas → Hairline-Abgrenzung statt Kontrast-Sprung
- ~~Kollisionsfläche Marketing-Branches~~ **ENTWARNT (geprüft 12.06.):** alle Marketing-Branches (farbsystem, mega-menu, b2b-rollen, landingpage-mr) sind inzwischen auf main gemerged — E4 hat freie Bahn
- **Abnahme:** curl/Playwright beide Modi, kein FOUC (CSS-only), Lighthouse/WCAG-AA, `st-stars`/`st-dusk`-Effekte im Dark geprüft (dürfen nicht doppelt-dunkel absaufen)

### E5 — Politur & Persistenz-Upgrade (S, optional)
- Theme-Präferenz zusätzlich in DB (z. B. `user_preferences` oder Spalte) für geräteübergreifende Konsistenz — nur falls gewünscht; `localStorage` reicht funktional
- OG-Image-Entscheidung (ein neutrales Bild für beide Modi genügt i. d. R.)
- Reduced-Motion×Dark-Kombination testen, Druck-Stylesheet (Print = immer hell)

**Reihenfolge/Abhängigkeiten:** E1 → E2 → E3 seriell (gleiche Dateien/Tokens). E4 unabhängig, jederzeit startbar. Einzige echte Parallel-Interferenz (Stand 12.06.): Worktree-Branch `claude/ecstatic-hofstadter-417f64` (Calls/Deals/Risk-Pipeline, aktiv ausgecheckt) fasst 4 Dashboard-Komponenten an (CallDetail, DealList, DealRow, RiskBadge), die E2 re-tokenisieren würde — vor E2-Start diesen Branch mergen oder die 4 Dateien in E2 zurückstellen. Grobaufwand: E1 ~½ Tag, E2 ~1–2 Tage (parallelisierbar), E3 ~½ Tag, E4 ~1 Tag, E5 ~½ Tag.

---

## 3. Offene Entscheidungen

- **O1:** Marketing wirklich nur system-folgend (empfohlen) oder auch mit sichtbarem Toggle? (Toggle = JS-Insel + localStorage + Flash-Schutz auf SSG — deutlich mehr Aufwand für wenig Nutzen)
- **O2:** Toggle-Platzierung Plattform: Header-Icon, Settings, beides? (Empfehlung: beides, Header für Reichweite, Settings für Auffindbarkeit)
- **O3:** `next-themes` als Dependency vs. eigener ~40-Zeilen-Hook? (Empfehlung: eigener Hook — wegen Wrapper-Scoping G3 ist next-themes' html-Attribut-Modell ohnehin nur mit Verrenkung nutzbar)
- **O4:** DB-Persistenz der Präferenz (E5) ja/nein?
- **O5:** Dark-Palette-Feinabstimmung: Obsidian-Rampe 1:1 übernehmen oder leicht entsättigen? (Designentscheidung am lebenden Objekt, Vorschlag: mit Obsidian starten)

---

## 4. Referenzdateien

- Tokens: `src/app/globals.css` (@theme, ~70 Tokens) · `src/components/marketing/studio/studio.css` (23 `--st-*`)
- Layouts: `src/app/(app)/layout.tsx` · `src/app/(app)/(dashboard)/layout.tsx` (G3-Ansatzpunkt) · `src/app/(marketing)/layout.tsx` (themeColor Z. 82)
- Clerk: `src/lib/clerk/appearance.ts` (Auth, dunkel) · `src/lib/clerk/dashboard-appearance.ts` (Dashboard, hell)
- Immer hell: `src/components/interview/ParticipantShell.tsx` · `src/components/shared/SharedSynthesisView.tsx` · `src/lib/pdf/*` · `src/lib/pptx/*` · `src/lib/email/*`
- Charts: `src/components/dashboard/RiskHistoryChart.tsx` (Hex-LEVEL_COLORS)
- Settings-Anker: `src/components/settings/` + `/dashboard/settings/profile`
