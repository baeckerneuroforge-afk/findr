# Konsoul P5 — Politur: Inline-⌘K, Telemetrie, persistierte Threads (Design)

> 26.06.2026. P5 der Konsoul-Roadmap (`docs/konsoul-orchestrator-plan.md`).
> Gebaut nach Andrés Methodik: 10-Agent-Recon → Implementierung → 21-Agent-Review
> + Verifikation → Fixes → Gates grün. **Eine additive Migration (nur Entwurf,
> wird erst nach Andrés Go angewandt).**

## 1. Was P5 macht (drei Bausteine)

**A) Inline-⌘K-Q&A.** Die „Frag Konsoul"-Zeile im ⌘K-Modal beantwortet die Frage
JETZT direkt im Modal (POST `/api/konsoul-agent`, der bestehende Orchestrator)
statt nach `/insights` zu navigieren. Kompakter, kind-getriebener Renderer
(`KonsoulInlineAnswer`) mit derselben Honesty-Grammatik wie das Panel: grün nur
bei live-`grounded`, amber bei `interpretation`, ruhig bei `refusal`, neutral bei
`guidance` — inkl. des deterministischen `data`-Faktenblocks (Zahlen aus dem Tool,
nicht aus Modell-Prosa). Session-lokal, ein Zug; „Im Research-Raum öffnen" reicht
an das volle Panel weiter.

**B) Telemetrie.** Org-seitige Zähler in `konsoul_metrics` — **nur Metadaten**:
geschlossenes Event-Set (`inline_question_asked`/`inline_answer_shown`/
`thread_saved`/`thread_resumed`) + ein whitelisteter Zahlen-jsonb (Antwort-Art-
Zähler + `turn_count`). **Kein** Frage-/Antwort-Text. So zählt ein Dashboard „N
⌘K-Fragen, davon X geerdet" ohne je Inhalt zu speichern.

**C) Persistierte Threads.** Das `/insights`-Gespräch wird in `konsoul_threads`
gespeichert und überlebt einen Reload. `?thread=<uuid>` stellt es wieder her;
„Letzte Gespräche" listet die jüngsten. Service `saveThread/loadThread/
listThreads/deleteThread` + Routen unter `/api/konsoul-agent/threads`.

## 2. Sicherheit & Org-Scoping

- **orgId server-autoritativ** (`requireOrgIdOrError`), NIE aus Body/Client/Modell.
  Jeder Read/Write/Delete zusätzlich `.eq('org_id', orgId)`-gescoped; eine
  erratene/fremde `threadId` trifft 0 Zeilen → `loadThread`/`deleteThread` →
  null/no-op, `saveThread`-Update fällt auf einen FRISCHEN Insert mit der eigenen
  orgId zurück (kein Cross-Org-Übernehmen). RLS `current_org_id()` als zweites Netz.
- Routen **flag-gated** (`NEXT_PUBLIC_KONSOUL_P5_ENABLED`, default AUS → 404).

## 3. DSGVO

- **`konsoul_threads` = org-seitiger Konversationstext** (Nutzerfragen + Konsoul-
  Antworten, in der org-seitigen SYNTHESE geerdet — **keine Roh-Interview-
  Transkripte**: die Anker-Prüfung garantiert, dass Zitate aus Synthese-Text
  stammen). Dieselbe Klasse wie `study_synthesis` (Freitext, längst exportiert).
  `sanitizeTurns` persistiert NUR `{role, content}` — keine Zitate, kein result-
  Envelope, keine Zahlen-Blöcke (Zahlen werden beim Weiterführen frisch neu
  berechnet; ein persistiertes Zitat würde sonst veralten/lügen).
  ⚠️ **Bewusste Abweichung** vom `konsoul_action_log`-Freitext-Verbot (das ist
  eine Metadaten-/Audit-Tabelle; diese IST der Konversationsinhalt). Restrisiko:
  ein Org-Admin könnte Teilnehmer-Identifikatoren in eine FRAGE tippen — das landet
  org-seitig im Art.-15-Export. **Policy-Entscheidung André/Anwalt** (DSE-Notiz +
  optional ein Eingabe-Hinweis); kein Code-Defekt.
- **`konsoul_metrics` = nur Metadaten** (geschlossenes Event-Set + Zahlen-
  Whitelist, nicht-negative Ganzzahlen).
- **Auto-Abdeckung:** beide Tabellen tragen `org_id` → `delete_organization_data`
  + `export_organization_data` erfassen sie AUTOMATISCH (information_schema-Loop),
  keine Verdrahtung nötig. Retention: eigener Cron-Sweep (Threads 90 d auf
  `updated_at`, Metrics 180 d auf `occurred_at`, Code-Konstanten).

## 4. Honesty

- Eine **wiederhergestellte** Thread-Antwort wird NIE neu geerdet: `hydrateThreadTurns`
  gibt jedem Assistant-Turn ein NEUTRALES `guidance`-Envelope → nie grün, nie
  veraltete Zitate. `chipToneForKind` friert „grün nur bei live-grounded" ein
  (beide pur + unit-getestet, `render-helpers.ts`).
- Inline-`guidance`/`proposal` zeigen den deterministischen `data`-Block (Zahlen
  aus dem Tool; `completedSessions:null` → „—", nie 0) — derselbe Moat wie das Panel.

## 5. Fail-open / Resilienz

- Thread-/Metrics-Schreiben **fail-open**: ein Fehler entwertet NIE die schon
  gelieferte Antwort und blockt nie First-Paint (fire-and-forget, geloggt).
- **Cron fail-LOUD** (jeder Lösch-Fehler kippt den Lauf), ABER eine **noch nicht
  angelegte Tabelle** (42P01/PGRST205) ist ein BENIGNER Skip — sonst würde der
  Merge-vor-Migration-Zustand den ganzen DSGVO-Lauf auf 500 kippen und den Erfolg
  des Interview-PII-Sweeps maskieren (Review-HIGH, gefixt).
- `persistThread` ohne `keepalive` (dessen 64-KiB-Cap hätte lange Threads still
  verschluckt).

## 6. Reversibilität — inerter Merge

Flag AUS (Default): ⌘K-Zeile navigiert wie bisher, Panel ohne Persistenz, Routen
404, keine Schreibung in die neuen Tabellen, `/insights` unverändert. Migration
additiv + inert. Mergen + Migration-Anwenden ändern NICHTS, bis André das Flag setzt.

## 7. Dateien

Neu: `p5-flag.ts`, `metrics.ts`(+test), `threads/service.ts`(+test),
`render-helpers.ts`(+test), `KonsoulInlineAnswer.tsx`, drei Routen unter
`api/konsoul-agent/{threads,threads/[threadId],metrics}`, Migration
`20260725000000_konsoul_p5.sql`. Geändert: `CommandPalette.tsx` (Inline),
`CrossStudyAgentPanel.tsx` + `insights/page.tsx` (Threads), `cron/retention`
(Sweeps), `konsoul-retention.ts` (Konstanten), `db.ts` (Typen), i18n.

Gates: **tsc 0 · eslint 0 neu · vitest src 1064 · next build grün.**

## 8. Offen (André)

1. **Migration anwenden** (`20260725000000_konsoul_p5.sql`) — Entwurf, wartet auf
   dein Go (ich wende sie per Supabase-MCP an, sobald du bestätigst).
2. **Aktivieren:** `NEXT_PUBLIC_KONSOUL_P5_ENABLED=true` in Vercel + redeploy.
3. **DSE/Policy:** `konsoul_threads` als org-seitigen Konversations-Store (90 d,
   im Art.-15-Export) im Verarbeitungsverzeichnis vermerken (siehe §3).
