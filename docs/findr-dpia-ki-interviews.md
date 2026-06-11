# Kurz-DPIA — KI-geführte Interviews (Text + Voice) inkl. inhaltlicher Auswertung

**Status:** Arbeitsdokument (E0, Stand 2026-06-11) — strukturiert nach Art. 35(7) DSGVO / WP248. Sorgfältige Selbsteinschätzung, **keine Rechtsberatung**; vor Enterprise-Deals und vor Aktivierung der Turn-Signale (E1+) anwaltlich gegenlesen lassen. Lebendes Dokument: bei jeder neuen Verarbeitungstätigkeit fortschreiben.

**Anlass (WP248-Kriterien):** „innovative Nutzung" (KI-geführte Interviews) + „Bewertung persönlicher Aspekte" (inhaltliche Auswertung von Antworten, künftig granulare Stimmungs-/Direktheits-Einordnung pro Antwort). Zwei Kriterien berührt → DPIA angeraten.

---

## 1. Systematische Beschreibung der Verarbeitung

**Verarbeitung:** Teilnehmende führen ein Interview mit einem KI-Interviewer — getippt (Text-Chat), gesprochen (LiveKit-Voice mit Speech-to-Text) oder per Push-to-talk. Transkripte werden gespeichert (`interview_sessions.conversation`) und automatisiert inhaltlich ausgewertet (Themen, Zitate, Session-Stimmung; geplant E1+: Einordnung von Stimmung/Direktheit **pro Antwort**, ausschließlich aus dem Wortlaut).

**Datenkategorien:** Interview-Antworten (Freitext — kann freiwillig preisgegebene personenbezogene Angaben enthalten), Sprach-Audio (nur transient zur Transkription; Persistenz: Transkript), abgeleitete Auswertungen (Insights, Stimmung, künftig Turn-Signale), optionale Screening-Antworten, optionale Screenshots beim Visual Capture (nach Auswertung verworfen, nur Text-Notizen verbleiben), Panel-Attributions-IDs (pseudonym, z. B. Prolific-PID), Einwilligungs-Nachweis (`consent_accepted_at`, `consent_version` — seit Migration 20260704000001).

**Betroffene:** Studienteilnehmende (anonym über Open-Link/Panels; B2B-Kontakte über Invite bei post_loss/checkin).

**Rollen:** Kunde = Verantwortlicher, findr = Auftragsverarbeiter (AVV erforderlich; Anhang Verarbeitungstätigkeiten um inhaltliche Auswertung inkl. Stimmungs-/Direktheits-Einordnung ergänzen). Für eigene Panels/Studien ist findr (Mit-)Verantwortlicher.

**Subprozessoren / Datenflüsse:** Supabase (DB-Hosting), Vercel (App-Hosting), Anthropic (LLM — Interview-Engine + Auswertung), LiveKit (Voice-Infrastruktur), Deepgram (Speech-to-Text), TTS-Anbieter (sofern aktiviert). Drittlandtransfers über SCC/DPF gemäß den jeweiligen DPAs absichern und im AVV listen. **Keine neuen Abflüsse durch E0/E1:** dieselben Transkripte gehen bereits heute zur Stage-1-Analyse an Anthropic; Turn-Signale erzeugen nur neue abgeleitete Felder.

## 2. Zwecke und Rechtsgrundlagen

| Verarbeitung | Zweck | Rechtsgrundlage |
|---|---|---|
| Interviewführung + Transkript | Markt-/Produkt-/Nutzerforschung, Kundenfeedback | Einwilligung (Art. 6(1)(a)) über Consent-Gate; bei B2B-Feedback (post_loss/checkin) hilfsweise berechtigtes Interesse (Art. 6(1)(f)) vertretbar — Consent-Gate wird dennoch einheitlich gezeigt |
| Inhaltliche Auswertung (inkl. Stimmung, künftig Turn-Signale) | Forschungs-Insights für den Verantwortlichen | Einwilligung; Consent-Texte benennen die Auswertung ausdrücklich („nur aus dem Text, nicht aus der Stimme") |
| Einwilligungs-Nachweis | Rechenschaftspflicht (Art. 5(2), 7(1)) | rechtliche Verpflichtung/berechtigtes Interesse |

**Koppelungsverbot:** Teilnahme-Anreize (Panel-Vergütung) bleiben unberührt; Ablehnung des Consent beendet nur die Teilnahme. **Kein Art. 9:** keine biometrische Verarbeitung zur Identifizierung, keine Gesundheits-Labels in der Auswertungs-Taxonomie (harte Designregel; verbotene Labels: Stress/Angst/Depression, Täuschung/Ehrlichkeit, Persönlichkeitsurteile).

## 3. Notwendigkeit und Verhältnismäßigkeit

- **Datenminimierung:** Voice-Audio wird nicht dauerhaft gespeichert (Transkript genügt dem Zweck); Visual-Capture-Frames werden nach Auswertung verworfen; Auswertungen speichern Labels + wörtliche Belegzitate (stehen ohnehin im Transkript), keine Embeddings/Audio-Features. Turn-Signale: nur Wortlaut als Input — keine Audio-Features, keine Timestamps, keine Latenzmuster (KI-VO-Designgrenze, Art. 3(39)).
- **Speicherbegrenzung:** Löschung der Auswertungen kaskadiert mit der Session. Offen → §6.
- **Transparenz:** KI-Offenlegung an jedem Einstieg (Consent-Gates, Voice-Intro, Chat-Subtitle/-Footer; Art. 50(1) KI-VO, Pflicht ab 02.08.2026) und in den Consent-Texten; Versionierung der Texte über `consent_version`.
- **Kein Backfill:** Bestands-Sessions wurden unter dem alten Consent-Text geführt → neue Auswertungsarten (Turn-Signale) nur für neue Sessions ab Aktivierung; Feature-Toggles default OFF (`signals_enabled`, geplant E1).

## 4. Risiken für Rechte und Freiheiten

| # | Risiko | Eintritt × Schwere | Kernszenario |
|---|---|---|---|
| R1 | Überraschende Verarbeitung: Teilnehmer weiß nicht, dass eine KI interviewt/auswertet | vor E0: mittel × mittel | „Ihr Interviewer" suggerierte ggf. einen Menschen |
| R2 | Fehlinterpretation der Auswertung als Persönlichkeits-/Wahrheitsurteil | mittel × hoch | Forscher liest „ausweichend" als „unehrlich" und entscheidet gegen die Person |
| R3 | Zweckentfremdung im Beschäftigungskontext (Art.-5(1)(f)-Zone) | niedrig × hoch | Kunde nutzt Plattform für Mitarbeiter-/Bewerbergespräche |
| R4 | Automatisierte Einzelentscheidung (Art. 22) | niedrig × hoch | Signale als Grundlage für Panel-Rejection/Auszahlung |
| R5 | Freitext enthält sensible Selbstauskünfte (Art.-9-Inhalte, freiwillig geäußert) | mittel × mittel | Teilnehmer erzählt ungefragt von Erkrankung |
| R6 | Unbefugter Zugriff auf Transkripte | niedrig × hoch | Token-Leak / fehlerhafte Mandantentrennung |
| R7 | Fehlender Einwilligungs-Nachweis | vor E0: hoch × niedrig | Consent nur als UI-Gate, nirgends persistiert |

## 5. Abhilfemaßnahmen (Stand E0)

- **R1 → behoben (E0):** explizite KI-Offenlegung an allen Einstiegen (Open-Link-Consent, neues Invite-Consent-Gate, Voice-Intro, Chat-Subtitle + -Footer, bestehende `voice.aiNotice`); Offenlegung liegt VOR der ersten Interaktion (Opening streamt erst nach dem Gate).
- **R2 → Produkt-Designregeln (Plan §4.2/§4.4, ab E1 scharf):** deskriptive, wertfreie Taxonomie ohne Gesundheits-/Täuschungslabels; Pflicht-Belegzitat pro Label; UI-Copy „Hinweis aus dem Wortlaut, kein Urteil über die Person".
- **R3 → AUP-Klausel** (Entwurf: `docs/findr-e0-aup-klausel-entwurf.md`): vertragliches Verbot Beschäftigten-/Bewerberbewertung + Biometrie-Weitergabe.
- **R4 → harte Produktregel:** Signale nie als Rejection-/Auszahlungs-Grundlage anbieten/exportieren (AUP 2c; Plan §4.6).
- **R5 → Consent-Texte** bitten ausdrücklich, keine sensiblen Daten preiszugeben; Auswertung labelt keine Gesundheitszustände. Restrisiko akzeptiert (Freitext ist Freitext).
- **R6 → bestehende TOMs:** 256-bit-Capability-Tokens, service-role-Zugriffe org-gescoped (Mandantentrennung in jeder Query), kein org_id-Leak an Clients, RLS-Muster, fail-closed-Routen. Consent-Endpoint: antwortet 204 ohne Body (kein Daten-Orakel), ignoriert den Request-Body vollständig, Zeitstempel ausschließlich server-seitig.
- **R7 → behoben (E0):** `consent_accepted_at` + `consent_version` (Migration 20260704000001), server-gestempelt, idempotent, an allen drei Eintrittspfaden (Open-Link, Invite mit/ohne Screening).

## 6. Offene Punkte (vor E1-Aktivierung schließen)

1. **AVV/Datenschutzhinweise:** Anhang Verarbeitungstätigkeiten + Teilnehmer-Datenschutzerklärung um Stimmungs-/Direktheits-Einordnung erweitern (Datenschutz-Seite ist noch Platzhalter).
2. **Aufbewahrungsfristen:** konkrete Retention für Sessions/Insights definieren und dokumentieren.
3. **Subprozessor-Liste** mit DPA-/Transfer-Status (SCC/DPF) formal führen.
4. **Turn-Signale (E1):** vor Launch diese DPIA um die konkrete Taxonomie + Eval-Ergebnisse (Genauigkeit, False-Positive-Schutz „kurz ≠ ausweichend") ergänzen; `signals_enabled` default OFF bestätigen.
5. **Anwaltliche Prüfung** von Consent-Texten, AUP und dieser DPIA.

**Querverweise:** Gesamtplan `../findr-turn-signals/docs/findr-turn-signals-plan.md` (§3 Rechtsanalyse) · AUP-Entwurf `docs/findr-e0-aup-klausel-entwurf.md`.
