/**
 * Churn-Severity Eval Dataset
 * ---------------------------
 * 12 hand-crafted cases that probe the Health classifier's acuteSignals
 * layer specifically along the SEVERITY axis. The existing Health eval
 * (evals/health-runner.eval.ts) already covers signal-TYPE presence /
 * absence and axis scoring; it does NOT check severity calibration —
 * "BUDGET_FRICTION emitted as low instead of high" is the blind spot
 * this file targets.
 *
 * Coverage shape:
 *   2 critical, 3 high, 3 medium, 2 low, 2 axis-only (expected EMPTY).
 *
 * Type coverage: all 9 RISK_SIGNAL_TYPES appear at least once; the
 * common five (CHAMPION_LOSS, BUDGET_FRICTION, COMPETITOR_PRESSURE,
 * STAKEHOLDER_CHURN, STALLING_PATTERN) appear at least twice where the
 * 12-case budget allows.
 *
 * Multi-signal stress: cs_crit_01 and cs_high_03 each carry TWO distinct
 * named events — they exercise both the per-signal severity call AND the
 * prompt's ONE-EVENT-ONE-SIGNAL rule (the model must not pile a single
 * event into two types).
 *
 * Language: DE ×10, EN ×2.
 *
 * Each transcript is written so the expected severity is the defensible
 * read of the named event(s). A competent CSM rater should agree with
 * the labels; close-but-wrong calls (e.g. high instead of critical) are
 * what the eval's severity-distance metric is designed to surface.
 */

import { RISK_SIGNAL_TYPES } from "@/lib/schemas/risk";
import { ACUTE_SIGNAL_SEVERITIES } from "@/lib/schemas/health";

type RiskSignalType = (typeof RISK_SIGNAL_TYPES)[number];
type AcuteSignalSeverity = (typeof ACUTE_SIGNAL_SEVERITIES)[number];

export interface ExpectedSignal {
  type: RiskSignalType;
  severity: AcuteSignalSeverity;
}

export interface ChurnSeverityEvalCase {
  id: string;
  description: string;
  language: "de" | "en" | "mixed";
  account: {
    companyName: string;
    sponsorName: string | null;
    productName: string | null;
    orgName: string | null;
  };
  call: {
    /** ISO timestamp the conversation was recorded — helps the classifier
     *  anchor "last week"-style references. */
    recordedAt: string;
    transcript: string;
  };
  expected: {
    /** Signals the case is designed to elicit, with the severity a
     *  competent rater would assign. Order does NOT matter — the runner
     *  matches by `type`. Pairs are 1:1 by type (no case has two signals
     *  of the same type). */
    signals: ExpectedSignal[];
    /** When true, the case is an axis-only pattern that must yield ZERO
     *  acute signals — no concrete events in the transcript. The runner
     *  has a dedicated no-signal-on-empty check for this. */
    expectsEmpty?: boolean;
  };
  /** Why this case exists. Read by humans, not the runner. */
  rationale: string;
}

export const CHURN_SEVERITY_EVAL_CASES: ChurnSeverityEvalCase[] = [
  // ── critical ──────────────────────────────────────────────────────────────
  {
    id: "cs_crit_01",
    description:
      "Champion confirmed gone + competitor signed — two independent critical events",
    language: "de",
    account: {
      companyName: "Müller Logistik GmbH",
      sponsorName: "Frau Wagner",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-12T09:00:00Z",
      transcript: [
        "CSM: Hi Frau Wagner, schön Sie zu sehen. Wie war das Quartal bei Ihnen?",
        "Sponsor: Hallo. Ehrlich gesagt eine etwas schwierige Nachricht: Herr Brandt, der das Projekt bei uns von Anfang an vorangetrieben hat, ist letzten Freitag ausgeschieden. Komplett raus aus der Firma, er hat ein anderes Angebot angenommen.",
        "CSM: Oh, das tut mir leid zu hören. Wie geht es jetzt mit dem Tool bei Ihnen weiter?",
        "Sponsor: Und das ist der zweite Punkt: Wir haben uns parallel das System von Salesforce angesehen, und unser Vorstand hat letzte Woche den Vertrag mit denen unterzeichnet. Wir sind also nicht mehr im Evaluierungsmodus, die Entscheidung ist gefallen.",
        "CSM: Verstehe. Bedeutet das für unser Renewal im Februar...",
        "Sponsor: Wir werden nicht verlängern. Das ist final, der CFO hat schon den entsprechenden Beschluss getroffen.",
      ].join("\n"),
    },
    expected: {
      signals: [
        { type: "CHAMPION_LOSS", severity: "critical" },
        { type: "COMPETITOR_PRESSURE", severity: "critical" },
      ],
    },
    rationale:
      "Multi-signal stress at the top of the severity scale. Two clearly independent events: champion confirmed gone (CHAMPION_LOSS critical — the prototypical account-killer), AND competitor contract signed (COMPETITOR_PRESSURE critical — not 'evaluating', signed). Tests that the model emits BOTH (not one piled into the other under one-event-one-signal) AND rates both at critical.",
  },
  {
    id: "cs_crit_02",
    description: "Budget hard-frozen by CFO with sub-200% ROI hurdle as gate",
    language: "de",
    account: {
      companyName: "Schmidt Industries AG",
      sponsorName: "Frau Becker",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-14T11:00:00Z",
      transcript: [
        "CSM: Frau Becker, lassen Sie uns über die Verlängerung sprechen. Wir nähern uns dem Renewal-Datum im März.",
        "Sponsor: Da muss ich offen mit Ihnen sein: Unser CFO hat alle weiteren Software-Ausgaben für 2026 komplett eingefroren. Das gilt auch für laufende Verträge — keine Verlängerung ohne harten Business-Case.",
        "CSM: Was würde das Budget wieder öffnen?",
        "Sponsor: Wir bräuchten einen messbaren ROI-Nachweis von mindestens 200 Prozent innerhalb von sechs Monaten. Belegbar, mit Zahlen aus unseren eigenen Systemen, vom CFO persönlich akzeptiert. Ohne diesen Nachweis wird unter Garantie nicht verlängert.",
        "CSM: Das ist eine hohe Hürde.",
        "Sponsor: Ja, aber der CFO hat es so beschlossen. Und er hat ergänzt: Wenn wir den Nachweis bis Ende Januar nicht haben, ist das Thema durch.",
      ].join("\n"),
    },
    expected: {
      signals: [{ type: "BUDGET_FRICTION", severity: "critical" }],
    },
    rationale:
      "Single-event critical. Budget owner explicitly froze the spend WITH a hard ROI gate AND a deadline. Prompt's critical band: 'budget explicitly stopped with no path back' — the path back here (200% ROI proof by January) is so steep it effectively reads as 'no path back'. Wrong calibration here would be 'high' (which would imply the threat is still abatable).",
  },

  // ── high ──────────────────────────────────────────────────────────────────
  {
    id: "cs_high_01",
    description:
      "Champion disengagement — 2 meeting cancels + delegation to named replacement",
    language: "de",
    account: {
      companyName: "Bauer Software GmbH",
      sponsorName: "Frau Lehmann",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-15T10:30:00Z",
      transcript: [
        "CSM: Frau Lehmann, ich versuche seit drei Wochen einen Termin mit Ihnen aufzusetzen — wie geht es Ihnen?",
        "Sponsor: Tut mir leid, die letzten zwei Termine musste ich kurzfristig absagen. Stress ohne Ende gerade.",
        "CSM: Wo stehen wir denn mit dem Rollout in der Marketing-Abteilung?",
        "Sponsor: Ehrlich gesagt habe ich das jetzt komplett an Herrn Klein übergeben. Bitte stimmen Sie sich ab sofort direkt mit ihm ab — er ist mein neuer Ansprechpartner für alles, was das Tool betrifft.",
        "CSM: Sind Sie selbst noch involviert?",
        "Sponsor: Sagen wir so: ich bin noch der nominelle Owner, aber operativ schaue ich nicht mehr rein. Sprechen Sie mit Herrn Klein, der hat den Hut auf.",
      ].join("\n"),
    },
    expected: {
      signals: [{ type: "CHAMPION_DISENGAGEMENT", severity: "high" }],
    },
    rationale:
      "Canonical CHAMPION_DISENGAGEMENT at 'high': 2 cancellations + delegation to a named replacement + champion explicit that they're operationally out. Not 'critical' because the champion is still nominally there (no full exit, no successor that resets decisions). Wrong calibration would be 'medium' (under-rating) or 'critical' (over-rating).",
  },
  {
    id: "cs_high_02",
    description:
      "New VP Procurement joined, signals contract re-evaluation but not executed",
    language: "de",
    account: {
      companyName: "Hoffmann Vermögensverwaltung GmbH",
      sponsorName: "Herr Schubert",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-18T14:00:00Z",
      transcript: [
        "Sponsor: Wir haben seit letzten Monat einen neuen VP Procurement, Herrn Dr. Volkmann. Er kommt von einer großen Bank, sehr durchsetzungsstark.",
        "CSM: Hat das Konsequenzen für unsere laufenden Themen?",
        "Sponsor: Möglicherweise. Er hat in der ersten Vorstandsrunde angekündigt, dass er alle Software-Verträge oberhalb von 50.000 Euro Jahresvolumen neu bewerten möchte. Unseres fällt da rein.",
        "CSM: Was bedeutet 'neu bewerten' konkret?",
        "Sponsor: Er möchte eine vergleichende Analyse mit zwei Alternativ-Anbietern und einen Business-Case neu sehen, bevor irgendetwas verlängert wird. Vor dem Renewal im April wird das definitiv durchexerziert.",
        "CSM: Verstehe. Können wir uns vorab mit ihm vernetzen?",
        "Sponsor: Ich sehe was ich machen kann, aber er ist gerade in 80 Themen parallel.",
      ].join("\n"),
    },
    expected: {
      signals: [{ type: "STAKEHOLDER_CHURN", severity: "high" }],
    },
    rationale:
      "STAKEHOLDER_CHURN at 'high' — prompt's example: 'new VP Procurement who MAY redo the decision'. Real, named event (VP joined and stated intent), imminent (before April renewal), but unconfirmed in outcome (re-eval declared, not yet executed). NOT critical (no signed competitor, no stop), NOT medium (the VP DOES have veto power, the threat is real).",
  },
  {
    id: "cs_high_03",
    description:
      "Late CFO surfaces with conditional veto + stop-threat (multi-signal, EN)",
    language: "en",
    account: {
      companyName: "Reilly Analytics Inc.",
      sponsorName: "Sarah Klein",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-20T15:00:00Z",
      transcript: [
        "Buyer: Honestly, I need to flag something. Our CFO, Mark Reilly, has stepped into the renewal conversation. He was not involved until last week.",
        "CSM: How is he positioning?",
        "Buyer: He has veto power on anything over a quarter million and ours is. He says he wants to see a hard ROI case before signing — and he is hinting that without a clear payback story, he will block the spend.",
        "CSM: Is this position likely to soften?",
        "Buyer: Possibly. If we can show him concrete numbers from your reporting module — the cost savings we have actually realized — he is open to be convinced. But if the case is fuzzy, he will pull the plug. He has done it before with two vendors this year.",
        "CSM: Understood. What is your read on his timing?",
        "Buyer: He wants a decision by end of next month. Either it passes his bar, or the renewal does not happen.",
      ].join("\n"),
    },
    expected: {
      signals: [
        { type: "LATE_DECISION_MAKER", severity: "high" },
        { type: "BUDGET_FRICTION", severity: "high" },
      ],
    },
    rationale:
      "Multi-signal stress at 'high'. Two genuinely distinct events from the prompt's calibration: existing CFO who was uninvolved surfaces with veto power (LATE_DECISION_MAKER high — prompt's 'new senior … who MAY redo the decision'), AND a stop-threat that is conditional on the ROI case (BUDGET_FRICTION high — 'stop-threat that may yet be averted'). Critical would be wrong because both are abatable; medium would be wrong because the CFO HAS done it before to other vendors.",
  },

  // ── medium ────────────────────────────────────────────────────────────────
  {
    id: "cs_med_01",
    description:
      "Single stakeholder change without re-decision — successor is on the ball",
    language: "de",
    account: {
      companyName: "Vogel Consulting GmbH",
      sponsorName: "Frau Berg",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-21T09:30:00Z",
      transcript: [
        "CSM: Ich höre, in Ihrer Abteilung gab es einen Wechsel?",
        "Sponsor: Ja, Frau Hoffmann ist Anfang des Monats ins Marketing gewechselt. Frau Berg hat ihren Posten übernommen.",
        "CSM: Bedeutet das, dass wir das Projekt neu einarbeiten müssen?",
        "Sponsor: Nein, gar nicht. Frau Berg ist auf dem aktuellen Stand, sie war im letzten Quartal in allen Steering-Calls dabei und kennt die Roadmap. Es ändert sich operativ wenig.",
        "CSM: Und für das Renewal im Sommer?",
        "Sponsor: Da gibt's nichts neu zu klären, die Strategie steht. Ich bin in Vertretung weiter Sponsor.",
      ].join("\n"),
    },
    expected: {
      signals: [{ type: "STAKEHOLDER_CHURN", severity: "medium" }],
    },
    rationale:
      "STAKEHOLDER_CHURN at 'medium' — prompt example: 'one stakeholder change without a reset'. A change happened (named event), but the successor is up to speed and the strategy stands. NOT high (no power-shift, no re-evaluation announced), NOT low (it IS a real, named change worth surfacing).",
  },
  {
    id: "cs_med_02",
    description:
      "ENGAGEMENT_DROP — single canceled QBR with stated, time-bound cause",
    language: "de",
    account: {
      companyName: "Krause Recycling GmbH",
      sponsorName: "Herr Eckert",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-22T08:00:00Z",
      transcript: [
        "CSM: Wir hatten den Quarterly Business Review heute eigentlich für 90 Minuten geplant — ich sehe ihn nicht mehr im Kalender?",
        "Sponsor: Ah ja, ich musste den absagen. Wir haben gerade Endkunden-Audit, das hat absolute Priorität diese Woche.",
        "CSM: Verstehe. Können wir den auf Anfang nächster Woche schieben?",
        "Sponsor: Lieber zwei Wochen aufschieben — bis der Audit durch ist, kann ich da realistisch nicht den Kopf für freibekommen.",
        "CSM: Okay, ich blocke uns einen neuen Slot Mitte Februar.",
        "Sponsor: Danke. Sorry für die Unruhe, das ist ein einmaliges Thema.",
      ].join("\n"),
    },
    expected: {
      signals: [{ type: "ENGAGEMENT_DROP", severity: "medium" }],
    },
    rationale:
      "ENGAGEMENT_DROP at 'medium' — prompt example: 'one missed QBR with a stated reason'. One concrete cancel with a time-bound, plausible cause (audit week). Sponsor explicit that it's one-off. NOT high (single occurrence, named cause, sponsor responsive), NOT low (it IS a missed QBR, not a flat 'no news' case).",
  },
  {
    id: "cs_med_03",
    description: "Multi-threading failure — single point of access, explicit",
    language: "de",
    account: {
      companyName: "Werner Maschinenbau AG",
      sponsorName: "Herr Wagner",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-25T13:00:00Z",
      transcript: [
        "CSM: Lassen Sie uns über die Erweiterung in die Vertriebs-Abteilung sprechen. Wer wäre da unser Ansprechpartner?",
        "Sponsor: Das müsste über mich laufen. Der Vertriebsleiter Herr Schubert ist gerade nicht zugänglich für externe Gespräche — er hat eine ziemlich harte 'Filter durch mich'-Regel.",
        "CSM: Auch nicht für ein 15-minütiges Kennenlernen?",
        "Sponsor: Nein, das macht er strikt nicht. Sie müssen das über mich spielen. Ich kann Themen weitertragen, aber direkte Calls oder Mails laufen alle über mich.",
        "CSM: Und auf IT-Seite, falls wir technische Fragen hätten?",
        "Sponsor: Genauso. Bei uns ist alles über mich. Ich weiß, das ist nicht ideal — aber so läuft das gerade.",
      ].join("\n"),
    },
    expected: {
      signals: [{ type: "MULTI_THREADING_FAILURE", severity: "medium" }],
    },
    rationale:
      "MULTI_THREADING_FAILURE at 'medium'. Single named pattern (single point of access, named blocker), sponsor explicit but cooperative. NOT high (no escalation, sponsor reliable as the conduit), NOT low (it IS a structural relationship risk worth flagging). This is the canonical 'one structural issue, no immediate threat' calibration.",
  },

  // ── low ───────────────────────────────────────────────────────────────────
  {
    id: "cs_low_01",
    description: "STALLING_PATTERN — single mild push with explained cause",
    language: "de",
    account: {
      companyName: "Schreiber Mode GmbH",
      sponsorName: "Frau Klein",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-26T11:00:00Z",
      transcript: [
        "CSM: Wir hatten ja vereinbart, dass Sie diese Woche das Onboarding-Material reviewen?",
        "Sponsor: Ach Mist, das hab ich noch nicht geschafft. Lass uns das auf nächste Woche schieben — ich nehm's mir Dienstag vor.",
        "CSM: Klar, passt. Sonst alles okay bei Ihnen?",
        "Sponsor: Ja, läuft. Ich brauchte nur ein paar Tage mehr für ein anderes Thema, deshalb die Verschiebung.",
        "CSM: Verstanden, dann schicke ich Ihnen den Reminder Montag.",
        "Sponsor: Perfekt, das passt.",
      ].join("\n"),
    },
    expected: {
      signals: [{ type: "STALLING_PATTERN", severity: "low" }],
    },
    rationale:
      "STALLING_PATTERN at 'low' — single push, explained, sponsor still constructive. Borderline whether to emit at all — the prompt's STALLING_PATTERN rule wants 'REPEATED, explicit postponement', which this is NOT strictly. Wrong calibration could go either way (correctly drop it, or correctly call it low). The case probes whether the model correctly downscales a soft single occurrence rather than escalating.",
  },
  {
    id: "cs_low_02",
    description: "Passing competitor mention — no active eval, no preference",
    language: "en",
    account: {
      companyName: "Northwind Software Inc.",
      sponsorName: "Mike Brown",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-27T16:00:00Z",
      transcript: [
        "CSM: How is the renewal looking from your side?",
        "Buyer: We are good. The team uses the tool every day, the value is clear.",
        "CSM: Any other vendors you have been looking at?",
        "Buyer: Honestly, we do compare here and there with what is out in the market — I had a quick demo from a tool called Gainsight last summer just to see what they had. But we are not in any active evaluation.",
        "CSM: Anything from that demo that stood out?",
        "Buyer: Nothing actionable. We are sticking with you. The renewal is straightforward.",
      ].join("\n"),
    },
    expected: {
      signals: [{ type: "COMPETITOR_PRESSURE", severity: "low" }],
    },
    rationale:
      "COMPETITOR_PRESSURE at 'low'. The prompt's DETECT for this type wants 'competitor pilot has STARTED, or customer stated preference / signed competing offer' — this case is on the BOUNDARY of detect-or-skip. A demo last summer + 'not in any active eval' + 'sticking with you' could legitimately yield zero signals. If the model DOES emit it, low is the correct calibration; medium would mis-rate the threat. Tests downscale discipline.",
  },

  // ── axis-only (expected empty) ────────────────────────────────────────────
  {
    id: "cs_empty_01",
    description:
      "Value uncertainty — axis-only pattern, no concrete event to anchor a signal",
    language: "de",
    account: {
      companyName: "Albrecht Logistik GmbH",
      sponsorName: "Herr Roth",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-28T09:00:00Z",
      transcript: [
        "CSM: Wo stehen Sie aktuell mit dem Tool — was ist Ihr Eindruck nach den letzten sechs Monaten?",
        "Sponsor: Ehrlich gesagt: wir wissen es nicht so genau. Wir nutzen es, das Team nutzt es, aber ob wir wirklich einen messbaren Mehrwert sehen — das kann ich Ihnen nicht klar beantworten.",
        "CSM: Haben Sie konkrete Use-Cases, wo Sie sagen würden, das hat funktioniert?",
        "Sponsor: Wir haben einen oder zwei, aber nichts, was ich als 'klarer ROI' verkaufen könnte intern. Mein CFO fragt mich ab und zu nach dem Business-Case, und ich kann ihm keine harten Zahlen vorlegen.",
        "CSM: Wäre eine ROI-Session sinnvoll?",
        "Sponsor: Vielleicht. Aber konkret nichts dramatisch — wir sind weder begeistert noch unzufrieden. Es läuft halt.",
      ].join("\n"),
    },
    expected: {
      signals: [],
      expectsEmpty: true,
    },
    rationale:
      "Prompt's DO-NOT-DETECT example almost verbatim: '\"Wir wissen nicht ob es sich lohnt\" → LOW valueRealization, NOT a signal'. No concrete event, no named stop-threat, no champion change. Tests that the model resists the temptation to escalate value-uncertainty axis content into BUDGET_FRICTION (which would require a stop-event from the budget owner).",
  },
  {
    id: "cs_empty_02",
    description: "Lukewarm tone, no events — pure axis-flat case",
    language: "de",
    account: {
      companyName: "Steiner & Partner GmbH",
      sponsorName: "Frau Otto",
      productName: "Findr",
      orgName: "Findr GmbH",
    },
    call: {
      recordedAt: "2026-05-29T10:00:00Z",
      transcript: [
        "CSM: Wie war Ihr Quartal — alles im Lot?",
        "Sponsor: Ja ja, alles in Ordnung. Läuft halt.",
        "CSM: Gibt's irgendetwas, das wir besprechen sollten?",
        "Sponsor: Ne, eigentlich nichts. Das Team nutzt es, die Verlängerung im Mai ist soweit auf Kurs.",
        "CSM: Roadmap-Themen?",
        "Sponsor: Ach, lass mal. Ich melde mich, wenn was kommt.",
        "CSM: Okay. Dann sprechen wir in drei Monaten wieder?",
        "Sponsor: Können wir machen.",
      ].join("\n"),
    },
    expected: {
      signals: [],
      expectsEmpty: true,
    },
    rationale:
      "Prompt's DO-NOT-DETECT example: 'Polite-but-flat tone, \"ja, ja, läuft\", sponsor reflectively distant → lower relationship and engagement axis scores, NOT a signal.' No concrete event, no missed-but-named meeting, no stakeholder change. The model must resist promoting tone into ENGAGEMENT_DROP or CHAMPION_DISENGAGEMENT.",
  },
];

/**
 * Distribution audit (must hold; useful when adding cases):
 *
 *   Severity:    2 critical · 3 high · 3 medium · 2 low · 2 empty                (= 12)
 *   Language:    DE ×10 · EN ×2
 *   Multi-sig:   cs_crit_01 (CHAMPION_LOSS + COMPETITOR_PRESSURE)
 *                cs_high_03 (LATE_DECISION_MAKER + BUDGET_FRICTION)
 *
 *   Type coverage (× count):
 *     CHAMPION_LOSS              ×1  (cs_crit_01)
 *     COMPETITOR_PRESSURE        ×2  (cs_crit_01, cs_low_02)
 *     STALLING_PATTERN           ×1  (cs_low_01)
 *     BUDGET_FRICTION            ×2  (cs_crit_02, cs_high_03)
 *     CHAMPION_DISENGAGEMENT     ×1  (cs_high_01)
 *     LATE_DECISION_MAKER        ×1  (cs_high_03)
 *     STAKEHOLDER_CHURN          ×2  (cs_high_02, cs_med_01)
 *     ENGAGEMENT_DROP            ×1  (cs_med_02)
 *     MULTI_THREADING_FAILURE    ×1  (cs_med_03)
 *
 *   All 9 types present; CHAMPION_LOSS and STALLING_PATTERN at 1× are the
 *   tradeoff against the 12-case budget. Add round-two cases here when the
 *   first-run severity-exact rate is known and the gaps are targeted.
 */
