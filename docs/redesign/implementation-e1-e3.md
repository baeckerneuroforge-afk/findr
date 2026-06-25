# Umsetzungs-Playbook E1–E3 (turnkey)

> Vorbereitet, damit die Implementierung auf Andrés „Go" deterministisch läuft.
> Stand 25.06.2026. **Noch NICHT ausgeführt — kein Produktiv-Code angefasst.**
> Grundlage: [platform-redesign-spec.md](platform-redesign-spec.md). Jede Etappe
> endet mit `pnpm -s tsc --noEmit` + `pnpm vitest run` + `pnpm build` + 1 Review.

## Kern-Erkenntnis (kleiner Blast-Radius)
- Der gesamte Chrome-Akzent hängt an der **`--color-primary-*`-Rampe** in
  `src/app/globals.css`. **497 Klassen** (`bg/text/border/ring-primary-*`) lesen
  sie. → Die Rampe von Violett auf **Tinte/Graphit** umdefinieren flippt den
  kompletten Akzent in **einem** Edit, **ohne** eine einzige Komponente anzufassen.
- **Geist ist schon geladen** (`GeistSans` aus `geist/font/sans` in
  `src/app/(app)/layout.tsx`). Schrift = reiner Token-Remap, kein neuer Font.
- Die Neutral-Rampe ist bereits zinc-basiert (kühl). Flächen ändern sich kaum.

---

## E1 — Fundament (nur `globals.css` + 1 Layout-Zeile)

**Datei: `src/app/globals.css`**

1. **Schrift → Geist** (Zeilen ~88–90): 
   ```
   --font-heading: var(--font-geist-sans);   /* war: var(--font-display), var(--font-hanken) */
   --font-body:    var(--font-geist-sans);   /* war: var(--font-hanken) */
   ```
   `text-display`/`text-h*` lesen `--font-heading` → alle Headlines werden Geist.
   `--font-mono` (JetBrains) bleibt für Zahlen. (Space Grotesk `--font-display`
   wird damit ungenutzt — kann später aus `(app)/layout.tsx` raus, optional.)
   **Verify:** `GeistSans.variable` muss auf dem `<html>` className im
   `(app)/layout.tsx` liegen (Import ist da; className-Liste prüfen, ggf. ergänzen).

2. **Akzent-Rampe → Tinte** (`@theme`, Zeilen ~162–171). Violett raus, neutrale
   Tinte rein (Vorschlag, finale Hexe = offener Punkt §8.3 Aktiv-Icon/Kontrast):
   ```
   --color-primary-50:  #f4f5f7;   /* Aktiv-/Hover-Wash (war Violett-Wash) */
   --color-primary-100: #eceef1;
   --color-primary-200: #e2e4e8;   /* zarte Borders */
   --color-primary-300: #cdd0d6;
   --color-primary-400: #9a9da6;
   --color-primary-500: #4b4d55;   /* Ring-Basis */
   --color-primary-600: #1c1d22;   /* Button-Fläche = Tinte (text-white bleibt lesbar) */
   --color-primary-700: #1c1d22;   /* Aktiv-/Link-Text = Tinte */
   --color-primary-800: #111216;
   --color-primary-900: #0c0d10;
   --color-primary-hover: #34353b; /* Button-Hover (Zeile ~136) */
   ```
   Surfaces optional minimal kühler: `--color-surface #fafafa→#fbfbfc`.

3. **Dark-Override der Rampe** (`.dark`-Block, Zeilen ~270–280). ⚠️ **Wrinkle:**
   `Button` nutzt hardcodiert `text-white` auf `bg-primary-600`. In Dunkel darf
   `primary-600` deshalb NICHT near-white werden (sonst weißer Text unlesbar).
   Zwei Wege:
   - **A (einfach):** Dunkel-Button bleibt **graphit** (`primary-600 #3a3b42`,
     weißer Text ok) — monochrom konsistent, KEINE Komponenten-Edits.
   - **B (invertiert, „echter" Tinte-Look):** `primary-600` dunkel = `#f2f3f5`
     + in E2 `Button` `text-white` → `text-[var(--color-accent-on)]` (Token, das
     in Dunkel dunkel wird). Sauberer, aber 1 Button-Edit.
   → **Empfehlung A** für E1 (kein Komponenten-Risiko), B optional in E2.
   Dunkel-Vorschlag (A): 50 `#202126` · 200 `#34363c` · 500 `#8a8d95` ·
   600 `#3a3b42` · 700 `#e6e7ea` (heller Link-Text) · hover `#45464d`.

4. **Status-Tags ergänzen** (neue Tokens im `@theme`, für das `Tag`-Primitive in
   E2). Werte = offener Punkt §8.4:
   ```
   --color-tag-indigo:#6366f1; --color-tag-teal:#0d9488; --color-tag-amber:#d97706;
   --color-tag-rose:#e11d48; --color-tag-violet:#7c3aed;   /* Dark: je +Helligkeit */
   ```
   `--color-success/warning/danger-*` existieren schon → bleiben (Status-Chips).

5. **5 tote Keyframes entfernen** (verifiziert 0 Nutzer): die `--animate-*`-Tokens
   `gradient-slow, shimmer, float, pulse-glow, border-flow` (Zeilen ~199–203) +
   die zugehörigen `@keyframes gradient, shimmer, float, pulse-glow, border-flow`
   (~206–225). **BEHALTEN:** `analysis-progress` (ManualImportFlow), `console-rise`,
   `st-rise`, `fade-in-panel`.

**Resultat E1:** Tinte-Akzent app-weit, Geist-Headlines, kühl-neutral, weniger CSS.
Visuell sichtbar überall, 0 Komponenten-Edits.

---

## E2 — Haptik & Primitives

**`src/components/ui/Button.tsx`** — Press-Feedback ergänzen (heute nur Farbe):
```
+ active:translate-y-px active:scale-[.99]
  secondary zusätzlich: hover:-translate-y-px
  transition-colors → transition-[colors,transform,box-shadow] duration-150
```
(Optional Weg B aus E1.3: `text-white` → `text-[var(--color-accent-on)]`.)

**`src/components/ui/Card.tsx`** — optionale interaktive Variante:
```
+ Prop `interactive?: boolean` → "transition-[transform,box-shadow,border-color]
  duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)]
  hover:border-neutral-300 active:translate-y-0"
```
(Bestehende statische Cards bleiben unberührt — additiv.)

**`src/components/ui/Table.tsx`** — klickbare Row: `duration-150` explizit setzen.

**`src/components/ui/Field.tsx`** — Focus-Ring auf einheitlich `ring-primary-500/25`
+ `ring-offset-1`; Disabled-Opazität auf `0.5` angleichen (heute 0.6).

**Neu: `src/components/ui/Tag.tsx`** — Kategorie-Tag (Dot + Label):
```tsx
export function Tag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-small text-neutral-600">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
```
Farbe je Studientyp aus den `--color-tag-*`-Tokens (Mapping = §8.4).

**`StatCard.tsx`** — optional kleines Linien-Icon-Slot oben rechts (wie Preview).

---

## E3 — Sidebar: kollabierbar + Icons

**`src/components/dashboard/DashboardSidebar.tsx`**
1. **Icon je `NavItem`:** `NavItem`-Typ um `icon: ReactNode` (oder Icon-Key)
   erweitern; eine kleine Icon-Map (Linien-SVG, `currentColor`, stroke 1.75).
   **Haus-Icon für `/dashboard` („Heute")**. Übrige: Studien=Kolben, Pool=Personen,
   Aus Gesprächen=Sprechblase, Research-Pläne=Liste, Cross-Study=Graph,
   Datenquellen=Datenbank, Einstellungen=Zahnrad.
2. **Collapse-State:** `useState(() => localStorage.getItem("klymeo.nav.collapsed")
   === "1")`, Toggle-Button im Footer (Chevron), Persistenz via `useEffect`.
   Eingeklappt: `w-16`, Labels per `sr-only`/Breite-0, Tooltips (`title` o. Popover),
   Captions/Akkordeon-Chevrons aus. Aktiv-Markierung + gleitende Pille bleiben.
3. **Aktiv-Icon:** Wash + Tinte-Leiste (heute) — optional gefülltes Icon (§8.3).

**`src/app/(app)/(dashboard)/layout.tsx`** — das `pl-60` muss auf den Collapse
reagieren. Sidebar ist client, Layout server → sauberster Weg:
- Kleiner Client-Wrapper `ShellFrame` (hält `collapsed`, rendert `<DashboardSidebar>`
  + `<div className={collapsed ? "pl-16" : "pl-60"}>`), ODER
- CSS-only: `collapsed` als `data-attr` auf einem gemeinsamen Wrapper, Main-Padding
  via `[data-nav-collapsed] ~ … / :has()`-Selektor.
→ **Empfehlung ShellFrame** (explizit, testbar). Breiten-Transition 340 ms `--ease`.

---

## Wichtig: Studien-Wizard (anderer Branch) — von E1 mitgestylt
- André hat einen **gefuehrten Studien-Wizard** gebaut (ersetzt das alte Formular):
  Branch `claude/focused-yonath-30ac5e`. Dateien u.a.
  `src/components/dashboard/guided-study/*`, `_prototype/study-wizard/*`,
  `market-research/new/page.tsx` (→ Wizard), `…/new/classic/page.tsx` (alte Form),
  `…/[id]/launch/page.tsx`, `messages/*.json` (`research.wizard.*`).
- **Er ist komplett token-basiert** → der E1-Remap (Violett→Tinte) stylt ihn
  automatisch. Live am `/studio` verifiziert (25.06.).
- **Koordination:** Wizard-Branch und Redesign-Branch müssen zusammengeführt
  werden. Überlappung praktisch nur in `globals.css` (Tokens) + `de/en.json`.
  Empfehlung: Wizard zuerst nach main, dann Redesign-E1 darauf — oder E1 in den
  Wizard-Branch ziehen. **Kein Doppel-Restyle nötig.**
- E4 ergänzt am Wizard nur Haptik/Disabled/Tag-Punkte (siehe Spec §5.5).

## Reihenfolge & Gates
E1 → E2 → E3, jeweils isoliert committen, je `tsc`+`vitest`+`build`+Multi-Linsen-
Review grün. E4 (Heute/Neue Studie), E5 (Glass-Cleanup), E6 (Teilnehmer-Flächen)
folgen separat (siehe Spec §7).

## Vor dem Start zu bestätigen (Spec §8)
- §8.3 **Aktiv-Icon** gefüllt? + finale Tinte-Hexe / Kontrast.
- §8.4 **Tag-Farben je Studientyp** + welche Typen (Brand, Allg. Befragung …).
- §8.2 **Palette-Temperatur** kühl-neutral so ok?
- Dark-Button **Weg A (graphit)** oder **B (invertiert, +1 Edit)**?
