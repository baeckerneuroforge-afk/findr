# findr — Acceptable-Use-Klausel (Entwurf für die AGB, Abschnitt „Pflichten der Nutzer:innen")

**Status:** ENTWURF (E0, 2026-06-11) — **kein verbindlicher Rechtstext.** Vor Veröffentlichung anwaltlich prüfen und in die finalen AGB einarbeiten (die AGB-Seite trägt bewusst nur Platzhalter, s. `src/app/(marketing)/agb/page.tsx`).

**Zweck:** findr stellt einen KI-Interviewer für Forschungs- und Feedback-Gespräche bereit. Zwei Risiken muss die Vertragsebene strukturell ausschließen, unabhängig davon, was das Produkt technisch anbietet: (1) Einsatz im Arbeitsplatz-/Bewerbungskontext, der in Kombination mit Emotions-/Verhaltens-Einordnung in die Verbotszone des Art. 5(1)(f) KI-VO läuft, und (2) Nutzung von Auswertungen als automatisierte Einzelentscheidung gegen Teilnehmer (Art. 22 DSGVO).

---

## Klausel-Entwurf

**§ X Zulässige Nutzung des KI-Interviewers und der Auswertungen**

1. Die von findr bereitgestellten Interview- und Auswertungsfunktionen (einschließlich automatischer inhaltlicher Einordnungen von Antworten, etwa Stimmungs- oder Direktheits-Hinweisen) dienen ausschließlich der Markt-, Produkt- und Nutzerforschung sowie dem Einholen von Kundenfeedback.

2. Der Kunde verpflichtet sich, die Plattform und ihre Auswertungen **nicht** einzusetzen:
   a) zur Bewertung, Überwachung oder Auswahl von **Beschäftigten, Bewerberinnen und Bewerbern oder sonstigen Personen im Beschäftigungskontext** (einschließlich Praktika, Ausbildung und Personalentwicklung) sowie von **Lernenden in Bildungseinrichtungen**;
   b) zur **Ableitung von Emotionen oder Absichten aus biometrischen Daten** (insbesondere Stimme, Gesicht oder Verhaltensbiometrie) — die Plattform nimmt solche Auswertungen nicht vor, und der Kunde darf Transkripte oder Aufzeichnungen auch nicht zu diesem Zweck an Dritte oder eigene Systeme weitergeben;
   c) als alleinige Grundlage für **Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung** gegenüber Teilnehmenden, insbesondere für Vergütungs-, Ablehnungs- oder Ausschluss-Entscheidungen (etwa Panel-Rejections), Bonitäts-, Versicherungs- oder Beschäftigungsentscheidungen;
   d) zur **Identifizierung** von Teilnehmenden, die anonym oder pseudonym teilnehmen, oder zur Zusammenführung der Interviewdaten mit anderen Datenquellen zu diesem Zweck.

3. Automatische inhaltliche Einordnungen sind **Hinweise aus dem Wortlaut der Antworten, keine Tatsachenfeststellungen über innere Zustände oder Eigenschaften der Person.** Der Kunde stellt sicher, dass Personen, die Auswertungen einsehen, diese Einordnung kennen.

4. Bei einem Verstoß gegen Absatz 2 ist findr berechtigt, die betroffenen Funktionen oder den Zugang insgesamt zu sperren. Weitergehende Rechte bleiben unberührt.

---

## Begründung der Bausteine (für die anwaltliche Prüfung)

| Baustein | Grund |
|---|---|
| 2a Beschäftigung/Bildung | Art. 5(1)(f) KI-VO verbietet Emotionserkennung am Arbeitsplatz/in Bildung (seit 02.02.2025). findr wertet zwar nur Text aus (kein Emotionserkennungssystem i.S.d. Art. 3(39)), aber die Vertragsklausel hält den Anwendungsfall komplett aus der Grauzone — auch reputationsschützend. |
| 2b Biometrie-Verbot | Sichert die zentrale Designgrenze (nur Wortlaut, nie Stimme/Prosodie) auch gegen Downstream-Missbrauch durch Kunden ab. |
| 2c Art.-22-Sperre | Direktheits-/Stimmungs-Signale dürfen nie zu automatisierten Einzelentscheidungen werden (DSGVO Art. 22; zugleich Prolific-Policy-Konflikt bei Rejections). |
| 2d De-Anonymisierung | Schutz des Anonymitätsversprechens aus dem Teilnehmer-Consent (`interview.open.consent.intro`). |
| 3 Hinweis-Charakter | Spiegelt die Produkt-Copy-Regel („Hinweis aus dem Wortlaut, kein Urteil über die Person") in die Vertragsebene. |

**Querverweise:** Plan `../findr-turn-signals/docs/findr-turn-signals-plan.md` (§3 Rechtsanalyse, §4.6 Was bewusst nicht gebaut wird) · Kurz-DPIA `docs/findr-dpia-ki-interviews.md`.
