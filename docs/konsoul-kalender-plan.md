# Konsoul im Kalender — Orchestrierung (PLAN, kein Code)

> 26.06.2026. Planungs-Analyse (3-Agent-Workflow: Recon Kalender + Recon Konsoul →
> Architekt). **Nichts gebaut.** Grundlage für die Entscheidung, ob/wie wir Konsoul
> in den Deferred-Activation-Kalender einbetten.

## 1. Was „Konsoul orchestriert im Kalender" heißt — und was NICHT

**Heißt:** Konsoul kann (a) den Aktivierungs-/Terminierungs-Stand der Org **lesen**
und kalenderförmige Fragen beantworten („welche Entwürfe sind ungeplant? was geht
diese Woche live? ist etwas überfällig?"), und (b) für einen **Entwurf** ein
zukünftiges Aktivierungs-Datum **vorschlagen** — der Mensch bestätigt per Klick,
der die **bestehende** Route `POST /api/research/plans/[id]/schedule` ruft (setzt
nur `scheduled_activation_at`, **verschickt nichts**).

**Heißt NICHT:** Konsoul schaltet nichts scharf, verschickt nichts, bewegt keine
Zeit von selbst. Verboten bleibt: `/activate` aufrufen, Auto-Confirm, `activation_
mode='auto'`, irgendein Cron/Timer, irgendeine zeitbasierte automatische
Entscheidung. „Orchestrieren" = **lesen + vorschlagen-dann-bestätigen, nie handeln.**

## 2. Die rote Linie (aus dem Code verifiziert)

`activatePlanNow` (`scheduler.ts:257-295`) ruft `releasePreparedInvites` →
`sendResearchInvite` pro Einladung — **das IST Versand/Recruiting**, exakt die
nicht-verhandelbare Konsoul-Leitplanke (nie Prolific/Versand/Invites/Pool/Open-Link)
und Art.-22-nah. ⇒ **`/activate` bekommt KEIN Tool, KEINEN Enum-Wert, KEINEN
Endpoint.** Fragt jemand Konsoul „geh live", lehnt er ehrlich ab (`emit_guidance`)
und verweist auf den manuellen Button im `ScheduleActivationPanel`.

Demgegenüber ist **Terminieren** das sichere Maximum: `/schedule` schreibt nur ein
Datum (CAS auf `status='draft'`), ist voll reversibel (Cancel), lehnt Vergangenheits-
Daten client- UND server-seitig ab, und `mode` ist hart `'manual'` — es feuert
nichts. Ein Mensch muss später trotzdem manuell `/activate` drücken.

## 3. Empfohlener Aufbau (zwei gestapelte, flag-gated Züge)

**Zug 1 — Lese-Tür (der Großteil des Werts, null Aktions-Fläche):**
neues org-scoped Read-Tool `get_calendar_context` (orgId per Closure, nie Arg) auf
`listResearchPlans(orgId,'market_research')` — dieselbe Quelle wie die Kalender-Seite.
Liefert einen NEUEN deterministischen Faktenblock (`scope:'calendar'`): pro Studie
`{studyId, title, status, activationState, scheduledActivationAt, activatedAt}` +
abgeleitete Zähler `{unscheduledDrafts, scheduledCount, overdueCount}` (in JS gezählt,
nie vom Modell). Fail-open, keine PII (keine Invitees/Pool/Mails). Zahlen/Daten
reisen in `data`, gerendert NEBEN der Prosa → das Modell kann kein Datum erfinden.

**Zug 2 — eine Aktion (`schedule_activation`, propose-confirm):**
Confirm-Klick ruft das BESTEHENDE `POST /…/schedule` mit `{scheduledActivationAt: ISO}`.
Wiederverwendung von `buildProposalFromArgs` / `ProposalBlock` / `ACTION_ENDPOINT` /
`logProposed`/`logDecision` **verbatim** — erweitern, nie forken. Das einzig wirklich
Neue ggü. den heutigen 4 Aktionen: ein **Datums-Argument** (`scheduledActivationAt`)
durchgefädelt Modell→Tool→Engine→Proposal→Confirm-Body, mit ISO-Konvertierung +
Zukunfts-Validierung + Vorbedingung „Studie ist Entwurf & ungeplant" (aus dem
Faktenblock). `destructive=false`, `costsModel=false`, aber trotzdem expliziter
Confirm.

## 4. Wo Konsoul „im Kalender" lebt (Oberfläche)

| Option | Pro | Contra |
|---|---|---|
| **A) Bestehendes Panel / ⌘K** (nur Read-Tool + Aktion, keine neue Kalender-UI) | Niedrigstes Risiko/Aufwand, alles wiederverwendet, inert per Flag | Nicht *buchstäblich* „im Kalender" |
| **B) Konsoul-Panel als Drawer auf `/dashboard/kalender`** *(empfohlen für „im Kalender")* | Visuell im Kalender; bestätigter Vorschlag + `router.refresh()` aktualisiert das Raster direkt | Etwas Layout-Arbeit; Preseed darf nie auto-submitten (wie `initialQuestion`/`?q=`) |
| **C) Inline-Zell-Chips** („Konsoul schlägt vor: planen" auf ungeplanten Entwurfs-Zellen, deterministisch, kein LLM pro Zelle) | Fühlt sich am orchestrativsten an, am sichersten (kein Modell im Zell-Pfad) | Meiste neue Render-Fläche; Chip kann nur den Dialog vor-öffnen, keine ehrliche konkrete Zeit |

**Empfehlung:** A für die Logik, **B** als die sichtbare „im Kalender"-Tür; C optional später.

## 5. Daten-Modell / Migration

**Keine neue Tabelle.** Der Kalender hat bereits `activation_*` an `research_plans`
+ `scheduler_events` (sein eigenes Audit). **Eine kleine Migration:** den
`konsoul_action_log.action_type`-CHECK um `'schedule_activation'` erweitern (DB-Backstop
für den Zod-Enum + `KONSOUL_PROPOSE_ACTION_TYPES`). Zwei getrennte Provenienz-Spuren
bleiben getrennt: Konsoul-Vorschlag (proposed/accepted/ignored) im `konsoul_action_log`
(metadaten-only, **das Datum NICHT dort** — counts ist Zahlen-Whitelist), die echte
Zustandsänderung im `scheduler_events.detail` der `/schedule`-Route.

## 6. Honesty-Vertrag (passt 1:1)

Datum/Zähler = deterministischer Read, neben der Prosa gerendert (Modell nennt nur
Werte aus `data`, nie „etwa nächste Woche"). orgId server-autoritativ (Closure +
`requireOrgIdOrError`). Kalender-Status-Antwort = `kind:'guidance'` (neutral, kein
grüner Pip); Termin-Vorschlag = `kind:'proposal'` — vom Tool-Pfad gesetzt, nie vom
Modell. Audit metadaten-only. Art.22: einziger automatischer Schritt ist ein
**Vorschlag**; jeder Effekt auf eine Person (Einladung) braucht weiterhin die
separate, spätere, manuelle Aktivierung.

## 7. Phasen (jede einzeln per Flag revertierbar)

- **Phase 0 — nur lesen** (`get_calendar_context` + Faktenblock + Renderer). Höchstes
  Wert/Risiko-Verhältnis. André testet Reads zuerst live.
- **Phase 1 — eine Aktion** (`schedule_activation`, propose-confirm) via Panel/⌘K (A).
  + CHECK-Migration. Inert bis Flags an.
- **Phase 2 — „im Kalender"** (Drawer auf `/dashboard/kalender`, B). Reine UI.
- **Phase 3 — optional** Zell-Chips (C, deterministisch).

Alles inert hinter neuem `NEXT_PUBLIC_KONSOUL_CALENDAR_ENABLED`, gestapelt auf
`NEXT_PUBLIC_KONSOUL_ACTIONS_ENABLED` (Merge byte-gleich bis André beide Flags setzt
+ Migration anwendet — gleiche Haltung wie P3). **Versand/Aktivierung ist in keiner
Phase.** Aufwand grob: P0 = M, P1 = M, P2 = S–M, P3 = M (optional).

## 8. Entscheidungen

**GETROFFEN (André, 26.06.):**
- ✅ **Oberfläche = Drawer auf `/dashboard/kalender`** (Option B). Der On-Calendar-
  Drawer ist der eigentliche Wunsch → **Phase 2 ist Teil des Kern-Lieferumfangs**,
  nicht optional. (A = ⌘K/Panel bleibt der Mechanismus dahinter; C = Zell-Chips
  optional später.)
- ✅ **Termin-Tiefe = Studie vorschlagen + Picker öffnen** (keine erfundene Uhrzeit).
  `schedule_activation` schlägt „plane Studie X" vor; der Confirm öffnet den
  bestehenden Termin-Dialog, der Mensch wählt die Zeit. Damit entfällt jedes
  Honesty-Risiko einer modell-erfundenen Zeit; der Confirm-Body trägt nur die vom
  Menschen gewählte ISO-Zeit.

**NOCH OFFEN (André/Anwalt):**
- **Scope-Feinheit:** `schedule_activation` deckt „setzen" + „verschieben" über
  dieselbe Route; Cancel weglassen (per Hand trivial). *(Empf.: so.)*
- **Rechtsstand:** „Termin vorschlagen" (≠ aktivieren) trägt u. E. **kein** Art.-22-
  Gewicht (kein automatischer Effekt auf eine Person). Anwalt bestätigen lassen.
- **Überfällig-Nudge:** soll Konsoul als Guidance auf „geplanter Entwurf, Zeit
  verstrichen, nie manuell aktiviert" hinweisen? (Reiner Read — leicht, ja/nein.)

## 9. Nebenbefund (NICHT Teil dieses Plans, aber im Code gesehen)

Die Recon hat im bestehenden Scheduler drei vorbestehende Schwachstellen markiert,
unabhängig von Konsoul: (a) `/activate` auf einen ungeplanten Entwurf (state `'none'`)
— CAS-Prädikat sollte `status='draft'` sein, nicht `activation_state='scheduled'`;
(b) `date-fns` ist NICHT in `package.json` (Plan-Doc nahm es an); (c) `setHours()`-
Zeitzonen-Bug (UTC auf Vercel) in `proposeSlots`. Separat ansehen, falls relevant.
