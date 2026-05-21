# Cohesion Check: letzte Findr-Sprints

Stand: 2026-05-21  
Scope: Sprint 4, 5, 6, 7-L, 8-L, 11-L, 12-L.  
Methode: statische Code-Analyse mit `rg`, gezielte Dateiprüfung, keine Tests, keine Runtime-Ausführung.

## Executive Summary

Die Kernkette `Deals -> Risk Scores -> Dashboard/Forecast/Search` ist gut verdrahtet. Risk-Orchestrator, Forecasting und Search/Filtering werden aktiv von den Dashboard-Flows genutzt und zeigen mit Demo-Daten etwas Sinnvolles.

Die größten losen Enden liegen dort, wo Features auf Datenereignisse angewiesen sind, die Demo-Seed oder Produktfluss aktuell nicht erzeugen:

- Loss-Analysis und Loss-Frühwarnung sind technisch verbunden, bleiben in Demo-Orgs aber leer, weil Demo-Seeding keine `closed_lost` Deals und keine `loss_reasons` erzeugt.
- Slack-Alerts sind teilweise end-to-end verdrahtet, aber die Slack-Buttons `Acknowledge` und `Snooze` haben keinen Interaction-Receiver. Sie sehen interaktiv aus, ändern aber nichts.
- Forecast-Page und Slack-Forecast-Change benutzen unterschiedliche Pipeline-Value-Formeln. Das kann zu Alerts führen, die nicht mit der sichtbaren Forecast-Zahl übereinstimmen.
- Signal-Namen werden an mehreren Stellen übersetzt. Das ist derzeit abgefedert, aber `multi_threading_failure` wird im Legacy-Risk-Result als `LATE_DECISION_MAKER` gespeichert, weil das alte Schema den neuen Signaltyp nicht kennt.

## Sprint 4: Risk-Orchestrator

| Prüffrage | Status | Beleg |
|---|---|---|
| Wird es aufgerufen? | **Verbunden** | Alle 8 Detectors sind im Registry-Array registriert (`src/lib/risk/orchestrator.ts:19-28`). `analyzeRisk()` aggregiert sie (`src/lib/risk/orchestrator.ts:40-69`). Aufgerufen wird der Orchestrator aus der Risk-API (`src/app/api/risk/route.ts:145-152`), dem Cron (`src/app/api/cron/reanalyze/route.ts:167-174`) und über den Legacy-kompatiblen `analyzeDealRisk()` Adapter (`src/lib/risk/classifier.ts:22-45`). |
| Zeigt es in der Demo etwas? | **Verbunden** | Demo-Orgs bekommen gespeicherte Risk-History aus `DEMO_RISK_SCORES` (`src/lib/seed/demo-data.ts:24-307`) und `insertRiskHistory()` (`src/lib/seed/demo-data.ts:458-533`). Deal-Detail liest diese Historie (`src/app/(dashboard)/dashboard/deals/[id]/page.tsx:53-60`) und rendert den Drilldown (`src/app/(dashboard)/dashboard/deals/[id]/page.tsx:109-120`). |
| Hängt es mit anderen Features zusammen? | **Stark verbunden** | Risk Scores füttern Dashboard (`src/app/(dashboard)/dashboard/page.tsx:81-98`), Forecast (`src/lib/forecast/service.ts:99-120`), Slack-Alerts (`src/lib/alerts/trigger.ts:39-67`) und Loss-Frühwarnung (`src/lib/loss/early-warning-service.ts:117-127`). |
| Lose Enden / Inkonsistenzen | **Teilweise lose** | Interne Signaltypen sind snake_case (`src/lib/risk/types.ts:1-9`), das gespeicherte Legacy-Schema ist SCREAMING_SNAKE_CASE und enthält andere Typen (`src/lib/schemas/risk.ts:3-12`). Der Adapter mappt `multi_threading_failure` auf `LATE_DECISION_MAKER` (`src/lib/risk/adapters.ts:16-25`), dadurch geht dieser neue Detector-Typ beim Persistieren semantisch verloren. |

## Sprint 5: Slack-Alerts

| Prüffrage | Status | Beleg |
|---|---|---|
| Wird es aufgerufen? | **Verbunden, mit Lücken** | Trigger-Funktionen existieren in `src/lib/alerts/triggers.ts:64-198`. `maybeTriggerRiskSpike` und `maybeTriggerChampionLost` werden zentral über `maybeTriggerAlert()` aufgerufen (`src/lib/alerts/trigger.ts:39-67`). `maybeTriggerAlert()` wird aus der Risk-API (`src/app/api/risk/route.ts:61-75`, `src/app/api/risk/route.ts:174-190`) und aus dem Cron (`src/app/api/cron/reanalyze/route.ts:198-212`) genutzt. `maybeTriggerDealLost` wird im Hubspot-Sync (`src/lib/hubspot/service.ts:486-506`) und Webhook (`src/app/api/webhooks/hubspot/deal-update/route.ts:53-67`) genutzt. `maybeTriggerForecastChange` wird im Cron aufgerufen (`src/app/api/cron/reanalyze/route.ts:230-236`). |
| Zeigt es in der Demo etwas? | **Teilweise** | Der Demo-Risk-API-Pfad ruft `maybeTriggerAlert()` auch bei Demo-Snapshots auf (`src/app/api/risk/route.ts:51-111`). Da `previousScore` dort `null` ist, feuert Risk-Spike nicht (`src/lib/alerts/triggers.ts:8-15`), aber Champion-Lost kann bei Demo-Deal-Signalen feuern (`src/lib/alerts/trigger.ts:52-67`). Forecast-Change läuft nur im Cron über real aktive Deals, weil Mock-Deals übersprungen werden (`src/app/api/cron/reanalyze/route.ts:58-64`, `src/app/api/cron/reanalyze/route.ts:124-133`). |
| Hängt es mit anderen Features zusammen? | **Verbunden** | Alerts konsumieren Risk-Analyse-Resultate, Loss-Events und Forecast-Changes. Dispatcher prüft Preferences, Quiet Hours, Dedup und Slack-Integration (`src/lib/alerts/dispatcher.ts:61-145`). Slack Settings UI speichert Webhook und Alert Preferences (`src/components/dashboard/SlackSettingsForm.tsx:71-110`, `src/components/dashboard/SlackSettingsForm.tsx:224-300`). |
| Lose Enden / Inkonsistenzen | **Lose bei Interactivity** | Block-Kit enthält `Acknowledge` und `Snooze 24h` Buttons (`src/lib/alerts/formatter.ts:24-51`), aber es gibt keinen Endpoint, der `acknowledge_alert` oder `snooze_alert_24h` verarbeitet. `rg` findet nur DB-Felder, Anzeige und Formatter, keine Mutation-Route. Die History kann `Acknowledged/Snoozed` anzeigen (`src/components/dashboard/AlertHistoryPanel.tsx:72-87`), aber nichts setzt diese Felder. |

## Sprint 6: Loss-Auto-Tagging + Reporting

| Prüffrage | Status | Beleg |
|---|---|---|
| Wird es aufgerufen? | **Verbunden** | `extractLossReason()` ist implementiert (`src/lib/loss/extractor.ts:211-239`) und wird in `analyzeAndPersistLossReason()` aufgerufen (`src/lib/loss/service.ts:24-73`). Diese Service-Funktion wird vom Hubspot-Sync bei Stage-Transition zu `closed_lost` genutzt (`src/lib/hubspot/service.ts:480-506`), vom Hubspot-Webhook (`src/app/api/webhooks/hubspot/deal-update/route.ts:32-70`) und manuell über `/api/loss/extract` (`src/app/api/loss/extract/route.ts:23-34`). |
| Zeigt es in der Demo etwas? | **Lose** | Demo-Seed erzeugt Deals, Calls und Risk-History (`src/lib/seed/demo-data.ts:501-533`), aber keine `loss_reasons`. Alle `MOCK_DEALS` sind offen; kein Deal hat `stage: "closed_lost"` (`src/lib/deals/mock-data.ts:10-210`). Zusätzlich skippt Loss-Extraction Mock-Deals explizit (`src/lib/loss/service.ts:36`). Ergebnis: Loss-Analysis ist für neue Demo-Orgs leer. |
| Hängt es mit anderen Features zusammen? | **Verbunden, aber datenabhängig** | Loss-Reports lesen `loss_reasons` und joinen Deal-Amounts (`src/lib/loss/reports.ts:131-160`). Loss-Analysis-Page rendert Report-Daten und Early Warning zusammen (`src/app/(dashboard)/dashboard/loss-analysis/page.tsx:35-69`). Deal-Lost Slack Alert bekommt Loss-Metadaten aus Hubspot-Sync/Webhook (`src/lib/hubspot/service.ts:499-504`, `src/app/api/webhooks/hubspot/deal-update/route.ts:62-65`). |
| Lose Enden / Inkonsistenzen | **Teilweise lose** | Hubspot-Sync extrahiert Loss-Reasons nur bei Transition eines bereits vorhandenen Deals von nicht-lost zu `closed_lost` (`src/lib/hubspot/service.ts:480-486`). Ein Deal, der beim ersten Import schon `closed_lost` ist, wird nicht analysiert. Der PDF-Endpoint liefert weiterhin JSON mit Phase-2-Hinweis (`src/app/api/loss/reports/pdf/route.ts:25-30`). Die `loss_reports` Cache-Tabelle wird nur beschrieben (`src/lib/loss/reports.ts:163-175`), aber im Code nicht gelesen. |

## Sprint 7-L: Confidence + Evidence

| Prüffrage | Status | Beleg |
|---|---|---|
| Wird es aufgerufen? | **Verbunden für UI** | `ConfidenceIndicator` ist implementiert (`src/components/dashboard/ConfidenceIndicator.tsx:12-59`) und wird im Risk-Drilldown für Durchschnitts-Confidence und pro Signal genutzt (`src/components/dashboard/RiskSignalDrilldown.tsx:146-181`, `src/components/dashboard/RiskSignalDrilldown.tsx:236-240`). `EvidenceQuote` ist implementiert (`src/components/dashboard/EvidenceQuote.tsx:18-54`) und wird für Signal-Quotes gerendert (`src/components/dashboard/RiskSignalDrilldown.tsx:276-295`). |
| Zeigt es in der Demo etwas? | **Verbunden** | Demo-Risk-Scores enthalten Confidence und bracketed Speaker/Role/Context-Quotes (`src/lib/seed/demo-data.ts:36-64`, `src/lib/seed/demo-data.ts:194-231`). `parseEvidenceQuote()` extrahiert diese Struktur (`src/components/dashboard/RiskSignalDrilldown.tsx:113-128`). |
| Hängt es mit anderen Features zusammen? | **Nur Anzeige** | Confidence kommt aus gespeicherten Risk-Signalen und wird angezeigt. Forecast nutzt eigene Forecast-Confidence, die nur von vorhandenem Risk Score und Aktivitätsalter abhängt (`src/lib/forecast/probability.ts:70-75`), nicht von Signal-Confidence. Die Win-Probability-Berechnung selbst nutzt `riskScore`, Stage und Activity (`src/lib/forecast/probability.ts:58-68`). |
| Lose Enden / Inkonsistenzen | **Lose bei echten Heuristic-Ergebnissen** | Der Adapter speichert nur `quote` und `reasoning`, aber nicht Speaker/Role/Context aus `SignalEvidence` (`src/lib/risk/adapters.ts:151-161`). Dadurch sehen echte Orchestrator-Analysen im Evidence UI weniger reich aus als Demo-Snapshots. Confidence beeinflusst keine Berechnung, obwohl sie als Qualitätsmerkmal sichtbar ist. |

## Sprint 8-L: Forecasting

| Prüffrage | Status | Beleg |
|---|---|---|
| Wird es aufgerufen? | **Verbunden** | `calculateWinProbability()` ist implementiert (`src/lib/forecast/probability.ts:58-92`). `getForecast()` lädt Deals plus aktuelle Risk Scores (`src/lib/forecast/service.ts:99-120`). Die Forecast-Page ruft `getForecast()` auf (`src/app/(dashboard)/dashboard/forecast/page.tsx:32-45`), und die API route liefert die gleichen Daten (`src/app/api/forecast/route.ts:5-17`). |
| Zeigt es in der Demo etwas? | **Verbunden** | Demo-Risk-History wird geseedet (`src/lib/seed/demo-data.ts:458-533`), `getForecast()` zieht aktuelle Risk Scores (`src/lib/forecast/service.ts:99-120`), und die Dashboard-Startseite baut daraus den Weighted Forecast (`src/app/(dashboard)/dashboard/page.tsx:100-110`, `src/app/(dashboard)/dashboard/page.tsx:176-190`). |
| Hängt es mit anderen Features zusammen? | **Verbunden** | Forecast nutzt Deals aus `getDealsByOrg()` und Risk Scores aus `getLatestRiskScoresForDeals()` (`src/lib/forecast/service.ts:99-120`). Dashboard Search/Filter sortiert zusätzlich nach `winProbability`, die aus `buildForecastSummary()` kommt (`src/app/(dashboard)/dashboard/page.tsx:100-110`, `src/lib/deals/filtering.ts:8-13`, `src/components/dashboard/DealTableWithFilters.tsx:363-376`). |
| Lose Enden / Inkonsistenzen | **Wichtige Inkonsistenz** | Die Forecast-Page berechnet Weighted Pipeline über Stage-Baseline, Risk und Engagement (`src/lib/forecast/probability.ts:58-68`). Der Cron berechnet Risk-adjusted Pipeline für Slack-Forecast-Change separat als `amount * (1 - riskScore/100)` (`src/app/api/cron/reanalyze/route.ts:24-50`). Dadurch kann ein Slack-Forecast-Change eine andere Metrik überwachen als die sichtbare Forecast-Page. Außerdem enthält Forecast `discovery` als Stage-Baseline (`src/lib/forecast/probability.ts:31-40`), während `DealStage` kein `discovery` kennt (`src/lib/deals/types.ts:1-8`). |

## Sprint 11-L: Search + Filtering

| Prüffrage | Status | Beleg |
|---|---|---|
| Wird es aufgerufen? | **Verbunden** | Dashboard-Page übergibt `tableDeals` an `DealTableWithFilters` (`src/app/(dashboard)/dashboard/page.tsx:194-199`). Die Client-Komponente liest URL-Params (`src/components/dashboard/DealTableWithFilters.tsx:69-89`), schreibt sie zurück (`src/components/dashboard/DealTableWithFilters.tsx:214-256`) und nutzt `applyDealFilters()` (`src/components/dashboard/DealTableWithFilters.tsx:207-210`). |
| Zeigt es in der Demo etwas? | **Verbunden** | Demo-Deals kommen aus Seed/Mock-Fallback (`src/lib/deals/service.ts:115-139`) und werden in der Pipeline angezeigt. Search, Stage/Risk/Owner Filter und Sortierung arbeiten client-side über dieselben Rows (`src/lib/deals/filtering.ts:102-128`). |
| Hängt es mit anderen Features zusammen? | **Verbunden** | Filter nutzt Risk-Level aus `risk_scores` (`src/app/(dashboard)/dashboard/page.tsx:81-98`) und Win-Probability aus Forecast (`src/app/(dashboard)/dashboard/page.tsx:100-110`). Analyze-Button bleibt in jeder gefilterten Row erhalten (`src/components/dashboard/DealTableWithFilters.tsx:418-422`). |
| Lose Enden / Inkonsistenzen | **Keine große Lücke** | `Clear filters` löscht Filter/Search, aber nicht Sortierung (`src/components/dashboard/DealTableWithFilters.tsx:249-256`). Das ist vertretbar, sollte aber begrifflich klar sein: es ist kein vollständiger Table-State-Reset. |

## Sprint 12-L: Loss-Frühwarnung

| Prüffrage | Status | Beleg |
|---|---|---|
| Wird es aufgerufen? | **Verbunden** | Mapping ist implementiert (`src/lib/loss/pattern-mapping.ts:4-15`), Matching ist implementiert (`src/lib/loss/early-warning.ts:33-78`), der Service verbindet historische Loss-Reasons mit offenen Deals und Risk Scores (`src/lib/loss/early-warning-service.ts:86-143`). Die Loss-Analysis-Page ruft `getEarlyWarnings()` serverseitig auf (`src/app/(dashboard)/dashboard/loss-analysis/page.tsx:35-69`). Es gibt zusätzlich eine API-Route (`src/app/api/loss/early-warnings/route.ts:5-17`), die von der UI aktuell nicht gebraucht wird. |
| Zeigt es in der Demo etwas? | **Lose** | Der Service braucht mindestens 3 Loss-Reasons (`src/lib/loss/early-warning-service.ts:103-109`). Demo-Seed erzeugt keine `loss_reasons` und keine `closed_lost` Deals (`src/lib/seed/demo-data.ts:501-533`, `src/lib/deals/mock-data.ts:10-210`). Die Demo hat zwar aktive Risk-Signale in Risk-History (`src/lib/seed/demo-data.ts:24-307`), aber keine historischen Loss-Patterns, gegen die gematcht werden kann. |
| Hängt es mit anderen Features zusammen? | **Sauber verbunden, wenn Daten da sind** | Frühwarnung nutzt Sprint-6 `loss_reasons`, Sprint-4/Seed `risk_scores`, und Deal-Daten (`src/lib/loss/early-warning-service.ts:91-127`). Das Panel zeigt Headline-Insight und Deal-Warnungen (`src/components/dashboard/EarlyWarningPanel.tsx:82-156`). |
| Lose Enden / Inkonsistenzen | **Datenlücke in Demo, semantische Lücke bei Compliance** | `compliance` wird auf `late_decision_maker` und `budget_friction` gemappt (`src/lib/loss/pattern-mapping.ts:4-15`), weil es keinen `compliance_friction` Risk-Detector gibt (`src/lib/risk/types.ts:1-9`). Dadurch kann ein Compliance-Loss-Pattern nur indirekt erkannt werden. High-Warnings sind bewusst noch nicht an Slack verdrahtet (`src/lib/loss/early-warning-service.ts:134-135`). |

## Datenfluss-Karte

### Sauber verkettet

- **Hubspot/Seed Deals -> Risk Scores -> Dashboard:** `getDealsByOrg()` liefert Deals (`src/lib/deals/service.ts:115-139`), Dashboard ergänzt aktuelle Risk Scores (`src/app/(dashboard)/dashboard/page.tsx:81-98`).
- **Risk Scores -> Forecast:** `getForecast()` ergänzt Deals mit aktuellem Risk Score (`src/lib/forecast/service.ts:99-120`).
- **Risk Scores -> Search/Filter:** Dashboard gibt Risk und Win-Probability an `DealTableWithFilters` weiter (`src/app/(dashboard)/dashboard/page.tsx:100-110`, `src/app/(dashboard)/dashboard/page.tsx:197-198`).
- **Risk Analysis -> Slack Risk/Champion Alerts:** Risk-API und Cron rufen `maybeTriggerAlert()` nach Persistenz auf (`src/app/api/risk/route.ts:174-190`, `src/app/api/cron/reanalyze/route.ts:198-212`).
- **Hubspot Closed-Lost -> Loss Extractor -> Loss Reports / Slack Deal Lost:** Hubspot Sync/Webhook rufen Loss-Analyse und Deal-Lost Alert auf (`src/lib/hubspot/service.ts:486-506`, `src/app/api/webhooks/hubspot/deal-update/route.ts:50-67`).
- **Loss-Reasons + Risk Scores -> Early Warning:** `getEarlyWarnings()` kombiniert beide Datensätze (`src/lib/loss/early-warning-service.ts:91-132`).

### Isoliert oder nur teilweise genutzt

- **Confidence:** Wird angezeigt, beeinflusst aber keine Forecast-/Risk-/Alert-Berechnung.
- **Slack Acknowledge/Snooze:** UI/Block-Kit existiert, aber keine Mutation/Interaction-Route.
- **Loss Reports Cache:** `loss_reports` wird nur geschrieben, nicht gelesen (`src/lib/loss/reports.ts:163-175`).
- **Early-Warning API:** Existiert, aber die Page nutzt den Service direkt. Das ist nicht kaputt, aber derzeit redundant.
- **`multi_threading_failure`:** Existiert im neuen Risk-Type-System, wird beim Legacy-Persistieren als `LATE_DECISION_MAKER` gespeichert.

## Inkonsistenzen

| Thema | Beobachtung | Beleg |
|---|---|---|
| Signal-Typen | Drei Naming-Universen existieren: interne snake_case Risk-Types, legacy SCREAMING_SNAKE_CASE Zod-Schema, Demo/Legacy `CHAMPION_DISENGAGEMENT`. | Intern: `src/lib/risk/types.ts:1-9`; Legacy: `src/lib/schemas/risk.ts:3-12`; Adapter: `src/lib/risk/adapters.ts:16-25`; Early-Warning Normalizer: `src/lib/loss/early-warning-service.ts:33-83`. |
| Fehlender Signaltyp | `multi_threading_failure` hat keinen Legacy-Pendant und wird als `LATE_DECISION_MAKER` gespeichert. | `src/lib/risk/adapters.ts:16-25`. |
| Compliance-Frühwarnung | Loss-Type `compliance` hat keinen echten Risk-Detector und mappt auf indirekte Signale. | `src/lib/loss/pattern-mapping.ts:4-15`; Risk-Types: `src/lib/risk/types.ts:1-9`. |
| Pipeline-Wert | Forecast-Page und Slack-Forecast-Change berechnen unterschiedliche risk-adjusted Values. | Forecast: `src/lib/forecast/probability.ts:58-68`; Cron: `src/app/api/cron/reanalyze/route.ts:24-50`. |
| Stage-Namen | Forecast kennt `discovery`, DealStage nicht. Hubspot normalisiert Decision/Demo/Presentation zu `demo`. | Forecast baseline: `src/lib/forecast/probability.ts:31-40`; DealStage: `src/lib/deals/types.ts:1-8`; Hubspot normalize: `src/lib/hubspot/service.ts:339-367`. |
| Demo-Verlustdaten | Mock-Deals sind alle offen und Loss-Extraction skippt Mock-Deals. | Mock stages: `src/lib/deals/mock-data.ts:10-210`; skip: `src/lib/loss/service.ts:36`. |

## Top-Lücken nach Impact

1. **Demo-Seed für Loss-Features fehlt.**  
   Impact: Hoch. Loss-Analysis und Sprint-12-Frühwarnung sind CRO-stark, aber neue Demo-Orgs sehen genau dort leere Zustände.  
   Konkreter Fix: 3-5 Demo-Closed-Lost-Deals oder historische `loss_reasons` seed-en, plus offene Deals mit passenden Risk-Signalen.

2. **Slack Acknowledge/Snooze wirkt interaktiv, ist aber nicht verdrahtet.**  
   Impact: Hoch für Demo-Vertrauen. Buttons erscheinen in Slack (`src/lib/alerts/formatter.ts:24-51`), es gibt aber keinen Receiver/Mutator.  
   Konkreter Fix: Entweder Buttons entfernen/als URL-only ausweisen oder Slack Interactivity Endpoint plus signed request verification bauen.

3. **Forecast-Change Alert überwacht nicht die gleiche Forecast-Formel wie die Forecast-Page.**  
   Impact: Hoch bei VP/CRO-Demos, weil Slack-Alert und sichtbare Forecast-Zahl auseinanderlaufen können.  
   Konkreter Fix: Cron soll `buildForecastSummary()` oder denselben Forecast-Service nutzen statt `getRiskAdjustedPipelineValue()`.

4. **Signaltyp-Übersetzungen verlieren Semantik.**  
   Impact: Mittel-hoch. `multi_threading_failure` wird als `LATE_DECISION_MAKER` persistiert, und `compliance` hat keinen eigenen Risk-Detector. Das schwächt Auswertungen, Early Warning und UI-Labels.  
   Konkreter Fix: Legacy Risk-Schema um neue Sprint-4-Signale erweitern oder `risk_scores.signals` auf internes Signalformat migrieren.

5. **Loss-Extraction verpasst bereits verlorene Deals beim Erstimport.**  
   Impact: Mittel. Historische Hubspot-Daten sind gerade für Reporting/Patterns wertvoll. Aktuell wird nur eine Transition eines bestehenden Deals analysiert.  
   Konkreter Fix: Beim Hubspot-Sync optional initiale `closed_lost` Deals backfillen, dedupliziert über `loss_reasons.unique(deal_id)`.
