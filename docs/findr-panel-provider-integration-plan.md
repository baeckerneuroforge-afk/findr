# Findr Market Research — Panel-Anbieter-Integration (Quelle 3)

> **Status:** Reiner Plan + Anbieter-Recherche. **Kein Code geändert.** Dieses Dokument
> bereitet eine Entscheidung vor (Anbieter-Wahl) und schneidet die spätere Umsetzung in
> einzeln baubare Etappen. Die Anbieter-Recherche (§1) ist web-recherchiert und
> adversarial gegengeprüft; Quellen sind pro Anbieter zitiert. Der Andock-Punkt (§2–§4)
> ist am echten Code gegroundet.
>
> **Datum:** 2026-06-01 · **Modul:** Market Research (`study_type=market_research`, M0–M3 live)

---

## §0 — Worum es geht (und die EINE Entscheidung, die der Plan nicht ersetzt)

Findr Market Research hat heute **zwei** Teilnehmer-Quellen:

1. **Eigene Liste / manuell** — Invite, Bulk, Teilnehmer-Pool (`participant_pool`,
   `20260620000000_participant_pool.sql`).
2. **Offener Studien-Link** — `research_open_links` (Baustein 2, E1–E5 live):
   `/interview/open/[token]`, `org_id NOT NULL`, Screening-Gate, `max_sessions`-Cap,
   `valid_until`-Ablauf, white-label, Consent-Schritt.

**Quelle 3 = externe Panel-Anbieter.** Damit wird findr. als vollwertiges „Panel"
wahrgenommen — wie **Outset**, das *keinen* eigenen Pool besitzt, sondern fremde Pools
(Prolific, User Interviews etc.) anzapft. Der Hebel: ein Findr-Kunde kann eine B2C-/B2B-
Markt­studie fahren, **ohne eine eigene Teilnehmerliste zu haben** — der Anbieter liefert
(und bezahlt) die Teilnehmer, findr. führt das KI-Interview.

### Die zentrale These dieses Plans

> Ein Panel-Anbieter braucht von findr. nur **zwei** Dinge: **(a)** die Interview-URL
> (= der bestehende offene Link) und **(b)** einen Rückkanal „Teilnehmer fertig". Der
> offene Link ist **bewusst** der Andock-Punkt und nimmt ~80 % der Arbeit ab. Was
> additiv fehlt, ist klein und folgt bestehenden Mustern.

Die Recherche bestätigt diese These technisch: **jeder** der untersuchten Anbieter
(Prolific, Cint, Dynata, Bilendi & respondi, Norstat, User Interviews, Respondent.io)
funktioniert nach dem Muster „externe Studien-URL + Respondent-ID als Query-Param +
Abschluss-Signal" — exakt das, was der offene Link liefert bzw. mit wenig additivem Code
liefern kann.

### Die Voraussetzung, die der Plan NICHT ersetzen kann

**André muss einen Anbieter wählen und den Vertrag/API-Key (bzw. bei account-gemanagten
Anbietern: das Projekt-Setup + die Redirect-Endpunkte) beschaffen.** Das ist eine
kommerzielle/rechtliche Handlung, kein Code. Der Plan bereitet alles *außer* diesem
Schritt vor — und §1 ist genau die Tabelle, auf deren Basis die Wahl getroffen werden
kann.

---

## §1 — Anbieter-Recherche (DACH/Europa, DSGVO, API-first)

### 1.1 Vergleichstabelle

| Anbieter | Typ | B2C | B2B | DACH/EU-Reichweite | EU-Hosting | DSGVO-Rolle ggü. findr. | API | Andock-Mechanik | Kostenordnung (pro Complete) |
|---|---|---|---|---|---|---|---|---|---|
| **Prolific** | Quant Access-Panel | **hoch** | niedrig/mittel | ~220k global, **DACH-Tiefe unbekannt** (nicht publiziert) | **ja** (GCP Belgien) | Eigenständiger **Controller**, **kein AVV**, findr. bekommt nur pseudonyme ID | **REST**, self-serve | externe URL + `PROLIFIC_PID` + **Completion-Redirect/-Code** | ~6–20 € (Reward + **42,8 %** Fee) |
| **Cint** (Exchange/Demand API) | **Aggregator** | **hoch** (tiefste DACH-B2C; besitzt GapFish 500k DE/AT/CH) | mittel | hunderte Mio. global via föderierte Panels; GapFish 500k DACH | **unklar** (US/EU/UK; non-EEA Sub-Prozessoren möglich → vertraglich pinnen) | Buyer = Controller, **Cint = Processor**; findr. bekommt nur **RID** | **REST** Demand-API + **S2S** | externe URL + `[%RID%]` + **S2S-Transition** + ClientCallBack-Redirect | ~2–8 € (CPI, bid-basiert) |
| **Dynata** | Quant Access-Panel | **hoch** (70M+ global) | mittel/hoch | großer EU-Footprint, kein publizierter DACH-Split | partial/unklar (US-HQ) | Controller des Panels; findr. bekommt nur `psid` | **REST** Demand-API + Exit-Links | externe URL + `psid` + **status-tragende Exit-Links** (`rst=1`) | ~3–10 € (CPI) |
| **Bilendi & respondi** | Quant Access-Panel | **hoch** (respondi = Top-3 DE) | niedrig/mittel | **2,5M** proprietär/13 Länder, **DACH-Kern** (respondi ~450k DACH) | **ja** (Île-de-France/FR) | **Controller** (Bilendi France); PII gestrippt → findr. bekommt nur 32-Zeichen-ID | **partial** (SOAP/REST-Webservices, aber **kein** self-serve Recruitment-API; account-gemanagt) | externe URL + Param `a` + **Redirect** (`survey.maximiles.com` `p=`/`m=`) | ~3,5–5 € (BilendiUX) bzw. RFQ |
| **Norstat** | Quant Access-Panel | **hoch** (owned DACH) | mittel | DE ~90k, AT ~10k, CH ~6k (Sekundärquellen) | wahrscheinlich (EU-HQ) | Controller; findr. bekommt nur Respondent-ID | **partial** (`api.norstatpanel.com`, partner-gated) | externe URL + Respondent-ID + **Redirect** (Spec partner-gated; via Conveo bestätigt) | ~3–9 € (kein Rate-Card) |
| **User Interviews** | Qual Recruiting | mittel | **hoch** (~2M+ Profis) | 6M Consumer + 2M+ Profis, **US-lastig**; DE/AT/CH unterstützt | **nein** (US/AWS+Heroku) | **Independent Controller** → findr. **bekommt Panelist-PII** (Ausnahme!) | **partial** (Recruit-API **partner-gated**; No-Code-Redirects GA) | externe URL + `?iid=` + **Redirect-back** (Status `submitted`) | ~$49 B2C / $98 B2B + Incentive + 3 % |
| **Respondent.io** | Qual Recruiting | mittel | **hoch** (~1,7M Profis) | 4M/150 Länder, „Germany Panel", **kein DACH-Headcount** | unklar (US) | Controller; bei Qual aber **reichere Profildaten** → PII prüfen | **REST self-serve** (echtes Recruitment-API) | externe `meetingLink` + **`Mark-as-attended`-API** (kein Redirect) | hoch: B2B ~75–250 €+ |

> **Lesehilfe „DSGVO-Rolle ggü. findr.":** Im **Quant-/Aggregator-Modell** (Prolific, Cint,
> Dynata, Bilendi, Norstat) hält der Anbieter die Panelisten-PII; findr. erhält **nur eine
> opake pseudonyme ID** — findr. fasst nie Panelisten-PII an. **Ausnahme:** User Interviews
> (und teils Respondent.io im Qual-Fall) übergeben echte Profildaten als
> *Independent Controller* → findr. wird selbst Verantwortlicher für diese PII. Das ist der
> rechtlich wichtigste Unterschied (§4).

### 1.2 Empfehlungs-Matrix (welcher Anbieter für welches Ziel)

| Ziel | Erste Wahl | Warum / Caveat |
|---|---|---|
| **Breites DACH-B2C-Volumen, programmatisch** | **Cint** | Bestdokumentierte externe-URL + S2S-Mechanik, besitzt GapFish (DACH); aber US-HQ-Aggregator → EU-Hosting/AVV vertraglich pinnen |
| **EU-gehostet, DACH-nativ, Qualität, Setup darf account-gemanagt sein** | **Bilendi & respondi** oder **Norstat** | Beste DSGVO-Posture (EU-Hosting, PII gestrippt); **kein** self-serve API → manueller/No-Code-Pfad (E0–E2) passt, E3 weniger anwendbar |
| **Einfachster programmatischer Start, research-grade, EU-Hosting, keine PII** | **Prolific** | Sauberstes REST-API, EU-Hosting, nur pseudonyme ID; aber **DACH-Tiefe unbestätigt**, **kein AVV-Papier**, schwaches B2B |
| **B2B / schwer erreichbare Entscheider** | **User Interviews** / **Respondent.io** | Stärkstes B2B; aber US-Hosting, bei UI **PII-Exposure**, höhere Kosten |
| **Pures programmatisches B2B mit API-Approve-Bezahlung** | **Respondent.io** | Einziges echtes self-serve REST-Recruitment-API mit `meetingLink` + `mark-as-attended` |

### 1.3 Anbieter im Detail (mit Quellen)

#### Prolific — *research-grade, sauberstes API, EU-Hosting, aber kein DPA & DACH-Tiefe unklar*
- **B2C/B2B:** ~220k aktive, verifizierte Teilnehmer / 38+ Länder / 80+ Sprachen; reines
  General-Population-Panel. B2B nur als Filter auf dem Consumer-Pool (Employment/Role) —
  schwach für harte Entscheider; Domain-Expert-Pricing nicht publiziert.
- **DACH/EU:** Wachstum u. a. Spanien/Frankreich/Schweden genannt; **keine** Deutschland-
  Zahl publiziert → **DACH-Machbarkeit vorab im In-App-Feasibility-Estimator prüfen.**
- **DSGVO:** EU-Hosting (Google Cloud **Belgien**). **Verweigert ein DPA/AVV** explizit:
  „we do not act as a data processor… Prolific is a controller". findr. bekommt **nur** die
  24-stellige pseudonyme `PROLIFIC_PID`, **nie** PII. → Kein AVV nötig (keine Auftrags­ver­
  arbeitung), *aber* auch kein AVV-Papier für eine Einkaufs-Checkliste, die zwingend eins
  verlangt.
- **API:** `POST https://api.prolific.com/api/v1/studies/` (Header `Authorization: Token`,
  non-expiring). `external_study_url` = **beliebige** eigene URL ist das **Primärmodell**:
  „Nearly all experimental software accessible via a shareable URL is compatible".
  `prolific_id_option=url_parameters` → `?PROLIFIC_PID=…` (+`STUDY_ID`,`SESSION_ID`),
  optional JWT-signierte „secure URL parameters". Zwei-Schritt: Draft anlegen → `transition
  PUBLISH`. **Harte Anforderungen an die URL:** anonymer Zugang (kein Login-Wall), ID
  speichern, Completion zurückmelden, **keine PII** erheben.
- **Completion:** Browser-**Redirect** zu `https://app.prolific.com/submissions/complete?cc=<CODE>`
  (empfohlen) ODER **Completion-Code** zum Einfügen (Fallback) + API-Approve. **Kein
  Webhook** → robust gegen Drop-offs sein (`NOCODE`-Fälle, wenn der Redirect ausbleibt).
- **Kosten:** Prolific zahlt den Teilnehmer; findr. zahlt Prolific. Reward (empfohlen
  £9/$12 pro Stunde, Minimum £6/$8) + **Platform-Fee 42,8 %** (corporate) / 33,3 %
  (academic), **VAT nur auf die Fee**. ~6–8 € all-in für ein 30-Min-Interview zum
  empfohlenen Reward; realistisch 8–20 € bei längeren/fair bezahlten/spezialisierten
  Interviews.
- **Quellen:** `docs.prolific.com/api-reference/studies/create-study` · `.../the-study-object` ·
  `docs.prolific.com/documentation/get-started/your-first-data-collection` ·
  `researcher-help.prolific.com/en/articles/445178-...` (externe-Software-Kompatibilität,
  4 Anforderungen, Completion-URL) · `.../445170-custom-completion-codes` ·
  `.../445211-...nocode...` · `researcher-help.prolific.com/en/article/bd4f89` (kein
  Processor/kein DPA) · `.../article/d678b2` (GCP Belgien, pseudonyme ID) ·
  `.../445239-what-is-your-pricing` + `prolific.com/pricing` (42,8 %/33,3 %).
- **Confidence:** hoch auf allen make-or-break-Mechaniken; medium/low nur bei DACH-Pool­
  größe, exakter VAT-Mechanik für DE-B2B-Käufer und B2B-Expert-Pricing.

#### Cint — *der programmatische Aggregator; tiefste DACH-B2C-Route; sauberste externe-URL+S2S-Mechanik*
- **Modell:** besitzt nicht selbst die meisten Panelisten, sondern **föderiert** viele
  Supplier-Panels (inkl. eigener **GapFish**: 500k+ ISO-zertifiziert DE/AT/CH). Damit
  effektiv der **tiefste einzelne Integrationspunkt für deutsche Consumer.**
- **DSGVO:** öffentliches, versioniertes **DPA** (`legal.cint.com`, v2026-01); Buyer =
  Controller, Cint = Processor; Panelisten-PII liegt bei Cint/Supplier → findr. bekommt nur
  die **RID**. **EU-only-Hosting nicht garantiert** (DPA erlaubt non-EEA-Sub-Prozessoren
  unter SCCs) → vertraglich festzurren.
- **API:** **Demand-API** (`developer.cint.com`) + **S2S-Fulfillment-API**. Externe URL mit
  `[%RID%]`-Token (+ beliebige `[%var%]`), z. B. `https://findr…/?rid=<GUID>`. **Completion
  hybrid:** zuerst `POST https://s2s.cint.com/fulfillment/respondents/transition`
  `{id:RID,status:5}` (5=Complete, 2=Screenout, 3=QuotaFull, 4=Quality), bei 200 **dann**
  Redirect zu `https://samplicio.us/s/ClientCallBack.aspx?RID=<RID>`. Session-Validierung
  `GET /fulfillment/respondents/{rid}`.
- **Kosten:** Cint/Supplier zahlt den Panelisten; Buyer zahlt CPI (Incentive + Fee +
  Supplier-Marge gebündelt). ~2–8 € B2C-Gen-Pop, deutlich mehr für low-incidence/B2B/lang.
- **Quellen:** `developer.cint.com/demand/docs/2025-12-18/getting-started/` ·
  `.../advanced-workflows/live-url/adding-variables-to-live-url` ·
  `.../core-workflows/how-to-server-to-server-api` ·
  `legal.cint.com/docs/data-processing-agreement-v2026-01` · `cint.com` (GapFish-Akquise).
- **Confidence:** hoch für API/externe-URL/Completion + Controller-Rolle; medium bei
  EU-Hosting und konkretem DACH-CPI (kein Rate-Card).

#### Bilendi & respondi — *EU-gehostet, DACH-nativ (Top-3 DE), Redirect-Integration dokumentiert, aber account-gemanagt*
- **Reichweite:** **2,5M** proprietäre Panelisten / 13 Länder (respondi brachte ~450k DACH
  ein, Köln-Herkunft); unter den **3 besten Panel-Suppliers in Deutschland**.
- **DSGVO:** **EU-Hosting** (Server **Île-de-France/Frankreich**, verbatim aus mingle-
  Datenschutz); Controller = **Bilendi France SAS** (Paris); Identitäts-/Profildaten werden
  **vor jeder Übergabe an Research-Partner entfernt** → findr. bekommt nur eine **anonyme
  32-Zeichen-ID**. Self-serve-DPA **nicht** öffentlich → beim Account anfordern.
- **API:** **partial** — Plattform exponiert SOAP/REST-Webservices, **aber kein
  öffentliches self-serve Recruitment-API**; Sample wird per RFQ/Account-Manager bestellt.
  **Externe URL + Redirect ist dokumentiert** (offizielles Unipark-Setup-PDF): Inbound-ID
  via URL-Param **`a`** (32 alphanumerisch), Echo zurück via `m=` an
  `https://survey.maximiles.com/<disposition>?p=PROJECTID&m=ID` (Complete/Screenout/
  Quotasfull/Quality/Speeder/Duplicate/GeoIP). *(Korrektur ggü. erstem Pass: Inbound-Param
  ist `a`, nicht `p_0001`; `maximiles.com` ist Legacy-Host — pro Projekt bestätigen.)*
- **Kosten:** Bilendi zahlt Panelisten; Buyer zahlt CPI. BilendiUX self-serve: Quant ab
  ~3,5 € (breit) / ~5 € (präzise) inkl. Incentive; Qual B2C ab ~40 €/h, B2B 140/250/350 €/h.
- **Quellen:** `bilendi.de/assets/images/academics/bilendi_redirects_unipark.pdf` (primär:
  Param `a`, Disposition-Redirects) · `mingle.respondi.co.uk/privacy-policy` (Controller,
  FR-Hosting, PII-Stripping) · `bilendi.co.uk/static/technology` (SOAP/REST, kein
  self-serve-Order-API) · `bilendi-ux.com/pricing` · `bilendi.us/static/studymarket` ·
  `support.soscisurvey.de/?qa=14161/...` (unabhängige Redirect-Bestätigung).
- **Confidence:** hoch auf externe-URL/Redirect/EU-Hosting/Controller; unklar bei
  öffentlichem DPA, Voll-Panel-CPI und aktuellem Redirect-Host.

#### Norstat — *DACH-natives Owned-Panel + Partner-REST-API*
- **Reichweite:** DE ~90k, AT ~10k, CH ~6k (Sekundärquellen); ~671k EU; ~14M via Partner.
- **DSGVO:** EU-Firma mit DPO/GDPR-Programm (EU-Hosting wahrscheinlich, nicht explizit
  EU-only bestätigt → vertraglich klären); DPA in der Praxis, kein self-serve-Dokument.
- **API:** **partial** — `api.norstatpanel.com` existiert, „100 % automatisierte API-
  Integration" beworben, aber **partner-gated**. Externe-URL+Redirect via Drittpartei
  (**Conveo**-Integration) belegt; exakte Endpunkt-/Status-Namen mit Norstat klären.
- **Kosten:** CPI, kein Rate-Card; ~3–9 € Gen-Pop, mehr für niche/B2B.
- **Quellen:** `api.norstatpanel.com/` · `norstat.co/solutions/integrated-service/` ·
  `conveo.ai/changelog/norstat-panel-integration` · `norstatpanel.com/en/norstat-gdpr` ·
  `norstat.co/b2b/survey-recruitment/`.
- **Confidence:** medium (Panelgrößen aus Sekundärquellen; API-Spec partner-gated).

#### User Interviews — *stärkstes B2B, aber US-Hosting + PII-Exposure*
- **Reichweite:** 6M Consumer + 2M+ Profis; B2B-Kernprodukt. 34 Länder inkl. **DE/AT/CH**,
  aber **US-lastig** → DACH-Dichte im In-App-Estimator prüfen.
- **DSGVO (kritisch):** **US-Hosting** (AWS+Heroku, keine EU-Residency). Öffentliches **DPA**
  mit EU-**SCCs Modul 1 (C2C)** für rekrutierte Panelisten und **Modul 2 (C2P)** für Hub;
  SOC 2 Type II / ISO 27001 / ISO 27701. **Wichtig:** für rekrutierte Panelisten sind beide
  Seiten **„separate and independent Controller"** → findr. **erhält Panelisten-PII**
  (Researcher sehen E-Mail/Profil), nicht nur eine pseudonyme ID → eigene Rechtsgrundlage
  nötig.
- **API:** **partial** — **No-Code „integration redirects" (GA):** externe URL bekommt
  `?iid=TRACKINGID` (→ `pp_123456`), Param-Name anpassbar; Completion = Redirect-back →
  Status `submitted`, plus **Incomplete-Redirect** für Screen-outs. **Recruit-API**
  (`POST /api/recruits`, Feasibility/Cost-Endpunkte) existiert, ist aber **partner-gated**
  (Application → PM-Review → Onboarding; Live-Partner u. a. Voicepanel, Userology, Converge).
- **Kosten:** $49 B2C / $98 B2B PAYG (+ Volume-Tiers) + Incentive + **3 %** Processing-Fee.
- **Quellen:** `userinterviews.com/support/integration-redirects` ·
  `api-docs.userinterviews.com/llms.txt` · `.../reference/post_api-recruits` ·
  `userinterviews.com/integrations` · `.../partners` · `.../pricing` ·
  `.../legal/data-processing-agreement` · `.../security` · `.../blog/gdpr-and-user-interviews` ·
  `.../support/supported-countries`.
- **Confidence:** hoch auf Mechanik/Pricing/DPA-Rollen; offen: exaktes API-Auth-Format
  (Seiten JS-Shell), DACH-Pooltiefe.

#### Respondent.io — *einziges echtes self-serve REST-Recruitment-API; B2B-stark*
- **Reichweite:** ~1,7M verifizierte Profis (B2B **hoch**), 4M/150 Länder, „Germany Panel",
  aber kein DACH-Headcount → modest für DE-B2C-Volumen.
- **DSGVO:** US-Firma, EU-Hosting/DPA **nicht öffentlich** → für DE-Controller vorab
  klären. Bei Qual reichere Profildaten an den Researcher → höhere PII-Exposure.
- **API:** **REST self-serve** (`developers.respondent.io`): Create Project (DRAFT) →
  Screener → Publish → **Invite participant mit `meetingLink`** (= externe URL) →
  **`Mark as attended`** triggert die Incentive-Zahlung (kein Redirect/Code-Modell).
- **Kosten:** Recruit-Fee pro Complete + buyer-finanzierte Incentive-Balance; B2B-Complete
  oft 75–250 €+.
- **Quellen:** `respondent.io/api` · `developers.respondent.io/projects/create-a-project.md` ·
  `.../screener-responses/invite-participant.md` · `.../Screener-responses/URL-Parameters-for-Project-Link.md` ·
  `.../screener-responses/mark-as-attended.md` · `respondent.io/blog/b2b-research-recruiting` ·
  `respondent.io/pricing`.
- **Confidence:** hoch für API-Lifecycle; medium-low für DSGVO/DACH-B2C.

### 1.4 Ausgeschlossen / abgewertet (Vollständigkeit)
- **Talowa:** als DACH-MR-Panel **nicht verifizierbar** (keine Firmenseite, kein
  marktforschung.de-/ESOMAR-Eintrag, kein API-Footprint). Wahrscheinlich verwechselt mit
  **Talk Online Panel** (AT/DE) oder **Toluna**. Es wurde **kein** Profil fabriziert.
  → Falls **Toluna** gemeint war: echtes Panel + API + externe-Survey-Routing, DACH-relevant
  — gehört in einen Folge-Sweep.
- **GapFish:** real (Berlin, 500k DE/AT/CH), aber **seit 2021 bei Cint** → Zugriff läuft über
  die Cint Demand-API (oben abgedeckt).
- **Pollfish/Prodege, Splendid Research/MOBROG, Attest:** je ein Caveat (Mobile-first /
  partner-gated / Survey-Plattform statt externe-URL-Andock). Direkt-Kontakt-Follow-ups,
  kein Top-5.

---

## §2 — Der Andock-Punkt am echten Code

### 2.1 Was der offene Link HEUTE schon liefert (≈80 % geschenkt)

Der offene Link ist exakt die „externe Studien-URL", die jeder Anbieter erwartet. Konkret
im Code vorhanden:

| Was der Anbieter braucht | Im Code bereits da | Datei/Anker |
|---|---|---|
| Eine teilbare, **anonyme** Interview-URL (kein Login-Wall — Prolifics harte Anforderung) | `{base}/interview/open/{token}`, service-role-Resolver, org/plan server-gebunden | `open-links.ts:98` `findOpenLinkByAccessToken`; `interview/open/[token]/page.tsx` |
| **Quota/Cap** auf die Teilnehmerzahl | `research_open_links.max_sessions` + `countOpenLinkSessions` (zählt vor dem Opus-Turn) | `20260629000000_open_link.sql:42`; `open-links.ts:230` |
| **Feldzeit-Ende** | `research_open_links.valid_until` + `isOpenLinkExpired` | `open-links.ts:63`; `open-link-expiry.ts` |
| **Screen-out** als first-class-Outcome | deterministisches `evaluateScreening` (KI-frei) → `rejected` ohne Session | `screen/route.ts:131`; `screening/evaluate` |
| **Teilnehmer-Consent / Datenschutzhinweis** | `ConsentStep` (Pflicht-Checkbox) + `open.consent.*` | `OpenLinkEntry.tsx:160`; `messages/de.json` `interview.open.consent.*` |
| **Session-Attribution** (zu welchem Link gehört das Gespräch?) | `interview_sessions.open_link_id` (nullable, `ON DELETE SET NULL`, partial index) | `20260629000000_open_link.sql:94` |
| **Frischer Session-Token** (geteilter Link wird NIE Session-Token) | `createResearchInterview({inviteId:null, openLinkId})` mintet frischen Token | `research-orchestration.ts:91,109,174` |
| **Interview-Abschluss-Zustand** (der Aufhänger für „fertig"!) | `interview_sessions.status='completed'` + `completed_at`; Client-`CompletedPanel` | `session-service.ts:733`; `InterviewChat.tsx:87,160` |
| **White-Label** (Anbieter-Teilnehmer sehen Kunden-Branding) | `getOrgBranding(link.org_id)` → `ParticipantShell` | `page.tsx:113` |

> **Fazit §2.1:** Der offene Link ist nicht „auch ein Andock-Punkt" — er ist *baulich
> deckungsgleich* mit dem, was die Anbieter-Mechaniken verlangen. Cap = Quota,
> `valid_until` = Feldzeit, Screening-Reject = Screen-out, Consent = Datenschutzhinweis,
> `completed` = Completion-Signal. **Keine** dieser Säulen muss neu gebaut werden.

### 2.2 Was additiv FEHLT (ehrlich, klein, musterkonform)

Die These „der Anbieter braucht nur die URL + einen Rückkanal" stimmt — aber der
**Rückkanal** und die **Teilnehmer-Attribution** sind im Code heute nicht vorhanden. Drei
kleine Lücken, alle additiv, alle nach bestehenden Mustern:

**Lücke A — Inbound-Respondent-ID wird nicht erfasst.**
Der offene Pfad (`page.tsx`, `screen/route.ts`) liest **keine** Query-Params; der
Request-Body trägt bewusst **nur** die Screening-Antworten (`BodySchema`, `screen/route.ts:74`),
und `createResearchInterview` (`research-orchestration.ts:91`) hat **kein** Feld für eine
externe Teilnehmer-ID. Für Attribution + Dedup + Completion-Callback muss findr. die ID aus
der Entry-URL (`?pid=<RID>`) lesen und **auf der Session persistieren.**

→ *Minimal-additiv:* **eine** nullable Spalte auf `interview_sessions` (z. B.
`panel_context jsonb` mit `{provider, recruitmentId, externalId}`), exakt wie `open_link_id`
und `screening_answers` additiv ergänzt wurden (`20260629…`, `20260628…`). **Keine** Änderung
an Bestands-Spalten, no-op solange nicht gesetzt.

**Lücke B — Es gibt keinen Completion-Rückkanal.**
`CompletedPanel` (`InterviewChat.tsx:87`) zeigt heute nur einen Dank — **kein Redirect**,
und die Session „weiß" nicht, zu welchem Anbieter / welcher Completion-URL sie gehört. Für
den Rückkanal muss findr. bei `status==='completed'` den Browser **outcome-verzweigt** zur
Completion-URL des Anbieters leiten (Complete vs. Screen-out vs. Quota-Full), die gespeicherte
ID anhängend.

→ *Additiv:* die Completion-/Screenout-URL-Templates **pro Recruitment** + der End-of-Flow-
Redirect. Der Screen-out-Pfad ist **schon da** (`evaluateScreening`→`rejected`) und muss nur
auf die Screenout-URL gemappt werden.

**Lücke C — Es gibt keine Recruitment-Konfiguration.**
Cap/Ablauf liegen schon am Link; **neu** ist die Anbieter-Bindung: welcher Provider, dessen
Study-ID, Completion-/Screenout-URLs, Inbound-Param-Name, Ziel-Kriterien.

→ *Additiv:* eine kleine Tabelle `research_panel_recruitments` (org-scoped, FK auf
`research_open_links`) — strukturell **exakt parallel** zur Art, wie `research_open_links`
selbst eingeführt wurde. Plus eine org-scoped Credentials-Tabelle für den API-Key,
**1:1 dem `hubspot_integrations`-Muster** (`20260523…`: `org_id unique`, `access_token`,
`enabled`, `sync_status`).

### 2.3 Der „Stufe 0"-Pfad: ein erster Anbieter MIT NULL Migration

Es gibt eine ehrliche, schema-freie MVP-Variante, die die These maximal respektiert — sinnvoll
nur als **Demand-Validierung mit Prolific** (oder einem anderen **Code-basierten** Anbieter):

- Researcher legt den offenen Link an (existiert), erstellt die Prolific-Study **manuell** im
  Prolific-Dashboard und trägt die Findr-URL ein.
- Auf dem `CompletedPanel` zeigt findr. einen **statischen Completion-Code** (konfigurierbare
  i18n-Copy), den der Teilnehmer in Prolific einfügt. **Kein** Inbound-Param, **kein** Redirect,
  **keine** Migration.
- **Ehrliche Grenzen:** keine Pro-Teilnehmer-Attribution, kein Dedup, keine Screen-out-
  Unterscheidung, nur Code-Anbieter. Gut, um „funktioniert die Schleife + gibt es Nachfrage?"
  zu beweisen — **nicht** der Endzustand.

> Damit ist die These sauber eingeordnet: **Ohne Code** geht ein erster Pilot (Code-Modus,
> ein Anbieter). **Für eine echte, anbieter-agnostische Panel-Quelle** braucht es die drei
> kleinen additiven Bausteine A/B/C — alle musterkonform, keiner berührt Bestand.

---

## §3 — Die Provider-Abstraktion (anbieter-agnostisch)

Die Recherche zeigt: die Anbieter unterscheiden sich **am stärksten im Completion-Modell**
(Redirect vs. Code vs. S2S vs. API-Approve) und in der **Frage, ob ein Recruitment
programmatisch erzeugbar ist** (Prolific/Cint/Dynata/Respondent: ja; Bilendi/Norstat:
account-gemanagt). Die Abstraktion muss daher **(1)** das Completion-Signal als
*discriminated union* modellieren und **(2)** „programmatisches Anlegen" als *optionale
Capability* führen, sodass account-gemanagte Anbieter sauber degradieren.

```ts
// NUR Skizze — nicht ausimplementieren. Capability-Flags trennen "kann self-serve anlegen"
// von "Completion-Handshake" (letzterer wird IMMER gebraucht).
interface PanelProvider {
  readonly key: "prolific" | "cint" | "bilendi" | "user_interviews" | string;
  readonly capabilities: {
    programmaticCreate: boolean;   // Prolific/Cint/Dynata/Respondent: true; Bilendi/Norstat: false
    completion: "redirect" | "code" | "s2s_then_redirect" | "api_approve";
    inboundParam: string;          // "PROLIFIC_PID" | "rid" | "a" | "iid" | ...
    exposesPanelistPII: boolean;   // User Interviews/Respondent(qual): true → §4-Sonderweg
  };

  // Optional (nur wenn programmaticCreate): Recruitment am Anbieter anlegen, das Panelisten
  // auf die FINDR-Open-Link-URL leitet. Bei account-gemanagten Anbietern: no-op / Hinweis,
  // der Researcher provisioniert im Anbieter-UI.
  createRecruitment?(input: {
    interviewUrl: string;          // = {base}/interview/open/{token}
    criteria: PanelCriteria;       // anbieter-agnostisch: country, language, role, segment, ...
    quota: number;                 // = research_open_links.max_sessions
    estimatedMinutes: number;
    rewardCents: number;
  }): Promise<{ providerStudyId: string; completionUrl: string; screenoutUrl?: string; status: "draft" | "live" }>;
  publishRecruitment?(providerStudyId: string): Promise<void>;

  // IMMER gebraucht: Findr-Terminal-Outcome → das anbieter-spezifische Completion-Signal.
  buildCompletion(input: {
    respondentId: string;
    outcome: "complete" | "screenout" | "quotafull" | "quality";
  }):
    | { kind: "redirect"; url: string }                              // Bilendi/Dynata/UI/Prolific
    | { kind: "code"; code: string }                                 // Prolific (Fallback)
    | { kind: "s2s_then_redirect"; transition: () => Promise<void>; url: string }  // Cint
    | { kind: "api_approve"; approve: () => Promise<void> };         // Respondent.io

  // Optional: eingehender Webhook (Provider → Findr), falls der Anbieter Completion pusht.
  handleWebhook?(payload: unknown): Promise<{ respondentId: string; outcome: string }>;
}
```

**Wie der erste Anbieter hineinpasst (Beispiel Prolific):**
- `createRecruitment` → `POST /api/v1/studies/` (Draft, `external_study_url=interviewUrl`,
  `prolific_id_option=url_parameters`, `total_available_places=quota`, `reward` in Cents,
  `completion_codes[]`).
- `publishRecruitment` → `POST /studies/{id}/transition/ {action:"PUBLISH"}`.
- `buildCompletion("complete")` → `{kind:"redirect", url:"https://app.prolific.com/submissions/complete?cc=<CODE>"}`
  (oder `{kind:"code", code}` im Fallback-Modus).
- `capabilities`: `{programmaticCreate:true, completion:"redirect", inboundParam:"PROLIFIC_PID", exposesPanelistPII:false}`.

**Wie ein account-gemanagter Anbieter hineinpasst (Beispiel Bilendi):**
- `capabilities.programmaticCreate=false` → `createRecruitment`/`publishRecruitment` fehlen;
  der Researcher trägt die Findr-URL im Bilendi-Projekt ein, findr. zeigt die fertige URL
  (aus `OpenLinkPanel`) + die zu hinterlegenden Redirect-Templates an.
- `buildCompletion` ist trotzdem implementiert: `{kind:"redirect", url:"https://survey.maximiles.com/<disposition>?p=<PID>&m=<respondentId>"}`,
  `inboundParam:"a"`.

> **Kernpunkt:** *Ein* Anbieter wird zuerst voll integriert; weitere docken über dasselbe
> Interface an. Der gemeinsame, **immer** benötigte Pfad ist `buildCompletion` +
> Inbound-Param-Erfassung (= Lücke A/B aus §2). `createRecruitment` ist die optionale Kür für
> API-fähige Anbieter. **Nicht** gegen einen konkreten Anbieter hart ausbauen — nur dieses
> Interface + ein einziger konkreter Adapter.

### 3.1 Welchen Completion-Mechanismus zuerst (aus der Landscape-Recherche)

Die universelle „kleinste gemeinsame" Mechanik ist **externe URL + Inbound-Respondent-ID +
outcome-verzweigter Completion-Redirect** (Prolific/Qualtrics-Panel-Konvention) — **jeder**
Anbieter unterstützt sie, selbst Cints Marktplatz endet in einem Redirect. **Reihenfolge:**

1. **Zuerst** den Redirect-Pfad (breiteste Anbieter-Abdeckung, **null** Anbieter-Credentials
   nötig): Inbound-ID lesen + bei Ende outcome-verzweigt 302 auf die Return-URL.
2. **Completion-Code-Anzeige** als nahezu kostenloser Fallback (nur die Redirect-Payload auf
   einem Fallback-Screen zeigen) — rettet Panelisten, deren Redirect ausbleibt.
3. **Danach pro High-Volume-Anbieter** der **S2S-/API-Approve-Pfad** (Cint
   `transition`-POST, Prolific Approve) — robust gegen Tab-Schließen, sauber complete vs.
   screenout vs. quotafull. **Pragmatik:** den S2S-Status-POST **direkt vor** dem finalen
   Redirect feuern → Fidelity + funktionierender Browser-Rückgabe.

> **Redirect vs. Webhook (die Abwägung):** Browser-Redirect ist universell und braucht keine
> Credentials, ist aber **überspringbar** (Tab zu → Anbieter erfährt nichts → Panelist evtl.
> unbezahlt). S2S/Approve ist robust, aber **anbieter-spezifisch** (eigener Endpoint, eigene
> Status-Taxonomie, eigenes Auth). Quellen: `developer.cint.com/.../how-to-server-to-server-api`,
> `docs.prolific.com/api-reference/studies/the-study-object`,
> `qualtrics.com/support/.../panel-company-integration/`.

---

## §4 — DSGVO / Recht für DACH (verankert am bestehenden Consent)

### 4.1 Die zentrale Erleichterung: findr. fasst (meist) KEINE Panelisten-PII an

Über **alle vier** Completion-Mechaniken hinweg gilt: der **Anbieter/Panel/Aggregator hält
die identifizierende Panelisten-PII** (Name, Kontakt, Demografie, Bezahlbeziehung). findr.
erhält **nur eine opake pseudonyme ID** (`PROLIFIC_PID` / Panel-`id`/`pid` / Cint-`RID`).
Prolific ist sogar selbst als UK-ICO-Controller registriert und stellt klar, dass Researcher
„cannot access participants' identifiable information". → **Im Quant-/Aggregator-Modell wird
findr. nicht zum Verarbeiter fremder Panelisten-PII** — es speichert nur die ID auf der
Session + das Interview-Transkript (das der Kunde/Org ohnehin besitzt).

**Ausnahme, hart zu beachten:** **User Interviews** (und Respondent.io im Qual-Fall) übergeben
als *Independent Controller* **echte Profildaten** (E-Mail/Profil) an den Researcher. Dann ist
findr./der Kunde **selbst Verantwortlicher** für diese PII und braucht eine eigene
Rechtsgrundlage + Datenschutz-Handling. Das `exposesPanelistPII`-Flag in §3 macht diese
Anbieter im Code sichtbar.

### 4.2 Verankerung am bestehenden Consent-Choke-Point

Der offene Link hat den Teilnehmer-Datenschutz **schon eingebaut**: `ConsentStep`
(`OpenLinkEntry.tsx:160`) erzwingt eine aktive Checkbox; die Copy (`messages/de.json`
`interview.open.consent.*`) sagt „Datenschutz", „vertraulich… ausschließlich für
Forschungszwecke", „nehme freiwillig teil", „keine sensiblen personenbezogenen Daten". Das
ist die Rechtsgrundlage für **das, was das Interview erhebt** — und exakt die Stelle, an die
ein **panel-spezifischer Zusatz** gehört (z. B. „Sie nehmen über *[Anbieter]* teil; Ihre
Antworten werden an *[Findr-Kunde]* übermittelt."). **Kein** neuer Consent-Mechanismus nötig
— nur additive Copy, lokalisiert, pro Recruitment ein-/ausblendbar.

> Wichtig: **Egal welcher Anbieter** — sobald das KI-Interview Freitext mit personenbezogenen
> Daten erhebt, ist findr./der Kunde dafür Verantwortlicher. Das deckt der bestehende
> Consent-Schritt bereits ab; Prolific legt diese Pflicht explizit dem Researcher auf.

### 4.3 Welche Verträge (AVV/DPA) nötig sind

| Beziehung | Nötig? | Detail |
|---|---|---|
| findr. (SaaS) ↔ Kunden-Org (Verantwortlicher) | **Ja** — bestehender SaaS-AVV | findr. ist Auftragsverarbeiter der Org für die Studiendaten. Produktweit, **nicht** panel-spezifisch. |
| Kunden-Org (bzw. findr.) ↔ **Quant-Anbieter** (Prolific/Cint/Dynata/Bilendi/Norstat) | **Meist nein** für Panelisten-PII | Anbieter ist *eigenständiger Controller*; keine Auftragsverarbeitung (Prolific verweigert AVV ausdrücklich). **Aber:** ein DE-Enterprise-Einkauf kann trotzdem ein AVV-Papier verlangen — **Rechtsurteil, kein technisches Faktum.** Cint stellt ein öffentliches DPA (Processor-Rolle); UI ebenfalls. |
| Kunden-Org (bzw. findr.) ↔ **PII-Anbieter** (User Interviews) | **Ja** — AVV/SCCs | UI liefert öffentliches DPA mit SCCs Modul 1 (C2C) / Modul 2 (C2P). |

### 4.4 Wo Teilnehmer-Daten liegen + EU-Hosting

- **Panelisten-Identität:** beim **Anbieter** (nicht bei findr.). findr. speichert nur die
  opake ID + Transkript.
- **EU-Hosting-Wetten:** **Prolific** (GCP Belgien ✓), **Bilendi & respondi** (Frankreich ✓),
  **Norstat** (EU wahrscheinlich) sind die EU-Hosting-Optionen. **Cint, Dynata, User
  Interviews, Respondent.io** sind US-HQ → Transfer über SCCs, vertraglich festzurren.
- **Incentive-Zahlung:** läuft **immer** über den Anbieter → **keine** Zahlungs-/Payout-PII
  bei findr.

---

## §5 — Timing: Was davon ist VOR den B2B-Onboardings nötig?

**Ehrliche Antwort: Nichts.**

Die B2B-Onboardings nutzen **Product Discovery / Customer Health aus den eigenen Calls und
der eigenen Teilnehmerliste** des Kunden — der Kunde hat seine Gesprächspartner (Sales-/CS-
Calls, eigene Interviewees) bereits. Externe **B2C-Panels** sind eine **andere** Quelle:
Fremde in eine Studie rekrutieren, **ohne** eigene Liste. Die Panel-Integration ist damit
**orthogonal** zum Onboarding eines B2B-Kunden.

- **Quelle 1 (eigene Liste)** und **Quelle 2 (offener Link)** decken die Onboardings
  vollständig ab.
- **Quelle 3 (Panel)** ist der **B2C-Expansions-Hebel** des MR-Moduls — relevant erst, wenn
  ein Kunde eine Markt­studie **ohne** eigene Teilnehmer fahren will.
- **Nichts** aus diesem Plan blockiert die Onboardings; **nichts** muss vorher gebaut werden.

> **Eine Nuance:** Wenn ein **früher** Onboarding-Kunde explizit am Tag 1 B2C-Panel-
> Recruiting will, *dann* werden Anbieter-Wahl + Etappe E1/E2 relevant — aber **nachfrage-
> getrieben**, nicht als Voraussetzung. Default-Empfehlung: **Onboardings zuerst**, Panel als
> bewusst nachgelagerter Wachstums-Baustein.

---

## §6 — Etappen-Schnitt (jede Etappe einzeln baubar, NACH der Anbieter-Wahl)

> **Voraussetzung (Plan kann sie NICHT ersetzen):** André wählt einen Anbieter aus §1 und
> beschafft **Vertrag + API-Key** (bei API-Anbietern) bzw. **Projekt-Setup + Redirect-
> Endpunkte** (bei account-gemanagten). Jede Etappe unten ist **danach** baubar; die
> Anbieter-Wahl bestimmt, welche Etappen anwendbar sind (siehe Hinweise).

### E0 — Zero-Migration-Pilot (optional, Demand-Validierung) — *Anbieter: Prolific (Code-Modus)*
- Konfigurierbarer Completion-Code/Return-Hinweis auf `CompletedPanel` (`InterviewChat.tsx:87`,
  reine i18n-Copy) + manuell angelegte Prolific-Study auf einen **bestehenden** offenen Link.
- **Keine** Migration, **kein** Provider-Code. **DoD:** ein Panelist durchläuft Consent →
  Screening → Interview → sieht den Code → wird in Prolific bezahlt.
- **Ehrliche Grenze:** keine Attribution/Dedup/Screenout-Unterscheidung. Nur als Beweis.

### E1 — Inbound-Attribution (additiv) — *für ALLE Redirect-Anbieter*
- `?<param>=<rid>` auf dem offenen Pfad lesen (`page.tsx`/`screen/route.ts`), externe
  Respondent-ID **auf der Session persistieren** (Lücke A): **eine** additive nullable
  Spalte (`panel_context jsonb`), Muster wie `open_link_id`/`screening_answers`.
- Dedup: gleicher `rid` am selben Link → kurzschließen (verhindert Doppel-Teilnahme/-Cost).
- **Noch kein** Provider-API. **DoD:** jede über einen Panel-Link erzeugte Session trägt die
  externe ID; tsc/build/i18n grün; null Verhaltensänderung für Nicht-Panel-Links.

### E2 — Completion-Handshake (additiv) — *für ALLE Redirect-Anbieter*
- Outcome-verzweigter Completion-**Redirect** beim Interview-Ende (`CompletedPanel` /
  `status==='completed'`, Lücke B): **Complete** vs. **Screen-out** (existiert schon:
  `evaluateScreening`→`rejected`) vs. **Cap-Full** (existiert: `isOpenLinkAtCapacity`).
- Completion-/Screenout-URL-Templates **pro Recruitment** (Lücke C, Minimal-Form).
- **E1+E2 = vollständige No-Code-Integration mit JEDEM Redirect-Anbieter** (Bilendi, Cint-
  manuell, Dynata, Norstat): der Anbieter legt die Study manuell an, findr. macht Entry +
  outcome-korrekten Exit. **DoD:** Panelist-Complete und Panelist-Screenout landen auf den
  richtigen Anbieter-Return-URLs; live mit dem gewählten Anbieter durchgetestet.

### E3 — Provider-Abstraktion + erster programmatischer Anbieter — *nur API-Anbieter (Prolific/Cint/Dynata/Respondent)*
- Das `PanelProvider`-Interface (§3) + `research_panel_recruitments`-Tabelle (org-scoped, FK
  auf `research_open_links`) + org-scoped Credentials-Tabelle (Muster `hubspot_integrations`)
  + **ein** Adapter (`createRecruitment`/`publishRecruitment` des gewählten Anbieters).
- Researcher legt ein Recruitment **aus findr.** an — dockt an `OpenLinkPanel`
  (`components/dashboard/OpenLinkPanel.tsx`) bzw. den M3-Market-Research-Flow
  (`app/(dashboard)/dashboard/market-research/[id]/page.tsx`).
- **DoD:** „Recruit via [Anbieter]"-Button erzeugt eine Draft-Study mit der Open-Link-URL und
  published sie; Cap↔Quota konsistent.

### E4 — Robustheits-Layer (S2S / Reconciliation) — *für den High-Volume-Anbieter*
- S2S-Transition (Cint) bzw. API-Approve (Prolific/Respondent) **vor** dem Redirect;
  Submission-Reconciliation; NOCODE/Drop-off-Handling; Quota-Sync.
- **DoD:** Tab-Schließen kann Completion nicht mehr fälschen/überspringen; Zahl-relevante
  Outcomes (complete/screenout/quotafull) sind serverseitig autoritativ.

### E5 — Zweiter Anbieter (beweist die Abstraktion) — *anderer Profil-Typ*
- Zweiter Adapter hinter demselben Interface (z. B. wenn E3 = Prolific B2C, dann
  **User Interviews** für B2B) — inkl. PII/Controller-Sonderweg (§4.1) am Consent-Layer
  (`exposesPanelistPII`).
- **DoD:** zwei Anbieter über dasselbe Interface; das Interface musste **nicht** umgebaut
  werden (Beweis der Genericity).

### Abhängigkeiten / Reihenfolge
```
Anbieter-Wahl + Key/Vertrag (André) ──► E0 (optional, Prolific) 
                                   └──► E1 ──► E2 ──► E3 ──► E4 ──► E5
                                        (E1/E2 reichen für No-Code-Redirect-Anbieter;
                                         E3+ nur für API-Anbieter)
```
- **Account-gemanagte Anbieter (Bilendi/Norstat):** E1 → E2 sind der Endzustand (E3
  entfällt, da kein self-serve API; das Recruitment wird im Anbieter-UI provisioniert).
- **API-Anbieter (Prolific/Cint/Dynata/Respondent):** E1 → E2 → E3 → E4; E5 optional.

### Offene Architektur-Notizen (für die Bau-Phase, nicht jetzt)
- **„Ein aktiver Link pro Studie"** (`research_open_links_plan_active_idx`): ein Recruitment
  bindet an diesen einen Link. **Mehrere Anbieter gleichzeitig** auf einer Studie
  (z. B. Prolific + Cint) brauchen entweder mehrere Links (heute 1/Studie) oder Unterscheidung
  per Provider/Param am selben Link → E5+-Thema.
- **Screening-Pflicht des offenen Links:** Open-Links setzen heute Screening voraus
  (`screen/route.ts:126`). Für Panels ist das ein **Vorteil** (Screen-out = first-class Panel-
  Outcome). Will eine Studie Panel-Recruiting **ohne** Findr-Screening, müsste diese
  Leitplanke gelockert werden — kleine, bewusste Entscheidung in E2.
- **Cap = Quota:** `max_sessions` ist der bestehende Kosten-/Volumen-Schutz; bei programmatischem
  Recruiting muss er mit der Anbieter-Quota synchron gehalten werden (E3/E4).

---

## Anhang — Konsolidierte Quellen

**Prolific:** docs.prolific.com/api-reference/studies/{create-study,the-study-object} ·
docs.prolific.com/documentation/get-started/your-first-data-collection ·
researcher-help.prolific.com/en/articles/{445178,445170,445211,445239} ·
researcher-help.prolific.com/en/article/{bd4f89,d678b2} · prolific.com/pricing ·
prolific.com/participant-pool
**Cint:** developer.cint.com/demand/docs/2025-12-18/{getting-started,advanced-workflows/live-url/adding-variables-to-live-url,core-workflows/how-to-server-to-server-api} ·
legal.cint.com/docs/data-processing-agreement-v2026-01 · help.cint.com/docs/generating-api-entry-links ·
cintaccess.zendesk.com/.../360039641551-Redirect-links · .../360039198012-Passing-Ad-hoc-Supplier-Variables
**Dynata:** developers.dynata.com/docs/demand-api/... · help.dynata.com/article/465-setting-up-survey-entry-links ·
help.dynata.com/s/article/Survey-Exit-Link-9de1fe12 · docs.rex.dynata.com/.../respondent-survey-flow ·
dynata.com/data-surveys/global-panel
**Bilendi & respondi:** bilendi.de/assets/images/academics/bilendi_redirects_unipark.pdf ·
mingle.respondi.co.uk/privacy-policy · bilendi.co.uk/static/technology · bilendi-ux.com/pricing ·
bilendi.us/static/studymarket · support.soscisurvey.de/?qa=14161
**Norstat:** api.norstatpanel.com · norstat.co/solutions/integrated-service · conveo.ai/changelog/norstat-panel-integration ·
norstatpanel.com/en/norstat-gdpr · norstat.co/b2b/survey-recruitment
**User Interviews:** userinterviews.com/support/integration-redirects · api-docs.userinterviews.com/llms.txt ·
userinterviews.com/{integrations,partners,pricing,security} · userinterviews.com/legal/data-processing-agreement ·
userinterviews.com/blog/gdpr-and-user-interviews · userinterviews.com/support/supported-countries
**Respondent.io:** respondent.io/api · developers.respondent.io/{projects/create-a-project,screener-responses/invite-participant,Screener-responses/URL-Parameters-for-Project-Link,screener-responses/mark-as-attended}.md ·
respondent.io/{blog/b2b-research-recruiting,pricing}
**Integration-Muster (Landscape):** qualtrics.com/support/.../panel-company-integration ·
docs.prolific.com/api-reference/studies/the-study-object · developer.cint.com/.../how-to-server-to-server-api ·
cint.com/customer-stories/...surveymonkey... (Aggregator-White-Label)

**Code-Anker (Andock-Punkt):** `supabase/migrations/20260629000000_open_link.sql` ·
`src/lib/research/open-links.ts` · `src/app/interview/open/[token]/page.tsx` ·
`src/app/api/interview/open/[token]/screen/route.ts` · `src/lib/research/research-orchestration.ts:91` ·
`src/components/interview/OpenLinkEntry.tsx:160` · `src/components/interview/InterviewChat.tsx:87` ·
`src/lib/voice-agent/session-service.ts:733` · `messages/de.json` (`interview.open.consent.*`) ·
`supabase/migrations/20260523000000_hubspot_integration.sql` (Credentials-Muster) ·
`supabase/migrations/20260628000000_screening.sql` · `supabase/migrations/20260620000000_participant_pool.sql` ·
`src/components/dashboard/OpenLinkPanel.tsx` · `src/app/(dashboard)/dashboard/market-research/[id]/page.tsx`

---

> **Methodik-Hinweis:** §1 entstand aus parallelen Web-Recherche-Agenten (je Anbieter eine
> eigenständige Recherche, danach ein **adversarialer Fact-Check** der entscheidungs-
> kritischen Behauptungen API/externe-URL/DSGVO/Kosten gegen die *eigenen* Anbieter-Docs).
> Korrekturen aus dem Fact-Check sind eingearbeitet (z. B. Bilendi-Inbound-Param `a` statt
> `p_0001`; Bilendi-CPI „ab 3,5 €" statt „ab 7 €"; UI hat EU-/UK-Vertreter benannt). Wo eine
> Behauptung nicht aus öffentlichen Quellen verifizierbar war (DACH-Pool-Tiefe bei Prolific/
> Norstat, exakte VAT-Mechanik, account-gemanagte API-Specs), ist das explizit als
> **Confidence: medium/low** markiert — diese Punkte gehören in das Erst-Gespräch mit dem
> gewählten Anbieter.
