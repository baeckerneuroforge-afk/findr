# Klymeo Marketing — DE→EN Glossar & Übersetzungs-Brief

**Positionierung (entschieden 17.06.):** mehrsprachig DE+EN. Klymeo führt Interviews
**auf Deutsch UND Englisch** (Text-Studien real EN; Voice-Fokus aktuell DE). Wo immer im
DE-Text „auf Deutsch" als Verkaufsargument steht, wird daraus EN: **„in German and English"**
(oder kontextuell „in your participants' language"). DSGVO/EU-Hosting bleibt das
Differenzierungs-Argument.

**Ton:** Direkt, warm, kompetent — wie das Deutsche (kein „Sie/du" im Englischen; „you").
Keine erfundenen Zahlen/Zitate/Kunden. Markt-Forschungs-Vokabular, nicht Werbe-Floskeln.
Klymeo bleibt **Klymeo** (Eigenname, nie übersetzen).

## Marken-/Domänen-Begriffe (kanonisch — IMMER so übersetzen)

| Deutsch | English |
|---|---|
| KI | AI |
| KI-Interview / KI-geführt | AI interview / AI-led |
| Voice-Agent | Voice Agent |
| Tiefeninterview(s) | in-depth interview(s) |
| (qualitative) Marktforschung | (qualitative) market research |
| Market Research (Eigenname Produkt) | Market Research (keep) |
| Stimulus / Stimuli | Stimulus / stimuli |
| Synthese | synthesis |
| Befund(e) | finding(s) |
| belegt / belegte / Beleg | evidenced / backed by evidence / evidence |
| Beleg-Disziplin | evidence discipline |
| geraten / nicht geraten | guessed / not guessed |
| Zielgruppe | target audience / audience |
| Screening-Gate | screening gate |
| Quoten | quotas |
| Stichprobe | sample |
| Markt-Linse | Market Lens |
| Cross-Study-Zählung / studienübergreifend | cross-study counting / across studies |
| deterministisch gezählt | deterministically counted |
| „in 3 von 7 Studien" | "in 3 of 7 studies" |
| offener Link | open link |
| eigener Pool / Teilnehmer-Pool | your own pool / participant pool |
| Panel-Anbindung / Panel | panel integration / panel |
| Teilnehmer:innen | participants |
| im O-Ton / in den eigenen Worten | verbatim / in their own words |
| Workaround(s) | workaround(s) |
| Kaufabsicht | purchase intent |
| Preis-Signale | pricing signals |
| Wettbewerb | competition / competitors |
| Buying-Center | buying center |
| Entscheider | decision-makers |
| Anwender | users |
| Einwände | objections |
| Report | report |
| Folien-Deck | slide deck |
| im eigenen Branding | in your own branding |
| teilbare Ergebnis-Links | shareable result links |
| Stakeholder | stakeholders |
| DSGVO-nativ | GDPR-native |
| DSGVO-konform | GDPR-compliant |
| EU-AI-Act-konform | EU AI Act-compliant |
| auf Deutsch (als USP) | in German and English |
| Highlight-Reel(s) | highlight reel(s) |
| Roll-out / Launch / Build | roll-out / launch / build |

## Methoden (MODULES) — Namen + Status bleiben

| Deutsch | English |
|---|---|
| Bedarf & Verhalten | Needs & Behavior |
| Markenwahrnehmung | Brand Perception |
| Konzept-Test | Concept Test |
| Creative-Test | Creative Test |

## Branchen (INDUSTRIES)

| Deutsch | English |
|---|---|
| Mittelstand | Mid-Market |
| B2C & Konsumgüter | B2C & Consumer Goods |
| B2B | B2B |
| Design & Agenturen | Design & Agencies |
| Industrie | Manufacturing |

## Werkzeuge (featureLeaves)

| Deutsch | English |
|---|---|
| Voice-Agent | Voice Agent |
| Stimulus | Stimulus |
| Synthese & Export | Synthesis & Export |
| Qualität & Rekrutierung | Quality & Recruitment |

## UI-Chrome (Navi, Buttons, Labels)

| Deutsch | English |
|---|---|
| Produkt | Product |
| Branchen | Industries |
| Methoden | Methods |
| Werkzeuge | Tools |
| Preise | Pricing |
| Insights | Insights |
| Unternehmen | Company |
| Rechtliches | Legal |
| Für wen Klymeo forscht | Who Klymeo researches for |
| Plattform-Überblick | Platform overview |
| Plattform / Die Plattform | Platform / The platform |
| Mehr erfahren | Learn more |
| Spur 01 | Track 01 |
| Demo buchen | Book a demo |
| Demo buchen → | Book a demo → |
| Plattform ansehen | See the platform |
| Preise ansehen | See pricing |
| Passt zu: | Best for: |
| So funktioniert's | How it works |
| So funktioniert Market Research | How Market Research works |
| Belegt, nicht geraten | Evidenced, not guessed |
| Weitere Methoden | More methods |
| Weitere Branchen | More industries |
| Die Engine dahinter | The engine behind it |
| Die Plattform im Detail | The platform in detail |
| Bereit? | Ready? |
| Lesen → | Read → |
| Log in | Log in (keep) |
| Impressum / Datenschutz / AGB (Footer-Label) | Imprint / Privacy / Terms |
| In Deutschland gebaut | Built in Germany |
| In Frankfurt gehostet | Hosted in Frankfurt |
| Aufgenommen in Frankfurt am Main | Recorded in Frankfurt am Main |
| Hauptnavigation / Mobile-Navigation | Main navigation / Mobile navigation |
| Menü öffnen / Menü schließen | Open menu / Close menu |

## Feste Positionierungs-Zeilen

- **DEFAULT_TITLE:** „Klymeo — AI-powered qualitative market research, GDPR-native, in German & English"
- **Footer-Tagline:** „AI-powered qualitative market research — hundreds of in-depth interviews,
  optionally voice-led, GDPR-native, in German and English, distilled into evidenced insights."
- **CTASection default title:** „Talk to the real voices in your market."
- **CTASection default lead:** „See what Klymeo uncovers in real in-depth interviews with your
  audience — AI-led, in German and English, and GDPR-native."
- **PlatformModules default title:** „Four methods. One engine."
- **PlatformModules eyebrow:** „The platform"

## Regeln für Übersetzungs-Agenten (Leaf-Content)

1. NUR `en:` als Geschwister neben `de:` hinzufügen — `de:` **niemals** anfassen (byte-identisch).
2. JSX-/ReactNode-Struktur **exakt** spiegeln (gleiche Tags, gleiche `<Accent>`/`<em>`/`<br/>`,
   gleiche Anzahl Kinder) — nur Text übersetzen.
3. Glossar oben ist verbindlich. Keine neuen Claims, keine erfundenen Zahlen/Zitate/Kunden.
4. „auf Deutsch"-USP → „in German and English". Eigennamen (Klymeo, Market Research, Stimulus,
   Voice Agent, Market Lens) nicht übersetzen.
5. Idiomatisches, natürliches Englisch (US) — nicht wörtlich. Headlines knackig, Fließtext klar.

## Nachträge aus dem Review (Lücken geschlossen)

| Deutsch | English | Hinweis |
|---|---|---|
| Status-Daten `'Bald'` | rendered **„Soon"** | Daten-Enum bleibt `'Bald'`/`'Live'`; nur das **gerenderte Label** auf /en wird „Soon"/„Live". `StatusTag` bekommt `lang`. |
| Session läuft | Session live | StudioHero recChip |
| Session 001 | Session 001 | numerisch — NICHT übersetzen |
| Voice / Text (mode) | Voice / Text | bleiben |
| Befund / Befunde (UI-Tag) | Finding / Findings | findingsTag |
| Verdikt | Verdict | verdiktTag |
| Annahme / Realität | Assumption / Reality | SessionDeck SYNTHESIS |
| Felder (· 6 Felder) | fields (· 6 fields) | analysisSub |
| Was die KI im Bild sah | What the AI saw in the image | analysisSub |
| Beispielfrage | Example question | MethodStack |
| Mehr zur Methode | Learn about the method | MethodStack moreLink |
| Aufsetzen / Einsammeln / Verstehen / Vergleichen | Set up / Collect / Understand / Compare | MR_STEPS-Phasen |
| Annahme | Assumption | — |
| Lager (Meinungslager) | camps / sides | Synthese |
| Automatische Verdichtung | Automatic distillation | SYNTHESIS_PROOFS |
| Mit den Daten chatten | Chat with your data | — |
| ohne Institutsbudget | without an agency-scale budget | Mittelstand-Tagline |
| von der Fläche | from the shop floor | Industrie |
| DACH-Gesprächssprache | natural spoken language | **„DACH" NIE wörtlich im EN** |
| DACH (Region) | — | im EN-Copy vermeiden/umschreiben |
| Packshots | packshots | bleibt (Branchenbegriff) |
| Eine Engine (Marquee) | One engine | — |
| Session läuft / Aufgenommen | live / recorded | Wortspiel „Aufnahme" → recording |

**Accent-Wort-Regel (fragmentierte Headlines):** DE-Headlines setzen den `st-serif`/kursiven
Akzent auf EIN Schlüsselwort. Im EN denselben **konzeptuell betonten Begriff** in den Akzent
setzen (gleiche Struktur, gleiche Tag-Verschachtelung), damit EN visuell exakt wie DE sitzt.

**SessionDeck HARTE Regel:** `TURNS[]` und `FINDINGS[]` müssen im EN **gleiche Array-Länge**
und gleiche Index-Zuordnung behalten (turnIndexOfFinding/useState hängen daran). Schema-Codes
(`BRAND_PERCEPTION`/`PRICE_SENSITIVITY`/`PURCHASE_INTENT`), `k`/`f`/`cls`/`reveal` = NICHT übersetzen.
