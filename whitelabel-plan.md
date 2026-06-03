# White-Label — Bauplan (Phase-4-Baustein)

> **Status:** Inventur + Plan. Kein Code, keine Migration, kein Commit geschrieben.
> **Stand:** 2026-05-29. Inventarisiert am echten Code (Worktree auf `ff2e195`, identisch zu `main`).
> **Branch:** `whitelabel-plan` (von `main`).

Ziel: Findr-Kunden (Enterprise, DACH B2B) sollen die **teilnehmer-/stakeholder-sichtbaren** Flächen
mit **eigenem Branding** versehen (Logo, Akzentfarbe, Markenname; später eigene Domain/Absender).
White-Label ist Enterprise-Politur — es geht um die Flächen, die *externe* Personen sehen, nicht um
die internen Findr-Nutzer.

---

## 0. Kernerkenntnis vorweg

Es gibt **keine separate "White-Label Interview"-Seite**. Was existiert, ist der `brandless`-Schalter
auf der bestehenden Interview-Seite:

- `src/components/interview/InterviewChat.tsx` rendert das `findr.`-Wortmarken-Logo und einen
  "Powered by findr."-Footer — **außer** wenn `brandless={true}`.
- `src/app/interview/[token]/page.tsx:106` setzt `brandless={isResearch}`: **Research-Interviews
  zeigen heute schon GAR KEIN Findr-Branding** (der Teilnehmer ist Kunde-eines-Findr-Kunden und hat
  keine Beziehung zu Findr). Post-Loss / Check-in zeigen weiter Findr.

Das ist der Hebel für White-Label v1: Die Research-Interview-Fläche ist **bereits neutral**. White-Label
füllt diese Leere mit dem **Branding des Findr-Kunden** — rein additiv, ohne bestehendes Findr-Branding
zu verdrängen und ohne Verhaltensänderung für post_loss/checkin.

---

## 1. Inventur — extern sichtbare Flächen

### A) Interview-Seite `/interview/[token]` (UNAUTHENTIFIZIERT, token-basiert)
Teilnehmer öffnen sie ohne Login. Drei Arten (`post_loss`, `checkin`, `research`).

- **Route/Provider:** `src/app/interview/[token]/page.tsx` — Server-Component, lädt Session via
  `getPublicSession(token)` (`src/lib/voice-agent/session-service.ts`), eigener
  `NextIntlClientProvider`-Subtree (nur `interview`-Namespace, Locale aus der Session hinter dem Token).
- **UI-Component:** `src/components/interview/InterviewChat.tsx`.
- **Findr-Literale heute:**
  - `InterviewChat.tsx:171` — `findr`-Wortmarke (Text + roter Punkt `bg-[#B00]`), nur bei `brandless={false}`.
  - i18n-Strings `interview.footer.default` ("Powered by findr. · …") und `interview.meta.defaultTitle`
    (messages/de.json + en.json).
- **Logo:** kein Bild — reine **Text-Wortmarke**. (`/public/logo.svg` existiert, wird hier NICHT genutzt.)
- **Akzentfarbe:** **hartkodierte Hex-Werte**, dominanter Akzent **`#5B2FD4`** (Senden-Button, User-Bubble,
  Fokus-Border, Typing-Dots). Keine CSS-Vars, keine Tailwind-Tokens — alles inline `bg-[#5B2FD4]` etc.

### B) Einladungs-/Reminder-E-Mails (extern an Teilnehmer)
- **Builder:** `src/lib/email/interview-invite.ts` (post-loss invite, check-in), `src/lib/email/research-invite.ts`
  (research invite + 24h/1h Reminder + ICS). **Transport:** `src/lib/email/resend.ts` (Provider: **Resend**).
- **Findr-Branding:** nur die **post-loss**-Mail trägt das `findr.`-Logo (`interview-invite.ts:108`,
  Inline-HTML-Text mit rotem Punkt) + Signatur/Footer-Strings ("Ihr Findr-Team" / "Powered by findr.",
  in de.json/en.json). **Research- und Check-in-Mails zeigen schon den Org-Namen statt Findr** (z. B.
  "Ihr Team von {org}") — wieder: research-Fläche ist bereits neutral.
- **Absender:** `process.env.INTERVIEW_FROM_EMAIL ?? "onboarding@resend.dev"` (`resend.ts:39`).
  **Kein** `info@hephaistos-systems.de` und **kein** hephaistos-Literal im Code gefunden — Absender ist
  vollständig env-getrieben, aktuell ein **einziger** globaler Absender (kein per-Org-Routing).
- **Akzentfarbe Mail:** hartkodiert `#5B2FD4` (CTA-Button) + Neutraltöne.
- **i18n:** vollständig (de/en), Copy im `email`-Namespace. research-Locale kommt aus
  `research_invites.language`; post-loss/check-in fest `"de"`.

### C) Shareable-Synthese-Link (stakeholder-sichtbar OHNE Login)
- **Existiert NICHT.** Alle Synthese-Routen (`/api/research/plans/[id]/synthesis[/pdf|/pptx]`) sind
  `requireOrgIdOrError()`-geschützt → nur eingeloggt. Es gibt kein öffentliches Report-Sharing.
- Das token-basierte Muster (`interview_sessions.access_token`) wäre die Vorlage, falls v2 so etwas will.
  → **Außerhalb v1-Scope** (eigener Baustein).

### D) PDF/PPTX-Export (kann an Stakeholder weitergegeben werden)
- **PDF (pdfkit):** `src/lib/pdf/generator.ts` (forecast/loss), `interview-report.ts`, `solution-report.ts`,
  `synthesis-report.ts`. **PPTX (pptxgenjs):** `src/lib/pptx/synthesis-deck.ts`. Routen unter
  `src/app/api/.../pdf|pptx/route.ts`.
- **Findr-Branding:** "Findr" hartkodiert in Header (z. B. `synthesis-report.ts:256`), Footer
  ("Findr · Research Synthesis · Confidential"), PPTX `pptx.author = "Findr"` + Titel-Slide + Slide-Footer.
  Dateinamen-Präfix `findr-*`. Akzent hartkodiert `#5B2FD4`. **Kein** eingebettetes Logo (rein Text/Shapes).
- **Heute:** vollständig hartkodiert, keine per-Org-Parametrisierung. `orgName` wird zwar durchgereicht,
  erscheint aber nur in Metadaten/Untertitel, nicht im sichtbaren Branding.

### Org-Daten & Theming (Substrat)
- **Multi-Tenant:** Clerk Organizations. `orgId` via `src/lib/auth/org.ts` (`requireOrgId()`),
  `session.orgId` → `organizations.clerk_org_id` → interne UUID `organizations.id`.
- **Org-Settings-Schema existiert bereits:** Tabelle `org_settings` (eine Zeile/Org, RLS, service-role),
  Migration `supabase/migrations/20260602000000_org_settings.sql`, Service `src/lib/settings/org-settings.ts`
  (`getOrgSettings` / `upsertOrgSettings`, zod-validiert). Heutige Felder:
  `auto_start_post_loss_interview`, `product_name`. **← idealer Andock-Punkt für Branding-Felder.**
- **Locale-Präferenz (Template für "wo lebt eine Org/User-Einstellung"):** dual — `findr.locale`-Cookie
  (per-Device, wird gelesen) + Clerk `publicMetadata.locale` (per-USER, durable). Quelle:
  `src/lib/i18n/locale-actions.ts`. **Achtung:** das ist eine *User*-Präferenz; Branding ist *Org*-Ebene.
- **Theming:** Tailwind v4 mit `@theme` in `src/app/globals.css` — CSS-Custom-Properties als Design-Tokens
  (`--color-primary: #6d28d9`, `--color-accent: #ef4444`, violet/alert/obsidian-Skalen). Ein
  org-spezifisches Akzent-Override **ist möglich** durch Setzen einer CSS-Var auf einem Wrapper-Element
  (`<div style={{ '--color-...': accent }}>`) — Tailwind respektiert die Kaskade ohne Rebuild.
  **ABER:** die externen Flächen (Interview/Mail/Export) nutzen diese Tokens NICHT — sie hartkodieren
  `#5B2FD4`. Das Token-System hilft also nur dem internen Dashboard, nicht den White-Label-Flächen direkt.

---

## 2. Scope-Vorschlag

### v1 — Branding-Anzeige (empfohlen, demo-tauglich für Enterprise)
Minimal white-label-bar machen, **rein additiv**, ohne Domain/DNS-Komplexität:
1. **Interview-Seite (research):** Kunden-**Logo** + **Akzentfarbe** + **Markenname** statt der
   heutigen Leere (`brandless`). Pilot-Fläche — keine Findr-Branding-Verdrängung, kein Verhaltenswechsel
   für post_loss/checkin.
2. **Einladungs-/Reminder-Mail (research):** Logo + Akzentfarbe + Markenname im Mail-Header/CTA
   (Absender bleibt vorerst der globale Findr/Resend-Absender → v2).
3. **PDF/PPTX-Export:** Markenname + Akzentfarbe + optional Logo in Header/Footer/Titel-Slide.

**Branding-Felder v1:** `logo_url`, `accent_color`, `brand_name`. Bewusst klein.

### v2 — Eigene Identität (eigener Baustein, komplex)
- **Eigener Mail-Absender / eigene Domain** (DNS, SPF/DKIM/DMARC-Verifizierung, Resend-Domains-API,
  per-Org-Absender-Routing). Deutlich größer, eigene Etappe.
- **Public Shareable-Synthese-Link** (neue token-Route, existiert heute nicht) — falls gewünscht.
- Eigene App-Domain / Custom-Domain fürs Interview (`NEXT_PUBLIC_APP_URL` ist heute global).

---

## 3. Datenmodell — wo die Branding-Felder leben

### Empfehlung: **Supabase `org_settings`** (NICHT Clerk publicMetadata)

Neue Spalten an die bestehende `org_settings`-Tabelle andocken
(`brand_name text`, `accent_color text` mit Hex-Check-Constraint, `logo_url text`), gespiegelt im
Service `src/lib/settings/org-settings.ts` (`OrgSettingsSchema` + `OrgSettings` + Reads/Upsert) — exakt
das etablierte Muster, mit dem `product_name` bereits dazukam.

**Begründung (gegen Clerk publicMetadata):**
1. **Branding ist Org-Ebene, nicht User-Ebene.** Clerks Locale-Präzedenz liegt in *user* publicMetadata.
   Branding gilt für die ganze Org — `org_settings` ist genau dafür da (eine Zeile/Org).
2. **Die Interview-Seite ist unauthentifiziert.** Der Teilnehmer hat keine Clerk-Session — ein
   Clerk-publicMetadata-Lookup von dort ist unbequem/teuer. Der Server kann dagegen über
   `interview_session.org_id → org_settings` **service-role** direkt lesen (genau wie `company`/`language`
   heute über `getPublicSession` kommen). Das ist der saubere, vorhandene Datenpfad.
3. **Logo braucht ohnehin Storage** (Supabase Storage Bucket). Die `logo_url` neben den anderen
   Org-Settings zu halten ist konsistenter als sie in Clerk-Metadaten zu streuen.
4. **Typisierung & Validierung** sind im Service (zod) schon vorhanden — Akzentfarbe als Hex validieren
   ist dort trivial und zentral.

**Migration (NUR Skizze, nicht geschrieben):** `alter table org_settings add column brand_name text`,
`add column accent_color text` (+ optional `check (accent_color ~ '^#[0-9A-Fa-f]{6}$')`), `add column logo_url text`;
`notify pgrst, 'reload schema'`. Plus Storage-Bucket `org-branding` (public-read) für Logos.

---

## 4. Datei-Liste, die ein Bau anfassen würde

> **Legende:** ✅ = NICHT von Etappe 5 berührt, parallel/jetzt baubar ·
> ⛔ = von Etappe 5 berührt → **erst NACH Etappe-5-Merge** anfassen (sonst Konflikt).
>
> **Etappe-5-Befund (verifiziert am Worktree `findr-i18n5`, uncommittete Änderungen):** Etappe 5 fasst
> die **Dashboard-Research-UI** an, **NICHT** die externen White-Label-Flächen. Konkret berührt sie:
> `messages/de.json` + `messages/en.json` (je ~+496 Zeilen!), `src/app/layout.tsx`, und ~25
> Dashboard-/Research-Components. **Sie berührt NICHT:** Interview-Seite, InterviewChat, E-Mail-Builder,
> PDF/PPTX-Generatoren, `globals.css`.

**Datenmodell (✅ alle frei):**
- ✅ `supabase/migrations/<neu>_org_branding.sql` (neu) — Branding-Spalten
- ✅ `src/lib/settings/org-settings.ts` — Schema/Service erweitern
- ✅ `src/types/database.ts` — generierte Typen (nach Migration)
- ✅ `src/components/settings/OrganizationSettingsForm.tsx` — Branding-Eingabe-UI (Logo-Upload, Color-Picker)

**Interview-Seite (✅ alle frei — Etappe 5 fasst sie NICHT an):**
- ✅ `src/lib/voice-agent/session-service.ts` — Branding aus `org_settings` mitladen (via `org_id`)
- ✅ `src/app/interview/[token]/page.tsx` — Branding an `InterviewChat` durchreichen, Akzent-Hex als CSS-Var setzen
- ✅ `src/components/interview/InterviewChat.tsx` — `brandless` zu "zeige Kunden-Brand" erweitern; `#5B2FD4` → CSS-Var

**E-Mail (✅ Builder frei; ⛔ Strings im Catalog):**
- ✅ `src/lib/email/research-invite.ts` — Logo/Akzent/Markenname in Header/CTA
- ✅ `src/lib/email/interview-invite.ts` (falls auch check-in/post-loss white-label werden sollen)
- ⛔ `messages/de.json` + `messages/en.json` — **größter Kollisionspunkt**, s. u.

**Export (✅ alle frei — Etappe 5 fasst die Generatoren NICHT an):**
- ✅ `src/lib/pdf/synthesis-report.ts`, `src/lib/pdf/interview-report.ts`, `src/lib/pdf/solution-report.ts`,
  `src/lib/pdf/generator.ts` — Markenname/Akzent/Logo parametrisieren (COLORS-Objekt + "Findr"-Literale)
- ✅ `src/lib/pptx/synthesis-deck.ts` — dito
- ⚠️ `src/components/dashboard/ExportSynthesisPdfButton.tsx` + `ExportSynthesisPptxButton.tsx` —
  **von Etappe 5 berührt** (i18n), aber White-Label muss diese Buttons vermutlich gar nicht anfassen
  (Branding fließt server-seitig in den Generator). Nur falls doch nötig → nach Merge.

**Theming (✅ frei; ⛔ layout):**
- ✅ `src/app/globals.css` — optional: White-Label-Flächen-Hex als CSS-Var-Default definieren
- ⛔ `src/app/layout.tsx` — von Etappe 5 berührt (1 Zeile); falls v1 dort einen Brand-Provider braucht → nach Merge

---

## 5. Knackpunkte

1. **Akzentfarbe ohne Theme-Umbau.** Die externen Flächen hartkodieren `#5B2FD4` inline — sie hängen NICHT
   am `globals.css`-Token-System. Sauberster v1-Weg: pro Fläche eine **lokale CSS-Var** auf dem Wrapper
   setzen (`style={{ '--accent': accent }}`) und die wenigen `bg-[#5B2FD4]`/`focus:border-[#5B2FD4]`-Stellen
   auf `bg-[var(--accent)]` umstellen — **kein globaler Theme-Umbau**, eng begrenzt auf InterviewChat.
2. **Branding muss in den eigenen NextIntlProvider-Subtree der Interview-Seite ankommen.** Die Seite hat
   einen separaten Provider (nur `interview`-Namespace, Locale hinter dem Token). Branding fließt aber
   **nicht** über i18n, sondern als **Props** aus der Server-Component (`getPublicSession` → org branding →
   `InterviewChat`). Wichtig: `getPublicSession` muss um die `org_id`-gestützte Branding-Abfrage erweitert
   werden — der Datenpfad existiert (company/language laufen schon so).
3. **Logo-Upload/Storage.** Neuer Supabase-Storage-Bucket, Upload-Action im Settings-Form, public-read
   URL in `org_settings.logo_url`. Validierung (Größe, Typ, Dimensionen). In E-Mail/PDF muss das Logo per
   **absoluter URL** (Mail) bzw. **Fetch+Embed** (PDF/PPTX, da pdfkit/pptxgenjs Bytes/Base64 wollen)
   eingebettet werden — pptxgenjs/pdfkit laden keine Remote-URLs von selbst.
4. **Akzentfarbe in HTML-Mail.** Mail-Clients verstehen keine CSS-Vars → Hex muss beim Build **inline
   interpoliert** werden (String-Template), nicht über Variablen. Kontrast/Lesbarkeit bei beliebiger
   Kundenfarbe beachten (heller Akzent → Text auf Button unleserlich; ggf. Luminanz-Check).
5. **Export-Header in pdfkit/pptxgenjs.** "Findr"-Literale + `COLORS`-Konstanten sind file-lokal. Branding
   muss als Parameter durch die Builder-Signaturen + alle aufrufenden API-Routen gereicht werden
   (Routen holen `getOrgSettings(orgId)` vor dem Build). Dateinamen-Präfix `findr-*` ggf. auf `brand_name`-Slug.
6. **`messages/*.json`-Kollision mit Etappe 5.** Etappe 5 fügt je ~496 Zeilen in de.json/en.json ein.
   Jede White-Label-Änderung an denselben Dateien (z. B. neutralisierte Footer-Strings, Branding-Settings-UI-Texte)
   gibt **brutale Merge-Konflikte**. → White-Label-String-Arbeit an den Catalogs **erst nach Etappe-5-Merge**
   oder bewusst auf Branding-only-Felder (DB) beschränken, die ohne neue i18n-Keys auskommen.
7. **Fallback-Verhalten.** Org ohne Branding → bisheriges Verhalten exakt beibehalten (research = neutral,
   post_loss = Findr). Branding-Felder default `null`; Anzeige nur wenn gesetzt. Additiv, kein Bruch.

---

## 6. Etappierung

**Schritt 1 — Datenmodell + Pilot auf EINER Fläche (Interview-Seite/research).**
Migration (Branding-Spalten + Storage-Bucket) → Service erweitern → Settings-Form-UI (Logo-Upload,
Color-Picker, Brand-Name) → `getPublicSession` lädt Branding → InterviewChat zeigt Kunden-Logo/Akzent
statt Leere bei `brandless`. **Liefert die Enterprise-Demo** und beweist den End-to-End-Pfad an der
risikoärmsten Fläche (bereits neutral, kein Findr zu verdrängen). **Komplett ✅ — kein Etappe-5-Konflikt.**

**Schritt 2 — Export (PDF/PPTX).** Branding durch Builder + Routen parametrisieren. ✅ frei.

**Schritt 3 — research-Einladungs-/Reminder-Mail.** Logo/Akzent/Markenname im Header. ✅ Builder frei;
falls neue i18n-Keys nötig → **nach Etappe-5-Merge** wegen de.json/en.json.

**Schritt 4 (= v2, eigener Baustein) — eigener Absender/eigene Domain.** DNS/DKIM/SPF, Resend-Domains-API,
per-Org-Absender-Routing. Optional public Shareable-Synthese-Link. Deutlich komplexer.

---

## TL;DR (Meldung)

- **Empfohlener v1-Scope:** Logo + Akzentfarbe + Markenname auf der **research-Interview-Seite**
  (Pilot, bereits neutral via `brandless`), dann **Export** (PDF/PPTX), dann **research-Mail**.
  Eigener Mail-Absender/eigene Domain = **v2**, eigener Baustein (DNS/DKIM komplex). Public
  Shareable-Synthese-Link **existiert nicht** → ebenfalls v2.
- **Wo Branding-Daten leben sollten:** **Supabase `org_settings`** (`brand_name`, `accent_color`,
  `logo_url`), via bestehenden Service `src/lib/settings/org-settings.ts`. NICHT Clerk publicMetadata —
  weil Branding Org-Ebene ist und die Interview-Seite unauthentifiziert ist (service-role-Read über
  `org_id` ist der saubere Pfad). Logo in einem Supabase-Storage-Bucket.
- **Kollisionen mit Etappe 5 (erst nach deren Merge baubar):** **`messages/de.json` + `messages/en.json`**
  (Etappe 5 ändert je ~496 Zeilen — größter Konfliktpunkt) und **`src/app/layout.tsx`**. Etappe 5 fasst
  die externen White-Label-Flächen **NICHT** an — **Interview-Seite, InterviewChat, E-Mail-Builder und
  PDF/PPTX-Generatoren sind frei** und können parallel/sofort gebaut werden. Nur die i18n-Catalog-Strings
  warten auf den Etappe-5-Merge.
