# Konsoul P4 — Proaktiver Coach auf „Heute" (Design & Honesty-Vertrag)

> 26.06.2026. P4 der Konsoul-Orchestrator-Roadmap (`docs/konsoul-orchestrator-plan.md`).
> Gebaut nach Andrés Methodik: 10-Agent-Recon → Implementierung → adversariales
> Review (21 Agents) + fokussiertes Red-Team → alle Gates grün. **Keine Migration.**

## 1. Was P4 macht

Ein **flag-gated, gecachter Opus-Aufruf** formuliert die bereits *deterministisch
berechneten* „Nächste Schritte" (R1 Synthese-Lücke / R2 totes Feld / R3 alter
Entwurf) **und** die „Konsoul schlägt vor"-Signale (persona_gate / persona_quality /
recurring_theme) in **eine warme Coach-Kopfzeile** um. Die Kopfzeile ersetzt **nur**
die imperative Zeile; **jede Zahl bleibt** in der deterministischen Unter-Zeile
(`desc` „5 Interviews", `evidenceLabel` „Beleg: 3 Studien").

Das Modell bekommt **die Zählung nie** — der Prompt sendet nur `kind` + Studienname
(zahlenfrei). Eine erfundene Zahl wäre also reine Halluzination ohne Basis.

## 2. Honesty-Vertrag — strukturell erzwungen (`coach/engine.ts`)

`applyCoachAnchorFilter` lässt eine Kopfzeile nur durch, wenn sie ALLE Hürden nimmt
(spiegelt den kanonischen Cross-Study-Anchor-Filter, nutzt dasselbe `fold()`):

1. **bekannter key** (kein fremder/erfundener key);
2. **nicht leer, ≤160 Zeichen**;
3. **(Signale) Entität als ganzes fold()-Token** vorhanden — `containsAsToken`
   verhindert Substring-Treffer in fremden Wörtern („KI" in „marKIerung") und
   leere Entitäten (vakuumer Treffer);
4. **kein exotisches Unicode-Zahlzeichen** (römisch `Ⅷ`, Brüche `½`, eingekreist,
   nicht-lateinische Ziffern `٧`);
5. **keine erfundene ASCII-Ziffer** — Titel-Phrase wird gestrippt (nur wenn der
   Titel Buchstaben hat), danach darf KEINE Ziffer übrig bleiben → eine Zahl
   überlebt nur als Teil eines echten Titels („Pricing 2.0"), nie als „3 Gespräche"
   (schließt auch das Wäsch-Leck bei nackten Zahl-Titeln);
6. **kein erfundenes ausgeschriebenes Zahlwort** — Kardinalzahlen + deutsche
   Komposita (`einundzwanzig`) + `hundert/tausend/dutzend`-Morpheme nur erlaubt,
   wenn sie Token des Titels sind.

Fällt eine Kopfzeile durch → **deterministischer Fallback** (die alte Zeile bleibt).
Scheitert der ganze Aufruf → **leere Map** → alle Karten deterministisch.

**Ehrlich dokumentierter Scope:** ASCII-Römisch als Buchstaben („VIII") und
Ordinalzahlen („zwölfte") liegen beim **Prompt** (Soft-Guard), nicht beim
Struktur-Filter — eine robuste Struktur-Prüfung kollidiert mit echten Wörtern/
Akronymen. Risiko minimal, weil das Modell die Zählung nie sieht.

## 3. Reversibilität — inerter Merge

- Flag `NEXT_PUBLIC_KONSOUL_COACH_ENABLED` (default **AUS**, `coach-flag.ts`), exakt
  wie das P3-Actions-Flag.
- **Flag AUS** ⇒ die Heute-Seite rendert `HeuteCoachSections` **inline ohne Suspense**
  (kein Opus, keine Streaming-Marker) ⇒ **byte-gleich zum P1-Stand**. (Das Suspense-
  Wrapping ist selbst flag-gated — Review-Befund: eine unbedingte Suspense-Grenze
  hätte Stream-Marker injiziert.)
- **Flag AN** ⇒ Suspense-Loader; Fallback = deterministische Karten (sofortiges
  Malen), Coach verbessert progressiv; jeder Fehler/Timeout degradiert determ.

## 4. Sicherheit, Fail-open, Kosten

- **orgId server-autoritativ**, nie ans Modell; nur Cache-Scoping/Schlüssel. Engine
  liest keine DB; Items kommen aus den schon org-scoped Reads der Seite.
- **Fail-open doppelt** (Engine + Service): jeder Pfad → leere Map, wirft nie. Harte
  **12s-Wall-Clock-Deadline** (Promise.race) + `maxRetries:0` kappen die Latenz/Kosten.
- **In-process-Cache** (`coach/cache.ts`, wie `tts-cache.ts`) pro `org+locale+
  signal-hash`: 30 min für nicht-leere, **60 s für leere** Ergebnisse (transienter
  Fehler erholt sich schnell). Keine Teilnehmer-PII, nie persistiert/geloggt.
- **Coach-Input gecappt** auf die gerenderten ≤6 Items (≤3 next-steps + grounded
  `slice(0,3)` Signale) — kein Framing unsichtbarer Signale, kein Überlauf der
  `frames.max(12)`-Schranke.

## 5. Dateien

Neu: `coach-flag.ts`, `coach/{engine,prompts,cache,service}.ts` (+ `engine.test.ts`,
`service.test.ts`), `components/dashboard/HeuteCoachSections.tsx`.
Geändert: `dashboard/page.tsx` (Suspense flag-gated), `KonsoulSuggestions.tsx`
(optionale `frames`-Prop + `MAX_CARDS` exportiert).

Gates: **tsc 0 · eslint 0 · vitest src 1042 (37 neue Coach-Tests) · next build grün.**

## 6. Offen (André)

1. **Aktivieren:** `NEXT_PUBLIC_KONSOUL_COACH_ENABLED=true` in Vercel + redeploy.
   (Code/Merge ändert ohne das Flag nichts.)
2. Eingeloggtes Hands-on (Flag an, Org mit Daten) — wie bei P1–P3.
