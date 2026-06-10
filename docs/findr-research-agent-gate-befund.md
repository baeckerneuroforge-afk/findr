# Research-Agent: GATE-RED-Befund + Fix-Plan

> **NACHTRAG (Fix-Session, gleicher Tag):** F1–F4 sind auf
> `fix/research-agent-schema` gebaut. Dabei kam die entscheidende neue
> Erkenntnis: **Die Macke ist sonnet-spezifisch — und die Produktion läuft
> auf Opus.** Der Eval-Default (sonnet) maß ein Modell, das die Live-Route
> (`DEFAULT_RESEARCH_AGENT_MODEL = CLAUDE_MODELS.opus`) nie nutzt; Opus
> zeigt den Defekt in 14/14 gezielten Versuchen nicht. Der Roh-Payload
> (neue raw=-Diagnose im Retry-Warn) belegt zudem: sonnet legt in `items`
> einen String, der wie ein JSON-Array AUSSIEHT, dessen Inner-JSON aber
> kaputt ist — deshalb verpackt das Modell ihn überhaupt als String, und
> deshalb kann auch das F1-Self-Healing (JSON.parse) ihn nicht retten;
> client-seitige Blind-Reparatur wäre unseriös. Konsequenz zusätzlich zu
> F1–F4: **Eval-Default = Engine-Default (Single Source)** — das Gate misst
> jetzt das Produktionsmodell; der Sonnet-Spar-Tier-Check bleibt per
> `RESEARCH_AGENT_MODEL`-Override verfügbar und ist dort als bekannte
> Limitation dokumentiert. Sonnet-Läufe nach Fix: weiterhin exakt
> ra_05+ra_18 (3 Läufe konsistent), alle Anti-Halluzinations-Achsen grün.

**Datum:** 2026-06-10 · **Status:** Analyse, KEIN Code geändert · **Quelle:** 2×
`pnpm eval:research-agent` (claude-sonnet-4-6), voller Log des 2. Laufs in
diesem Doc verankert. Betroffene Engine: `src/lib/research-agent/engine.ts`
(der Frage-Agent über Studien-Synthesen, Route
`api/research/plans/[id]/agent`) — **von der Perf-Roadmap A–D unberührt**
(leerer Diff), der Befund existiert auf main unabhängig davon.

## Befund in einem Satz

Das GATE RED ist **kein Halluzinations-Problem, sondern ein
Schema-Robustheits-Problem**: In beiden Läufen scheitern exakt 2 von 22
Fällen daran, dass das Modell das Feld `items` als **String statt Array**
emittiert, der generische Retry das nicht korrigiert und der Engine-Call
hart abbricht — die Eval-Metrik verbucht diese Engine-Ausfälle irreführend
als „Anchor-Pass"-Fails.

## Beweiskette

1. **Metriken (beide Läufe identisch):** Anchor-Pass 20/22 [GATE] · 
   Halluzinierte Zahlen 0/22 · Korrekte-Absage 9/9 · Raw-Leakage 0.
   Die eigentlichen Anti-Halluzinations-Achsen sind makellos.
2. **Die 2 Fails sind Engine-Abbrüche, keine Anker-Verstöße:**
   `✗ engine call failed: Claude research-agent returned invalid JSON twice`
   bei **ra_05_number_trap** und **ra_18_lowest_frequency** (Lauf 2;
   reproduzierbar — Lauf 1 hatte ebenfalls exakt 2 Fails).
3. **Zod-Fehler beider Fälle wortgleich:**
   `items: ["Invalid input: expected array, received string", "Too big: expected string to have <=20 characters"]`
   → das Modell legt in `items` einen Prosa-/JSON-String ab (Double-Encoding);
   das `.max(20)` des Array-Schemas (`schemas/research-agent.ts:74`) wird auf
   die String-Länge angewandt → zweite Meldung.
4. **Gemeinsamkeit der Fälle:** Beide verlangen eine EXAKTE Zahl mit
   minimalem Deliverable (Zahlen-Falle / „nur das seltenste Thema, eine
   Frequency-Zahl"). Unter Präzisionsdruck kippt sonnet-4-6 in die
   Kurzantwort-als-String-Form.
5. **Warum der Retry nicht heilt** (`engine.ts:341-345`): Der Nag sagt nur
   generisch „Return ONLY a valid JSON object" — der Fehler IST aber ein
   valides JSON-Objekt; nur `items` hat den falschen Typ. Der Hinweis
   adressiert den Defekt nicht, Versuch 2 wiederholt ihn.
6. **Produktions-Relevanz:** Der gleiche Pfad bedient die Live-Route — ein
   Nutzer, der „nenne die exakte Zahl"-Fragen stellt, bekommt nach 2
   Fehlversuchen einen Fehler statt einer Antwort. Kein reines Eval-Thema.

## Fix-Plan (Reihenfolge = Priorität)

**F1 — Self-Healing vor Zod (Kern-Fix, additiv, risikoarm):**
In `callResearchAgentClaude` vor dem `safeParse`: wenn
`typeof toolUse.input.items === "string"` → `JSON.parse`-Versuch (try/catch);
gelingt er und ergibt ein Array, weiterreichen. Alternativ sauberer via
`z.preprocess` direkt am `items`-Feld des Schemas (dann greift es auch für
künftige Caller). Double-Encoding ist eine BEKANNTE Forced-Tool-Use-Macke —
strukturell heilen statt am Modell hoffen.

**F2 — Retry-Nag präzisieren:** Der attempt>0-Zusatz soll den KONKRETEN
Defekt benennen: „`items` MUST be a JSON array of objects — never a string.
Every field with its declared type." (Muster: `anthropic/structured.ts`
nennt im Nag explizit „arrays as arrays of objects (never as a string)" —
genau diese Formulierung fehlt hier.)

**F3 — Schema-Description härten:** `items`-Description im Tool-Schema um
„NEVER a JSON-encoded string" ergänzen (kostenlos, wirkt vor dem ersten
Fehlversuch).

**F4 — Eval-Hygiene (Reporting, kein Gate-Weichspülen):** Engine-Abbrüche
als EIGENE Metrik ausweisen („Engine-Verfügbarkeit n/22") statt sie in
Anchor-Pass einzurechnen. Das Gate darf bei Engine-Ausfall weiter RED sein —
aber die Diagnose muss auf den ersten Blick stimmen (diese Analyse hat den
Umweg gebraucht, weil „Anchor-Pass 20/22" nach Halluzination klingt).

**Optional F5 — Modell-Querprobe:** Ein Lauf mit
`RESEARCH_AGENT_MODEL=claude-opus-4-7` klärt, ob die String-Macke
sonnet-spezifisch ist (reine Diagnose, kein Fix-Ersatz: F1 muss trotzdem
rein, Modelle wechseln).

## Verifikation nach dem Fix

1. `pnpm eval:research-agent` **2× hintereinander** (Varianz!): Erwartung
   Anchor-Pass 22/22, 0 Engine-Abbrüche, GATE GREEN — und Raw-Leakage
   weiter 0 (F1 darf KEINE unanchored Items durchlassen; das Anchor-Filter
   sitzt dahinter und bleibt unverändert).
2. Gezielter Repro: ra_05 + ra_18 isoliert mehrfach treiben (die zwei
   Instructions sind die zuverlässigsten Trigger).
3. tsc/eslint/vitest wie üblich; die Engine hat KEINE weiteren Konsumenten
   des geänderten Codes (nur Route + Eval).

## Explizit NICHT anfassen

- Das Anchor-Filter (`applyAnchorFilter`) und der Downgrade-Mechanismus —
  die Garantie-Kette ist nachweislich wasserdicht (Leakage 0, Absagen 9/9).
- Die 22 Eval-Fälle selbst (sie haben den Defekt ja gefunden).
- `max_tokens`/`tool_choice`-Posture — Forced-Tool-Use bleibt; nur die
  Typ-Robustheit der Eingabe wird geheilt.
