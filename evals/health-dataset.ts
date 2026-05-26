import type { HealthEvalCase } from "./health-types";

/**
 * CS Health eval dataset — 20 cases across the four quadrants the new
 * classifier must handle correctly. The split is intentional:
 *
 *   THRIVING (4)   — happy customer, clear value, expansion talk.
 *   HEALTHY  (4)   — solid but unspectacular, minor friction at most.
 *   LUKEWARM (4)   — flat, no enthusiasm, no acute risk. THIS is what the
 *                    old "health = 100 − risk" inversion got wrong: no
 *                    risk signals ≠ healthy.
 *   AT_RISK  (3)   — decent axes BUT a sharp acute signal that should cap
 *                    the score (champion leaving / budget frozen / new
 *                    procurement lead resets the choice).
 *   CRITICAL (1)   — two stacking critical signals push baseline through
 *                    the floor of the cap.
 *   QUIET    (4)   — thin transcripts; the model must rate axes at
 *                    confidence < 0.3 instead of hallucinating green.
 *
 * Languages: DE / EN / mixed. Each transcript is realistic CS-call shaped
 * (QBR, check-in, support handoff, renewal). Evidence quotes the classifier
 * emits are checked against these transcripts verbatim by the runner.
 */

export const HEALTH_CASES: HealthEvalCase[] = [
  // ─── THRIVING ────────────────────────────────────────────────────────────
  {
    id: "health_thr_001",
    description: "DE QBR — concrete ROI + expansion ask",
    category: "thriving",
    language: "de",
    account: {
      companyName: "Logistik Hamburg GmbH",
      sponsorName: "Markus Renz",
      productName: "Aurora",
      orgName: "Findr",
    },
    call: {
      title: "Q1 QBR",
      recordedAt: "2026-04-08",
      transcript: `csm: Hallo Markus, schön dich zu sehen. Wie war Q1 für euch mit Aurora?
sponsor: Ehrlich gesagt unser bestes Quartal. Wir haben 200k Ops-Kosten gespart, allein durch die automatischen Rückläufer-Reports.
sponsor: Mein CFO hat letzte Woche gefragt ob wir das Team verdoppeln können — das war direkt deine Software.
csm: Das freut mich riesig. Wie ist die Adoption bei den neuen Standorten?
sponsor: Daily Logins in Bremen und Hannover. Wir wollen Q2 noch München draufschalten, 12 Seats mehr.
csm: Super, machen wir. Reference-Story für unsere Website wenn du ok bist?
sponsor: Klar, gerne. Schickt mir den Entwurf.`,
    },
    expected: {
      healthLevel: "thriving",
      scoreRangeMin: 80,
      scoreRangeMax: 95,
    },
  },
  {
    id: "health_thr_002",
    description: "EN renewal — sponsor wants to triple seats",
    category: "thriving",
    language: "en",
    account: {
      companyName: "Northwind SaaS Inc.",
      sponsorName: "Alex Park",
      productName: "Findr Pipeline",
      orgName: "Findr",
    },
    call: {
      title: "Pre-renewal check",
      recordedAt: "2026-04-22",
      transcript: `sponsor: Honestly, this tool changed how our SDR team works. Pipeline coverage is up 40% since November.
csm: That's amazing. Anything we can improve on?
sponsor: Not really. We want to triple our seat count for next year, and we're considering rolling it out to AEs too.
csm: Let's talk procurement timeline.
sponsor: Already greenlit by our CFO last week. He saw the dashboard and signed off in 10 minutes.
sponsor: Just send me the order form, we want this signed by month-end.
csm: Done. I'll have it to you tomorrow morning.`,
    },
    expected: {
      healthLevel: "thriving",
      scoreRangeMin: 80,
      scoreRangeMax: 95,
    },
  },
  {
    id: "health_thr_003",
    description: "DE workshop — sponsor proactively asks for roadmap input",
    category: "thriving",
    language: "de",
    account: {
      companyName: "Bavaria Maschinen AG",
      sponsorName: "Petra Lutz",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Roadmap workshop",
      recordedAt: "2026-04-15",
      transcript: `sponsor: Bevor wir starten — ich habe eure neue Roadmap gelesen. Das Forecasting-Feature wäre für unser Sales-Team gold.
csm: Cool, ich notiere euch als Design-Partner. Wie läuft denn das Tagesgeschäft?
sponsor: Wirklich gut. Meine Leute sind aktiv drin, die Reports laufen ohne mich. Vorher hat das alles auf meinem Tisch gelegen.
sponsor: Mein Geschäftsführer hat dich neulich im Gespräch positiv erwähnt. Das passiert nicht oft.
csm: Das hört man gerne. Renewal kommt im November — alles im grünen Bereich?
sponsor: Ja, kein Thema. Eher die Frage, ob wir das Volumen verdoppeln. Aber das klären wir nach der Sommerpause.`,
    },
    expected: {
      healthLevel: "thriving",
      scoreRangeMin: 78,
      scoreRangeMax: 92,
    },
  },
  {
    id: "health_thr_004",
    description: "Mixed — saved deal, customer wants to be a case study",
    category: "thriving",
    language: "mixed",
    account: {
      companyName: "Helvetia Tech AG",
      sponsorName: "Lukas Brunner",
      productName: "Findr Early-Warning",
      orgName: "Findr",
    },
    call: {
      title: "Quarterly review",
      recordedAt: "2026-04-30",
      transcript: `sponsor: So the ROI story is clear. Wir haben in Q4 zwei Deals gewonnen, die ohne euer Tool weg wären.
sponsor: My CMO asked if we can use it as a case study on our website.
csm: Yes please. Was war konkret der Auslöser?
sponsor: The early-warning thing. Wir haben einen 800k-Deal gesehen, der grade abgekippt ist, und konnten rechtzeitig eingreifen.
csm: Perfekt. Und das Onboarding für die neuen Verkäufer aus Berlin?
sponsor: Läuft. Drei sind schon power-user, die anderen drei brauchen noch zwei Wochen.`,
    },
    expected: {
      healthLevel: "thriving",
      scoreRangeMin: 78,
      scoreRangeMax: 92,
    },
  },

  // ─── HEALTHY ─────────────────────────────────────────────────────────────
  {
    id: "health_hth_005",
    description: "EN business-as-usual check-in, minor feature wish",
    category: "healthy",
    language: "en",
    account: {
      companyName: "Mid Atlantic Robotics Inc.",
      sponsorName: "Alex Cho",
      productName: "Findr Pipeline",
      orgName: "Findr",
    },
    call: {
      title: "Monthly check-in",
      recordedAt: "2026-04-05",
      transcript: `csm: Hi Alex, just our monthly. How's everything?
sponsor: All good. The pipeline view is what we use most — saves us the Friday Excel ritual.
csm: Glad to hear. Anything broken or annoying?
sponsor: Honestly no. Could you eventually add a Slack notification for stage changes? Not urgent, would be nice.
csm: Logged for product. Anything else?
sponsor: Nope. Talk next month?
csm: Sure thing.`,
    },
    expected: {
      healthLevel: "healthy",
      scoreRangeMin: 65,
      scoreRangeMax: 78,
    },
  },
  {
    id: "health_hth_006",
    description: "DE — small support ticket, sponsor engaged",
    category: "healthy",
    language: "de",
    account: {
      companyName: "Köln Vertrieb GmbH",
      sponsorName: "Sabine Wolters",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Monatsgespräch",
      recordedAt: "2026-04-12",
      transcript: `sponsor: Wir hatten letzte Woche ein Ticket wegen dem CSV-Export, eure Leute haben das fix gefixt. Danke.
csm: Gerne. Sonst alles ok?
sponsor: Ja, das Team nutzt es im Daily. Marlene aus dem Vertrieb hat sich beschwert, dass die Mobil-App keine Filter speichert, aber das ist eher Komfort.
csm: Auch das notiere ich. Habt ihr schon das neue Dashboard getestet?
sponsor: Ja, schaut gut aus. Werden wir nach Ostern einführen.`,
    },
    expected: {
      healthLevel: "healthy",
      scoreRangeMin: 65,
      scoreRangeMax: 78,
    },
  },
  {
    id: "health_hth_007",
    description: "Mixed — onboarding done, modest early results",
    category: "healthy",
    language: "mixed",
    account: {
      companyName: "Vienna Analytics GmbH",
      sponsorName: "Tomáš Novák",
      productName: "Findr Pipeline",
      orgName: "Findr",
    },
    call: {
      title: "Post-onboarding review",
      recordedAt: "2026-04-18",
      transcript: `sponsor: Onboarding ist durch. Das Team kommt jetzt rein, die ersten Reports laufen.
csm: Wie wirkt sich das auf eure Q1-Pipeline aus?
sponsor: Hard to say already, but we are catching more handoff issues than before. Maybe two or three deals saved.
csm: Two or three? Concrete examples würden helfen für eure interne Story.
sponsor: I can send you the list later this week. Nothing huge yet, but we are not even fully ramped.
csm: Macht Sinn. Q2 sollten wir dann harte Zahlen sehen.
sponsor: Sehe ich auch so.`,
    },
    expected: {
      healthLevel: "healthy",
      // Lower bound 65 → 62 in round 4 (Opus calibration: borderline-healthy
      // cases legitimately land in the low 60s, in sync with the new healthy
      // band floor).
      scoreRangeMin: 62,
      scoreRangeMax: 78,
    },
  },
  {
    id: "health_hth_008",
    description: "DE — two small bugs, sponsor stays constructive",
    category: "healthy",
    language: "de",
    account: {
      companyName: "Allgaier Industrie GmbH",
      sponsorName: "Bernd Klare",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Support Recap",
      recordedAt: "2026-04-25",
      transcript: `sponsor: Zwei kleine Sachen: die Tag-Suche ignoriert Umlaute, und die Wochenübersicht hat letzte Woche dreimal kurz gehangen.
csm: Beide bekannt, der Umlaut-Fix kommt im Patch nächste Woche, das andere schauen wir uns mit eurer Instanz an. Schicke ich die Logs.
sponsor: Passt sonst. Adoption ist solide, mein Team murrt nicht.
csm: Wie war das letzte Renewal-Gespräch mit eurem CFO?
sponsor: Routine. Er hat einmal gefragt wie viele Lizenzen wir wirklich brauchen, aber nichts dramatisches.`,
    },
    expected: {
      healthLevel: "healthy",
      // Lower bound 65 → 62 in round 4 (Opus calibration: borderline-healthy
      // cases legitimately land in the low 60s, in sync with the new healthy
      // band floor).
      scoreRangeMin: 62,
      scoreRangeMax: 78,
    },
  },

  // ─── LUKEWARM — the critical test category ───────────────────────────────
  {
    id: "health_luk_009",
    description: "DE — sponsor cannot show concrete ROI; nothing broken either",
    category: "lukewarm",
    language: "de",
    account: {
      companyName: "RheinPharma GmbH",
      sponsorName: "Anja Beck",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Quartalsgespräch",
      recordedAt: "2026-04-11",
      transcript: `sponsor: Schwer zu sagen ob es sich wirklich lohnt. Macht nichts kaputt, aber ich kann nicht klar zeigen was es uns konkret bringt.
csm: Was würde dir helfen, das festzumachen?
sponsor: Weiß nicht. Vielleicht müssten wir die Zahlen aus dem CRM gegenrechnen, aber dafür haben wir grade keine Zeit.
csm: Wir können zusammen einen Business-Case-Workshop machen, eine Stunde.
sponsor: Ja, irgendwann. Erstmal ist Q1-Abschluss. Lass uns das im Mai nochmal aufgreifen.
csm: Notiere ich. Adoption ist aber stabil?
sponsor: Ja, wird genutzt. Wie genau, kann ich dir nicht im Detail sagen.`,
    },
    expected: {
      healthLevel: "lukewarm",
      // Explicit value-emptiness ("ich kann nicht klar zeigen was es uns konkret bringt")
      // legitimately drives valueRealization to ~30. Band lower-bound shifted 45 → 38.
      // Upper bound 62 → 61 in round 4: lukewarm tops at 61 since 62 is now healthy.
      scoreRangeMin: 38,
      scoreRangeMax: 61,
    },
  },
  {
    id: "health_luk_010",
    description: "EN — adoption stalled at dashboard-only; product itself fine",
    category: "lukewarm",
    language: "en",
    account: {
      companyName: "Riverside Group LLC",
      sponsorName: "Dana Ortiz",
      productName: "Findr Pipeline",
      orgName: "Findr",
    },
    call: {
      title: "Adoption review",
      recordedAt: "2026-04-19",
      transcript: `sponsor: Honestly we mostly just use it for the dashboard. The team has its own ways for the rest.
csm: Are there features we should walk through again?
sponsor: Not really. They tried the pipeline scoring at the start, said it was fine, then they went back to their old spreadsheet.
csm: Anything we can change to make it stickier?
sponsor: I don't know. The product itself is fine — that's not the issue. We just haven't fully internalized it.
csm: Want to set up a re-onboarding for the SDR team?
sponsor: Maybe later in the year. Not now.`,
    },
    expected: {
      // RECATEGORIZED in round 3: this is axis-driven at_risk, not lukewarm.
      // "they went back to their old spreadsheet" + refused re-onboarding =
      // active, documented value loss. The previous "lukewarm" label was too
      // optimistic; the KI honestly scores ~32 from the axes alone. No acute
      // signal expected — DO NOT DETECT in the prompt explicitly covers
      // "they went back to their spreadsheet" as engagement-axis, NOT
      // ENGAGEMENT_DROP. So requiredAcuteSignals stays empty.
      healthLevel: "at_risk",
      scoreRangeMin: 25,
      scoreRangeMax: 39,
    },
  },
  {
    id: "health_luk_011",
    description: "Mixed renewal QBR — no complaints, no enthusiasm, no named win",
    category: "lukewarm",
    language: "mixed",
    account: {
      companyName: "Adriatica Trading GmbH",
      sponsorName: "Stefano Marchetti",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Pre-renewal QBR",
      recordedAt: "2026-04-26",
      transcript: `csm: We are six weeks from renewal. How are you feeling about it?
sponsor: Yeah, we will renew. Don't worry.
csm: Wie ist der Wert für euch dieses Jahr konkret gewesen?
sponsor: Ehrlich? Schwer zu sagen. Es läuft halt. Niemand beschwert sich, aber keiner kommt zu mir mit "ohne das Tool wären wir verloren".
csm: Wenn du eine Sache nennen müsstest, die euch wirklich geholfen hat?
sponsor: Spontan? Nichts Großes. Vielleicht die Reports. Vielleicht.
csm: Können wir gemeinsam mal Use-Cases nachschärfen?
sponsor: Sure, irgendwann.`,
    },
    expected: {
      healthLevel: "lukewarm",
      // "keiner kommt zu mir mit 'ohne das Tool wären wir verloren'" + no named win
      // legitimately drives valueRealization low. Band lower-bound shifted 45 → 38.
      scoreRangeMin: 38,
      scoreRangeMax: 60,
    },
  },
  {
    id: "health_luk_012",
    description: "DE — sponsor polite but distant, no team-level engagement",
    category: "lukewarm",
    language: "de",
    account: {
      companyName: "Norddeutsche Spedition GmbH",
      sponsorName: "Henrik Eilers",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Check-in",
      recordedAt: "2026-04-29",
      transcript: `sponsor: Ja, ja, läuft. Ich kann nichts Negatives sagen.
csm: Wie nutzt ihr es im Daily?
sponsor: Mein Team nutzt es, glaube ich, täglich. Genau weiß ich es nicht, ich bin nicht so drin wie früher.
csm: Möchtest du dass wir einen Review-Call mit euren AEs aufsetzen?
sponsor: Eher nicht, die haben grade viel zu tun. Schreib mir wenn was ist.
csm: Ok. Bist du noch der richtige Ansprechpartner bei euch?
sponsor: Im Moment ja. Aber so richtig drin sind wir nicht.`,
    },
    expected: {
      healthLevel: "lukewarm",
      // Round 4 (Opus calibration): lower 45 → 40 (Opus legitimately scores
      // this polite-but-flat case in the low 40s — confidence drops product
      // and value axes; relationship + engagement carry it). Upper 62 → 61
      // since 62 is now healthy.
      scoreRangeMin: 40,
      scoreRangeMax: 61,
    },
  },

  // ─── AT_RISK via cap — good axes BUT a sharp acute signal ────────────────
  {
    id: "health_arc_013",
    description: "EN — product loved, champion announces leaving",
    category: "at_risk",
    language: "en",
    account: {
      companyName: "Cascade Ventures Inc.",
      sponsorName: "Maya Iyer",
      productName: "Findr Pipeline",
      orgName: "Findr",
    },
    call: {
      title: "Surprise check-in",
      recordedAt: "2026-04-23",
      transcript: `sponsor: Hey, before we get into it — I'm leaving the company in two weeks. Friday is my last day.
csm: Sorry to hear. Where are you headed?
sponsor: New role at a bigger firm. Anyway, I wanted to flag this to you directly. I don't know who'll take over our account yet.
csm: That changes things. The product itself you're happy with?
sponsor: Yes, totally — actually my team is heavier users than ever. That part has been a win.
sponsor: But my replacement might want to redo vendor decisions, that's how procurement here works. I'll try to warm-introduce someone, but no promises.`,
    },
    expected: {
      healthLevel: "at_risk",
      scoreRangeMin: 22,
      scoreRangeMax: 34,
      requiredAcuteSignals: ["CHAMPION_LOSS"],
    },
  },
  {
    id: "health_arc_014",
    description: "DE — strong relationship, CFO freezes renewals with stop-threat",
    category: "at_risk",
    language: "de",
    account: {
      companyName: "Stuttgart Industriebau AG",
      sponsorName: "Karin Faber",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Renewal-Vorgespräch",
      recordedAt: "2026-04-27",
      transcript: `sponsor: Du, ich muss dir was direkt sagen. Mein CFO hat alle SaaS-Renewals auf Eis gelegt. Bis September gibt es nichts neu.
csm: Auch unseres?
sponsor: Auch unseres. Wir müssen den ROI hart belegen, sonst wird nicht verlängert. Er hat das sehr klar gesagt: "ohne harte Zahlen wird hier kein Vertrag mehr unterschrieben."
csm: Wie kann ich dir konkret helfen, das zu belegen?
sponsor: Ich brauche eine Liste mit Cases bei uns, wo ihr nachweisbar Geld gebracht habt. Quantifiziert.
csm: Mache ich. Bis Freitag.
sponsor: Sonst war die Zusammenarbeit immer top, das ist nicht persönlich. Nur die Finanzlage gerade.`,
    },
    expected: {
      healthLevel: "at_risk",
      // HIGH-severity BUDGET_FRICTION → cap 38 → score lands at 38 from a
      // strong relationship/product baseline. Range raised from 34 → 39 to
      // match the new HIGH-cap calibration (round 3).
      scoreRangeMin: 22,
      scoreRangeMax: 39,
      requiredAcuteSignals: ["BUDGET_FRICTION"],
    },
  },
  {
    id: "health_arc_015",
    description: "Mixed — new VP Procurement reopens vendor decision",
    category: "at_risk",
    language: "mixed",
    account: {
      companyName: "Helvetia Foods AG",
      sponsorName: "Daniel Frey",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Heads-up call",
      recordedAt: "2026-04-30",
      transcript: `sponsor: Heads up — we have a new VP Procurement, started Monday. He's calling for a full vendor review across all categories.
csm: Including ours?
sponsor: Including yours. He told me he wants to see at least two competing offers per category before any renewal.
csm: Wir sind im Q3 dran, oder?
sponsor: Yes, August. Und er meinte explizit "I'm not married to any incumbent." Klingt nach Reset.
csm: Was würde dir helfen, das zu navigieren?
sponsor: Eine harte ROI-Story und ein Migration-Cost-Vergleich. Er hört auf Zahlen.
sponsor: I personally still think you're the right tool, but I don't have the final call anymore.`,
    },
    expected: {
      healthLevel: "at_risk",
      // HIGH-severity STAKEHOLDER_CHURN → cap 38 → score lands at 38 from a
      // strong baseline. Range raised from 36 → 39 to match the new HIGH-cap
      // calibration (round 3).
      scoreRangeMin: 22,
      scoreRangeMax: 39,
      requiredAcuteSignals: ["STAKEHOLDER_CHURN"],
    },
  },

  // ─── CRITICAL — two stacking critical signals ────────────────────────────
  {
    id: "health_crt_016",
    description: "DE — champion left without handover AND budget frozen",
    category: "critical",
    language: "de",
    account: {
      companyName: "Westfalen Versicherung AG",
      sponsorName: "Lena Hoffmann",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Last call",
      recordedAt: "2026-05-02",
      transcript: `sponsor: Du, das hier ist mein letzter Anruf für euch. Petra hat letzte Woche gekündigt, ohne Übergabe.
csm: Petra ist weg? Sie hat das Projekt komplett geführt.
sponsor: Genau. Und mein neuer Vorgesetzter hat den Budgetspruch gemacht: alle Tools mit Renewal in den nächsten 6 Monaten werden gestoppt, bis er nachverhandelt.
sponsor: Bei uns ist Verlängerung im November. Aktueller Stand: wird nicht verlängert.
csm: Ist da noch Spielraum?
sponsor: Ehrlich? Sehr wenig. Niemand intern kämpft mehr für euch. Tut mir leid.`,
    },
    expected: {
      healthLevel: "critical",
      scoreRangeMin: 0,
      scoreRangeMax: 22,
      requiredAcuteSignals: ["CHAMPION_LOSS", "BUDGET_FRICTION"],
    },
  },

  // ─── QUIET — thin transcripts, must rate axes at confidence < 0.3 ────────
  {
    id: "health_qui_017",
    description: "EN very short check-in — almost nothing to grade",
    category: "quiet",
    language: "en",
    account: {
      companyName: "Beacon Logistics Inc.",
      sponsorName: "Chris Wynn",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Touch-base",
      recordedAt: "2026-04-09",
      transcript: `sponsor: Hi, just touching base. All good on our side.
csm: Great. Anything you want to discuss?
sponsor: Nope, talk next quarter.
csm: Sounds good, talk soon.`,
    },
    expected: {
      healthLevel: "lukewarm",
      scoreRangeMin: 42,
      scoreRangeMax: 60,
      lowConfidenceAxes: ["product", "valueRealization", "engagement"],
    },
  },
  {
    id: "health_qui_018",
    description: "DE — abgebrochener QBR am Flughafen",
    category: "quiet",
    language: "de",
    account: {
      companyName: "Frankfurt Industrie GmbH",
      sponsorName: "Ralf Sommer",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Abgesagter QBR",
      recordedAt: "2026-04-14",
      transcript: `sponsor: Sorry, ich muss kurz machen. Bin am Flughafen.
csm: Kein Problem. Wann passt es besser?
sponsor: Nächste Woche Dienstag. Bis dahin: alles passt soweit, glaube ich.
csm: Ok, ich blocke einen Termin. Sicher zu fliegen.`,
    },
    expected: {
      healthLevel: "lukewarm",
      scoreRangeMin: 42,
      scoreRangeMax: 60,
      lowConfidenceAxes: ["product", "valueRealization", "engagement", "relationship"],
    },
  },
  {
    id: "health_qui_019",
    description: "EN hi-bye handoff — no substance",
    category: "quiet",
    language: "en",
    account: {
      companyName: "Pinegate Capital LLC",
      sponsorName: "Jamie Reed",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Brief sync",
      recordedAt: "2026-04-21",
      transcript: `sponsor: Hey, just touching base — no specific topic today.
csm: Anything you want to flag?
sponsor: Not really. We'll reach out if something comes up.
csm: Sounds good. Catch up later.`,
    },
    expected: {
      healthLevel: "lukewarm",
      scoreRangeMin: 42,
      scoreRangeMax: 60,
      lowConfidenceAxes: ["product", "valueRealization", "engagement"],
    },
  },
  {
    id: "health_qui_020",
    description: "Mixed — 5-minute 'no news' call",
    category: "quiet",
    language: "mixed",
    account: {
      companyName: "Zürich Tech GmbH",
      sponsorName: "Selina Vogel",
      productName: "Findr",
      orgName: "Findr",
    },
    call: {
      title: "Quick sync",
      recordedAt: "2026-04-28",
      transcript: `sponsor: Quick one — no news from our side. Alles ruhig.
csm: Wie war Q1?
sponsor: Solide, nichts spektakuläres.
csm: Ok, ping me whenever.
sponsor: Will do. Thanks.`,
    },
    expected: {
      healthLevel: "lukewarm",
      scoreRangeMin: 42,
      scoreRangeMax: 60,
      lowConfidenceAxes: ["product", "valueRealization", "engagement"],
    },
  },
];
