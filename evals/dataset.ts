import type { EvalCase } from "./types";

const ALL_SIGNALS = [
  "CHAMPION_LOSS",
  "COMPETITOR_PRESSURE",
  "STALLING_PATTERN",
  "BUDGET_FRICTION",
  "CHAMPION_DISENGAGEMENT",
  "LATE_DECISION_MAKER",
  "STAKEHOLDER_CHURN",
  "ENGAGEMENT_DROP",
];

export const EVAL_CASES: EvalCase[] = [
  {
    id: "eval_001",
    description: "Champion leaves, Salesforce undercuts pricing, CFO freezes budget",
    category: "critical",
    deal: {
      id: "eval_001",
      name: "Nordbank Enterprise Rollout",
      company: "Nordbank GmbH",
      stage: "negotiation",
      amount: 185000,
      ownerName: "Sarah Mueller",
      lastActivity: "2026-05-05",
    },
    calls: [
      {
        id: "eval_001_call_1",
        title: "Champion update",
        duration_seconds: 1920,
        recorded_at: "2026-05-03",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ich muss euch fairerweise sagen: Ich verlasse Nordbank Ende des Monats. Mein Nachfolger ist noch nicht klar, also bin ich nicht mehr wirklich im Loop.",
          },
          {
            speaker_role: "buyer",
            content:
              "Parallel evaluieren wir Salesforce. Die sagen, sie koennen das fuer etwa 30 Prozent guenstiger bundlen.",
          },
        ],
      },
      {
        id: "eval_001_call_2",
        title: "Procurement escalation",
        duration_seconds: 1440,
        recorded_at: "2026-05-10",
        transcript_segments: [
          {
            speaker_role: "decision_maker",
            content:
              "Der CFO hat gerade einen Spend-Freeze fuer dieses Quartal ausgerufen. Alles ueber 50k muss nochmal durch den Vorstand.",
          },
          {
            speaker_role: "ae",
            content:
              "Verstanden. Wer uebernimmt intern die Findr-Story, wenn Marcus raus ist?",
          },
          {
            speaker_role: "buyer",
            content:
              "Ehrlich gesagt, aktuell niemand so richtig. Wir muessen das neu sortieren.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 82,
      scoreRangeMax: 98,
      requiredSignals: [
        "CHAMPION_LOSS",
        "COMPETITOR_PRESSURE",
        "BUDGET_FRICTION",
      ],
    },
  },
  {
    id: "eval_002",
    description: "Procurement stalls after new COO joins and champion disengages",
    category: "critical",
    deal: {
      id: "eval_002",
      name: "Bayrische Versicherung Analytics",
      company: "Bayrische Versicherung AG",
      stage: "proposal_sent",
      amount: 132000,
      ownerName: "Thomas Becker",
      lastActivity: "2026-04-29",
    },
    calls: [
      {
        id: "eval_002_call_1",
        title: "Proposal review",
        duration_seconds: 1710,
        recorded_at: "2026-04-22",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ja, das Angebot ist angekommen. Ich bin diese Woche leider komplett zu, koennen wir das vielleicht naechsten Monat wieder aufnehmen?",
          },
          {
            speaker_role: "buyer",
            content:
              "Seit der neue COO da ist, will niemand mehr was unterschreiben ohne sein Okay. Den hatten wir bisher nicht im Prozess.",
          },
        ],
      },
      {
        id: "eval_002_call_2",
        title: "Delayed next steps",
        duration_seconds: 1280,
        recorded_at: "2026-05-06",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ich weiss, ich schulde dir Feedback. Es ist intern gerade versandet, und ich bekomme den COO nicht auf einen Termin.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Ohne Betriebsrat und Datenschutz sehe ich hier keine Freigabe. Das ist fuer uns ein blocker.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 80,
      scoreRangeMax: 94,
      requiredSignals: [
        "STALLING_PATTERN",
        "LATE_DECISION_MAKER",
        "CHAMPION_DISENGAGEMENT",
      ],
    },
  },
  {
    id: "eval_003",
    description: "Competitor preferred, budget cut, stakeholder churn after reorg",
    category: "critical",
    deal: {
      id: "eval_003",
      name: "Helven Industries Revenue Intelligence",
      company: "Helven Industries GmbH",
      stage: "negotiation",
      amount: 94000,
      ownerName: "Klaus Brandt",
      lastActivity: "2026-05-01",
    },
    calls: [
      {
        id: "eval_003_call_1",
        title: "Reorg check-in",
        duration_seconds: 1600,
        recorded_at: "2026-04-25",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Unser Sales Ops Team wurde umgebaut. Julia, die das mit euch getrieben hat, ist jetzt in einem anderen Bereich.",
          },
          {
            speaker_role: "champion",
            content:
              "Ich bin nur noch teilweise involviert. Gong ist ehrlich gesagt gerade der Favorit, weil die schon beim CRO bekannt sind.",
          },
        ],
      },
      {
        id: "eval_003_call_2",
        title: "Budget review",
        duration_seconds: 1260,
        recorded_at: "2026-05-02",
        transcript_segments: [
          {
            speaker_role: "decision_maker",
            content:
              "Wir muessen den geplanten Tool-Spend um 40 Prozent reduzieren. Wenn Gong im Paket guenstiger ist, wird das schwer fuer Findr.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 83,
      scoreRangeMax: 97,
      requiredSignals: [
        "STAKEHOLDER_CHURN",
        "COMPETITOR_PRESSURE",
        "BUDGET_FRICTION",
      ],
    },
  },
  {
    id: "eval_004",
    description: "Champion gone silent, repeated meeting pushes, Microsoft alternative",
    category: "critical",
    deal: {
      id: "eval_004",
      name: "DACH Logistics Expansion",
      company: "DACH Logistics AG",
      stage: "proposal_sent",
      amount: 210000,
      ownerName: "Hans Mueller",
      lastActivity: "2026-04-26",
    },
    calls: [
      {
        id: "eval_004_call_1",
        title: "Late-stage check-in",
        duration_seconds: 1500,
        recorded_at: "2026-04-18",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Sorry, ich war die letzten zwei Wochen raus. Koennen wir den Steering-Termin nochmal schieben? Ich habe intern noch nichts geteilt.",
          },
          {
            speaker_role: "buyer",
            content:
              "IT fragt, ob wir nicht einfach Microsoft Dynamics erweitern. Das waere politisch einfacher.",
          },
        ],
      },
      {
        id: "eval_004_call_2",
        title: "Decision delay",
        duration_seconds: 1020,
        recorded_at: "2026-05-05",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Lass mich das nochmal mit dem Team durchgehen. Ich melde mich, sobald ich was hoere, aber vor Juni wird es eher nichts.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 80,
      scoreRangeMax: 92,
      requiredSignals: [
        "CHAMPION_DISENGAGEMENT",
        "STALLING_PATTERN",
        "COMPETITOR_PRESSURE",
      ],
    },
  },
  {
    id: "eval_005",
    description: "CEO enters late, budget owner questions ROI, champion loses mandate",
    category: "critical",
    deal: {
      id: "eval_005",
      name: "SaaSCo Growth Platform",
      company: "SaaSCo Holdings",
      stage: "negotiation",
      amount: 250000,
      ownerName: "Marcus Thompson",
      lastActivity: "2026-05-04",
    },
    calls: [
      {
        id: "eval_005_call_1",
        title: "Executive surprise",
        duration_seconds: 1890,
        recorded_at: "2026-04-30",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ich dachte, ich kann das final treiben, aber der CEO moechte jetzt persoenlich verstehen, warum wir nicht beim bestehenden BI-Stack bleiben.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Der Business Case ist fuer mich nicht belastbar. Bei 250k will ich harte ROI-Zahlen, sonst stoppe ich das.",
          },
        ],
      },
      {
        id: "eval_005_call_2",
        title: "Champion concern",
        duration_seconds: 900,
        recorded_at: "2026-05-07",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ich bekomme intern gerade wenig Rueckendeckung. Vielleicht sollten wir erstmal eine kleinere Pilot-Idee pruefen.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 81,
      scoreRangeMax: 95,
      requiredSignals: [
        "LATE_DECISION_MAKER",
        "BUDGET_FRICTION",
        "CHAMPION_DISENGAGEMENT",
      ],
    },
  },
  {
    id: "eval_006",
    description: "Buyer team churn and procurement freeze after legal objections",
    category: "critical",
    deal: {
      id: "eval_006",
      name: "RheinWerk AI Coaching",
      company: "RheinWerk Maschinenbau",
      stage: "proposal_sent",
      amount: 76000,
      ownerName: "Petra Hoffmann",
      lastActivity: "2026-04-28",
    },
    calls: [
      {
        id: "eval_006_call_1",
        title: "Legal review",
        duration_seconds: 1320,
        recorded_at: "2026-04-21",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Unsere Datenschutzbeauftragte ist neu und will alle Conversation-Intelligence-Tools nochmal komplett pruefen.",
          },
          {
            speaker_role: "champion",
            content:
              "Der bisherige Sales Director ist raus, und der Interim-Leiter kennt das Projekt nicht.",
          },
        ],
      },
      {
        id: "eval_006_call_2",
        title: "Procurement freeze",
        duration_seconds: 1100,
        recorded_at: "2026-05-03",
        transcript_segments: [
          {
            speaker_role: "decision_maker",
            content:
              "Bis die neue Leitung steht, unterschreiben wir nichts. Budget ist eingefroren, sorry.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 80,
      scoreRangeMax: 93,
      requiredSignals: ["STAKEHOLDER_CHURN", "BUDGET_FRICTION", "STALLING_PATTERN"],
    },
  },
  {
    id: "eval_007",
    description: "Strong competitor pressure plus champion departure and engagement collapse",
    category: "critical",
    deal: {
      id: "eval_007",
      name: "AlpenBank Revenue Desk",
      company: "AlpenBank AG",
      stage: "negotiation",
      amount: 168000,
      ownerName: "Sarah Mueller",
      lastActivity: "2026-04-24",
    },
    calls: [
      {
        id: "eval_007_call_1",
        title: "Competitive review",
        duration_seconds: 1410,
        recorded_at: "2026-04-16",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Wir sind jetzt im finalen Vergleich mit Clari und Salesforce. Clari hat beim Forecasting mehr Vertrauen beim CRO.",
          },
          {
            speaker_role: "champion",
            content:
              "Ich kann euch nicht mehr so pushen wie geplant. Ich wechsle ab 1. Juni in eine Group-Rolle.",
          },
        ],
      },
      {
        id: "eval_007_call_2",
        title: "Silence after follow-up",
        duration_seconds: 780,
        recorded_at: "2026-05-01",
        transcript_segments: [
          {
            speaker_role: "ae",
            content:
              "Wir hatten drei Follow-ups geschickt und keine Rueckmeldung bekommen. Hat sich etwas geaendert?",
          },
          {
            speaker_role: "buyer",
            content:
              "Ja, sorry. Findr ist nicht mehr Prio eins. Wir schauen erstmal, ob wir mit Clari weiterkommen.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 84,
      scoreRangeMax: 99,
      requiredSignals: [
        "COMPETITOR_PRESSURE",
        "CHAMPION_LOSS",
        "ENGAGEMENT_DROP",
      ],
    },
  },
  {
    id: "eval_008",
    description: "Budget confusion, late procurement, stakeholder replacement",
    category: "critical",
    deal: {
      id: "eval_008",
      name: "KaiserTech Sales Intelligence",
      company: "KaiserTech GmbH",
      stage: "proposal_sent",
      amount: 118000,
      ownerName: "Rebecca Davis",
      lastActivity: "2026-04-27",
    },
    calls: [
      {
        id: "eval_008_call_1",
        title: "Commercial confusion",
        duration_seconds: 1560,
        recorded_at: "2026-04-20",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Wir hatten intern mit brutto gerechnet, nicht netto. Das sprengt unser Quartalsbudget deutlich.",
          },
          {
            speaker_role: "champion",
            content:
              "Anna aus Procurement uebernimmt jetzt, ich bin aus dem Freigabeprozess raus.",
          },
        ],
      },
      {
        id: "eval_008_call_2",
        title: "Procurement reset",
        duration_seconds: 970,
        recorded_at: "2026-05-04",
        transcript_segments: [
          {
            speaker_role: "decision_maker",
            content:
              "Procurement startet den Vergleich neu, inklusive bestehender Anbieter. Wir koennen keinen Zeitplan zusagen.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 80,
      scoreRangeMax: 94,
      requiredSignals: [
        "BUDGET_FRICTION",
        "STAKEHOLDER_CHURN",
        "STALLING_PATTERN",
      ],
    },
  },
  {
    id: "eval_009",
    description: "Stalling pattern and late decision maker discovery",
    category: "high",
    deal: {
      id: "eval_009",
      name: "CloudCommerce Platform",
      company: "CloudCommerce Inc.",
      stage: "negotiation",
      amount: 98000,
      ownerName: "Emily Chen",
      lastActivity: "2026-05-02",
    },
    calls: [
      {
        id: "eval_009_call_1",
        title: "Timeline push",
        duration_seconds: 1260,
        recorded_at: "2026-04-24",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Lass mich das nochmal mit Mike durchgehen. Ich bin dran, melde mich naechste Woche.",
          },
          {
            speaker_role: "champion",
            content:
              "Du, Mike sagte jetzt, er will erst mit Andreas sprechen. Kennst du den schon? Der ist final approver.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 62,
      scoreRangeMax: 78,
      requiredSignals: ["STALLING_PATTERN", "LATE_DECISION_MAKER"],
    },
  },
  {
    id: "eval_010",
    description: "HubSpot comparison and price pressure without champion loss",
    category: "high",
    deal: {
      id: "eval_010",
      name: "MunichSoft Revenue Ops",
      company: "MunichSoft GmbH",
      stage: "proposal_sent",
      amount: 54000,
      ownerName: "Christine Wagner",
      lastActivity: "2026-05-06",
    },
    calls: [
      {
        id: "eval_010_call_1",
        title: "Competitive pricing",
        duration_seconds: 1110,
        recorded_at: "2026-05-01",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "HubSpot bietet uns gerade ein Add-on im Paket an. Das ist nicht gleich tief, aber preislich einfacher zu rechtfertigen.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Ich brauche einen klaren ROI, sonst sieht Finance nur ein weiteres Sales-Tool.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 60,
      scoreRangeMax: 76,
      requiredSignals: ["COMPETITOR_PRESSURE", "BUDGET_FRICTION"],
    },
  },
  {
    id: "eval_011",
    description: "Champion is present but visibly losing energy and cadence",
    category: "high",
    deal: {
      id: "eval_011",
      name: "RootSignal Coaching Suite",
      company: "RootSignal Inc.",
      stage: "negotiation",
      amount: 69000,
      ownerName: "Robert Kim",
      lastActivity: "2026-05-03",
    },
    calls: [
      {
        id: "eval_011_call_1",
        title: "Shortened champion call",
        duration_seconds: 840,
        recorded_at: "2026-04-29",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ich habe heute nur 15 Minuten statt der geplanten 45. Intern war wenig Rueckmeldung, vielleicht ist das Thema nicht mehr ganz oben.",
          },
          {
            speaker_role: "buyer",
            content:
              "Die letzten Follow-ups lagen ehrlich gesagt ein paar Tage bei mir. Sorry, gerade andere Prioritaeten.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 60,
      scoreRangeMax: 74,
      requiredSignals: ["CHAMPION_DISENGAGEMENT", "ENGAGEMENT_DROP"],
    },
  },
  {
    id: "eval_012",
    description: "Late legal and works council path adds approval risk",
    category: "high",
    deal: {
      id: "eval_012",
      name: "Mittelstand Werke AI Review",
      company: "Mittelstand Werke GmbH",
      stage: "proposal_sent",
      amount: 88000,
      ownerName: "Felix Roth",
      lastActivity: "2026-05-02",
    },
    calls: [
      {
        id: "eval_012_call_1",
        title: "Legal surprise",
        duration_seconds: 1480,
        recorded_at: "2026-04-28",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Wir haben Legal und Betriebsrat noch gar nicht eingebunden. Die muessen bei Call-Recording-Themen final zustimmen.",
          },
          {
            speaker_role: "champion",
            content:
              "Ich dachte, das klaeren wir spaeter, aber der Betriebsrat will jetzt vor dem Pilot ein offizielles Konzept.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 61,
      scoreRangeMax: 77,
      // STALLING_PATTERN removed: this is a single, newly-surfaced Legal/Betriebsrat
      // approval gate (LATE_DECISION_MAKER), not repeated postponement — there is no
      // "we said next week again" pattern in the transcript. Level stays high: an
      // unengaged works-council veto gate blocking the pilot is a real late blocker.
      requiredSignals: ["LATE_DECISION_MAKER"],
    },
  },
  {
    id: "eval_013",
    description: "Stakeholder churn with new sales leader reopening criteria",
    category: "high",
    deal: {
      id: "eval_013",
      name: "Nexware Expansion",
      company: "Nexware AG",
      stage: "negotiation",
      amount: 72000,
      ownerName: "Lisa Chen",
      lastActivity: "2026-05-04",
    },
    calls: [
      {
        id: "eval_013_call_1",
        title: "New leader reset",
        duration_seconds: 1330,
        recorded_at: "2026-04-30",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Unser neuer VP Sales startet Montag. Er will alle Tool-Entscheidungen nochmal gegen seine Kriterien reviewen.",
          },
          {
            speaker_role: "champion",
            content:
              "Ich kann ihn introen, aber wir muessen wahrscheinlich einen Schritt zurueck in die Discovery.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 60,
      scoreRangeMax: 75,
      requiredSignals: ["STAKEHOLDER_CHURN", "LATE_DECISION_MAKER"],
    },
  },
  {
    id: "eval_014",
    description: "Budget friction and procurement asks for pause",
    category: "high",
    deal: {
      id: "eval_014",
      name: "Westfalen Digital Sales OS",
      company: "Westfalen Digital GmbH",
      stage: "proposal_sent",
      amount: 61000,
      ownerName: "David Park",
      lastActivity: "2026-05-01",
    },
    calls: [
      {
        id: "eval_014_call_1",
        title: "Procurement objection",
        duration_seconds: 1180,
        recorded_at: "2026-04-27",
        transcript_segments: [
          {
            speaker_role: "decision_maker",
            content:
              "Procurement fragt, ob wir bis Q3 warten koennen. Das Budget fuer Q2 ist eigentlich schon committed.",
          },
          {
            speaker_role: "champion",
            content:
              "Ich finde Findr weiterhin stark, aber ich bekomme gerade kein Budget-Signal.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 60,
      scoreRangeMax: 73,
      requiredSignals: ["BUDGET_FRICTION", "STALLING_PATTERN"],
    },
  },
  {
    id: "eval_015",
    description: "Engagement drop plus competitor pilot starts quietly",
    category: "high",
    deal: {
      id: "eval_015",
      name: "Lattix Software Coaching",
      company: "Lattix Inc.",
      stage: "negotiation",
      amount: 82000,
      ownerName: "Jennifer Wu",
      lastActivity: "2026-04-30",
    },
    calls: [
      {
        id: "eval_015_call_1",
        title: "Low-energy follow-up",
        duration_seconds: 920,
        recorded_at: "2026-04-25",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Sorry fuer die Funkstille, wir hatten intern wenig Bewegung. Nebenbei testen wir gerade noch Chorus mit einem kleinen Team.",
          },
          {
            speaker_role: "champion",
            content:
              "Ich wuerde ungern schon einen naechsten Workshop blocken, bevor wir den Vergleich gesehen haben.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 62,
      scoreRangeMax: 78,
      requiredSignals: ["ENGAGEMENT_DROP", "COMPETITOR_PRESSURE"],
    },
  },
  {
    id: "eval_016",
    description: "Champion delegates internal selling and decision criteria become unclear",
    category: "high",
    deal: {
      id: "eval_016",
      name: "Aareon Revenue Review",
      company: "Aareon GmbH",
      stage: "proposal_sent",
      amount: 93000,
      ownerName: "Mike Johnson",
      lastActivity: "2026-05-02",
    },
    calls: [
      {
        id: "eval_016_call_1",
        title: "Delegated champion",
        duration_seconds: 1050,
        recorded_at: "2026-04-30",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ich schicke das mal an meine Kollegin weiter. Ich selbst bin die naechsten Wochen nicht tief drin.",
          },
          {
            speaker_role: "buyer",
            content:
              "Die Entscheidungskriterien sind ehrlich gesagt noch nicht final. Vielleicht sollten wir im Juni neu bewerten.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 60,
      scoreRangeMax: 74,
      requiredSignals: ["CHAMPION_DISENGAGEMENT", "STALLING_PATTERN"],
    },
  },
  {
    id: "eval_017",
    description: "Subtle disengagement with shorter calls and slower replies",
    category: "medium",
    deal: {
      id: "eval_017",
      name: "VectorLabs Sales Enablement",
      company: "VectorLabs GmbH",
      stage: "qualified",
      amount: 42000,
      ownerName: "Sarah Mueller",
      lastActivity: "2026-05-07",
    },
    calls: [
      {
        id: "eval_017_call_1",
        title: "Soft delay",
        duration_seconds: 780,
        recorded_at: "2026-05-06",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Klingt weiterhin interessant, aber koennen wir uns das spaeter nochmal anschauen? Die letzten Mails habe ich erst nach zwei, drei Tagen gesehen.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 42,
      scoreRangeMax: 58,
      requiredSignals: ["CHAMPION_DISENGAGEMENT", "ENGAGEMENT_DROP"],
      forbiddenSignals: ["CHAMPION_LOSS"],
    },
  },
  {
    id: "eval_018",
    description: "Early-stage stall with vague internal review",
    category: "medium",
    deal: {
      id: "eval_018",
      name: "FinEdge Pilot",
      company: "FinEdge GmbH",
      stage: "qualified",
      amount: 36000,
      ownerName: "Thomas Becker",
      lastActivity: "2026-05-08",
    },
    calls: [
      {
        id: "eval_018_call_1",
        title: "Discovery follow-up",
        duration_seconds: 960,
        recorded_at: "2026-05-07",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Das ist sehr interessant. Lass uns das intern nochmal besprechen und dann schauen wir, ob ein Pilot Sinn macht.",
          },
          {
            speaker_role: "ae",
            content:
              "Wer ist bei der internen Runde dabei und bis wann wollt ihr entscheiden?",
          },
          {
            speaker_role: "buyer",
            content: "Noch nicht ganz klar, ich melde mich dazu.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 40,
      scoreRangeMax: 56,
      requiredSignals: ["STALLING_PATTERN"],
    },
  },
  {
    id: "eval_019",
    description: "Budget concern but champion remains active",
    category: "medium",
    deal: {
      id: "eval_019",
      name: "BlueHarbor Enablement",
      company: "BlueHarbor AG",
      stage: "proposal_sent",
      amount: 47000,
      ownerName: "Rebecca Davis",
      lastActivity: "2026-05-06",
    },
    calls: [
      {
        id: "eval_019_call_1",
        title: "Budget clarification",
        duration_seconds: 1160,
        recorded_at: "2026-05-05",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ich bin weiterhin Sponsor, aber Finance fragt, ob wir das in zwei Tranchen zahlen koennen. Der Gesamtwert ist okay, Timing ist das Thema.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 43,
      scoreRangeMax: 59,
      requiredSignals: ["BUDGET_FRICTION"],
      forbiddenSignals: ["CHAMPION_LOSS"],
    },
  },
  {
    id: "eval_020",
    description: "Competitor mentioned as benchmark, not yet active replacement",
    category: "medium",
    deal: {
      id: "eval_020",
      name: "UrbanMobility Sales Review",
      company: "UrbanMobility GmbH",
      stage: "qualified",
      amount: 52000,
      ownerName: "Emily Chen",
      lastActivity: "2026-05-09",
    },
    calls: [
      {
        id: "eval_020_call_1",
        title: "Demo debrief",
        duration_seconds: 1240,
        recorded_at: "2026-05-08",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Wir kennen Gong aus einem frueheren Unternehmen. Wir vergleichen nicht final, aber unser CRO wird fragen, wie ihr euch dagegen abgrenzt.",
          },
          {
            speaker_role: "champion",
            content:
              "Ich finde den DACH-Fokus spannend. Lasst uns die Differenzierung sauber vorbereiten.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 40,
      scoreRangeMax: 55,
      requiredSignals: ["COMPETITOR_PRESSURE"],
    },
  },
  {
    id: "eval_021",
    description: "Decision maker appears late but is collaborative",
    category: "medium",
    deal: {
      id: "eval_021",
      name: "Bergmann SaaS Audit",
      company: "Bergmann Systems",
      stage: "proposal_sent",
      amount: 64000,
      ownerName: "Klaus Brandt",
      lastActivity: "2026-05-09",
    },
    calls: [
      {
        id: "eval_021_call_1",
        title: "New stakeholder intro",
        duration_seconds: 1380,
        recorded_at: "2026-05-08",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Unser CFO moechte naechste Woche einmal dabei sein. Nicht weil es schlecht aussieht, eher weil er alle neuen Tools sehen will.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Schickt mir bitte vorab ROI und Datenschutzuebersicht, dann kann ich schnell entscheiden.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 42,
      scoreRangeMax: 58,
      requiredSignals: ["LATE_DECISION_MAKER"],
      forbiddenSignals: ["BUDGET_FRICTION"],
    },
  },
  {
    id: "eval_022",
    description: "Minor stakeholder churn with backup champion still engaged",
    category: "medium",
    deal: {
      id: "eval_022",
      name: "Kantor Analytics Pilot",
      company: "Kantor Analytics GmbH",
      stage: "qualified",
      amount: 39000,
      ownerName: "Petra Hoffmann",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_022_call_1",
        title: "Team change",
        duration_seconds: 1020,
        recorded_at: "2026-05-09",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Unser Sales Ops Manager wechselt ins Partnerteam. Lena uebernimmt, sie war aber im ersten Call dabei.",
          },
          {
            speaker_role: "champion",
            content:
              "Ich bleibe Sponsor und hole Lena in den naechsten Workshop dazu.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 40,
      scoreRangeMax: 54,
      requiredSignals: ["STAKEHOLDER_CHURN"],
      forbiddenSignals: ["CHAMPION_LOSS"],
    },
  },
  {
    id: "eval_023",
    description: "Healthy multi-threaded deal with clear criteria and timeline",
    category: "low",
    deal: {
      id: "eval_023",
      name: "TechCorp Renewal",
      company: "TechCorp Inc.",
      stage: "verbal_commit",
      amount: 120000,
      ownerName: "Mike Johnson",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_023_call_1",
        title: "Mutual action plan",
        duration_seconds: 1800,
        recorded_at: "2026-05-09",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Wir haben Lisa aus Procurement und James als VP im Loop. Decision Criteria sind ROI, DSGVO und Rollout bis Ende Juni.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Passt. Wenn Security Freitag gruen gibt, unterschreiben wir naechste Woche.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 5,
      scoreRangeMax: 35,
      requiredSignals: [],
      forbiddenSignals: ALL_SIGNALS,
    },
  },
  {
    id: "eval_024",
    description: "Small clean pilot with engaged champion and no competitors",
    category: "low",
    deal: {
      id: "eval_024",
      name: "MunichSoft Starter Pilot",
      company: "MunichSoft GmbH",
      stage: "qualified",
      amount: 18000,
      ownerName: "Christine Wagner",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_024_call_1",
        title: "Pilot planning",
        duration_seconds: 1500,
        recorded_at: "2026-05-09",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ich habe intern schon Budget reserviert. Der Pilot ist klein genug, ich kann ihn selbst freigeben.",
          },
          {
            speaker_role: "buyer",
            content:
              "Keine Konkurrenz im Prozess. Wir wollen einfach schnell sehen, ob die Call-Signale fuer unser Team funktionieren.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 8,
      scoreRangeMax: 34,
      requiredSignals: [],
      forbiddenSignals: ALL_SIGNALS,
    },
  },
  {
    id: "eval_025",
    description: "Healthy late-stage enterprise deal with executive sponsor",
    category: "low",
    deal: {
      id: "eval_025",
      name: "Lattix Enterprise Expansion",
      company: "Lattix Inc.",
      stage: "verbal_commit",
      amount: 95000,
      ownerName: "Jennifer Wu",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_025_call_1",
        title: "Executive alignment",
        duration_seconds: 1740,
        recorded_at: "2026-05-09",
        transcript_segments: [
          {
            speaker_role: "decision_maker",
            content:
              "Ich sponsor das intern. Procurement hat die Terms, Security ist durch, und der Rollout-Plan steht.",
          },
          {
            speaker_role: "champion",
            content:
              "Wir haben jeden Dienstag Steering. Ich schicke euch heute noch die unterschriftsberechtigte Person.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 5,
      scoreRangeMax: 30,
      requiredSignals: [],
      forbiddenSignals: ALL_SIGNALS,
    },
  },
  {
    id: "eval_026",
    description: "DE champion and English CFO enter late with procurement freeze",
    category: "critical",
    deal: {
      id: "eval_026",
      name: "Nordbank Global Risk Desk",
      company: "Nordbank GmbH",
      stage: "negotiation",
      amount: 205000,
      ownerName: "Sarah Mueller",
      lastActivity: "2026-05-04",
    },
    calls: [
      {
        id: "eval_026_call_1",
        title: "Bilingual CFO escalation",
        duration_seconds: 3180,
        recorded_at: "2026-05-02",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Marcus hier. Ich glaube wir muessen das mit Procurement nochmal klaeren. We need to circle back with our procurement team because the CFO was not in the previous loop. Bisher war ich davon ausgegangen, dass Security und Sales Ops reichen, aber seit gestern sagt Finance, dass jeder Vendor ueber 150k nochmal durch den CFO-Review muss.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "I am joining late, so I need to be direct. I have not seen a signed-off budget envelope for Findr, and I will not approve a commitment this quarter without a revised procurement packet. Salesforce is already approved as a strategic vendor, so from my perspective Findr needs a much stronger justification.",
          },
          {
            speaker_role: "buyer",
            content:
              "Wir haben im Team ehrlich gesagt auch noch keine interne Story, wer das vor Finance verteidigt, wenn Marcus im Juni in sein neues Programm wechselt. Lass uns bitte keinen Termin fuer Signature planen, bevor wir CFO und Procurement aligned haben.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 82,
      scoreRangeMax: 97,
      requiredSignals: [
        "LATE_DECISION_MAKER",
        "BUDGET_FRICTION",
        "COMPETITOR_PRESSURE",
      ],
    },
  },
  {
    id: "eval_027",
    description: "English call with German idioms showing repeated stalling",
    category: "high",
    deal: {
      id: "eval_027",
      name: "Helven Industries Forecasting",
      company: "Helven Industries GmbH",
      stage: "proposal_sent",
      amount: 84000,
      ownerName: "Klaus Brandt",
      lastActivity: "2026-05-05",
    },
    calls: [
      {
        id: "eval_027_call_1",
        title: "International buying committee check-in",
        duration_seconds: 2520,
        recorded_at: "2026-05-01",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "The demo was good, no question. But let me check with my team first. Wir melden uns dann nochmal, because I do not want to promise a timeline before our local sales leadership has reacted.",
          },
          {
            speaker_role: "ae",
            content:
              "Last time we agreed that Sales Ops would confirm the pilot scope by Friday. Is there a specific blocker or a missing stakeholder?",
          },
          {
            speaker_role: "champion",
            content:
              "Not one blocker, more like several open loops. Let me take it offline again. I know I said next week twice already, aber ich moechte das intern sauber abholen. Maybe we reconnect after the leadership offsite.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 62,
      scoreRangeMax: 78,
      requiredSignals: ["STALLING_PATTERN"],
    },
  },
  {
    id: "eval_028",
    description: "Normal DE/EN code-switching in a healthy technical evaluation",
    category: "medium",
    deal: {
      id: "eval_028",
      name: "RootSignal DACH Rollout",
      company: "RootSignal Inc.",
      stage: "demo",
      amount: 58000,
      ownerName: "Emily Chen",
      lastActivity: "2026-05-09",
    },
    calls: [
      {
        id: "eval_028_call_1",
        title: "Technical discovery with natural code switching",
        duration_seconds: 2700,
        recorded_at: "2026-05-08",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Wir wechseln hier dauernd zwischen Deutsch und Englisch, because our RevOps lead sits in London. Das ist kein Zeichen, dass wir uns nicht einig sind. Fuer uns sind drei Dinge wichtig: data residency in EU, Salesforce sync und that managers can coach from call snippets without switching tools.",
          },
          {
            speaker_role: "champion",
            content:
              "I already booked Legal for Tuesday and Lena from IT for Thursday. Wir brauchen dann nur noch die DPA und die Architekturfolie. Wenn das passt, kann ich am Freitag die Pilotfreigabe geben.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "The only watch item is enablement capacity. We do not want to roll this out to all teams in week one. Start with DACH Enterprise, then expand after the first manager training.",
          },
        ],
      },
    ],
    expected: {
      // Range widened down: this is a fundamentally healthy early-stage deal with one minor watch item; a low score is defensible. The real test here is the forbidden signals (no stalling/competitor/champion-loss), which must stay.
      riskLevel: "low",
      scoreRangeMin: 15,
      scoreRangeMax: 39,
      requiredSignals: [],
      forbiddenSignals: [
        "STALLING_PATTERN",
        "COMPETITOR_PRESSURE",
        "CHAMPION_LOSS",
      ],
    },
  },
  {
    id: "eval_029",
    description: "Trilingual healthy call with clear stakeholder alignment",
    category: "low",
    deal: {
      id: "eval_029",
      name: "Lattix EMEA Enablement",
      company: "Lattix Inc.",
      stage: "verbal_commit",
      amount: 72000,
      ownerName: "Jennifer Wu",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_029_call_1",
        title: "DE EN FR rollout planning",
        duration_seconds: 2400,
        recorded_at: "2026-05-10",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Wir sind aligned. Anna macht Procurement, Jean-Pierre macht Security, and I own the enablement plan. Pour la France, we start with five managers and the German team follows two weeks later.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Budget is approved. Legal only asked for the standard DPA, not a redline negotiation. If we receive the final order form tomorrow, I can sign on Friday.",
          },
          {
            speaker_role: "buyer",
            content:
              "No competitor track from our side. We chose Findr because the German transcripts and manager coaching workflow are stronger than the generic options.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 6,
      scoreRangeMax: 30,
      requiredSignals: [],
      forbiddenSignals: ALL_SIGNALS,
    },
  },
  {
    id: "eval_030",
    description: "French CDO enters late and complicates stakeholder map",
    category: "high",
    deal: {
      id: "eval_030",
      name: "SaaSCo European Data Program",
      company: "SaaSCo Holdings",
      stage: "proposal_sent",
      amount: 165000,
      ownerName: "Marcus Thompson",
      lastActivity: "2026-05-06",
    },
    calls: [
      {
        id: "eval_030_call_1",
        title: "Late CDO review",
        duration_seconds: 2940,
        recorded_at: "2026-05-03",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "We were ready to move this to procurement, but Claire, our new CDO in Paris, wants to review all conversation data flows. Sie war bisher gar nicht im Prozess, und ich kann nicht einschaetzen, ob sie nur pruefen oder wirklich entscheiden will.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Je dois comprendre ou les donnees sont traitees, who can access the recordings, and whether Works Council approvals in Germany are reusable for France. Without that, I cannot approve the European rollout.",
          },
          {
            speaker_role: "buyer",
            content:
              "Das macht die Map komplizierter. Sales Ops ist dafuer, Legal ist neutral, aber die CDO kann das Thema faktisch blocken.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 62,
      scoreRangeMax: 79,
      requiredSignals: ["LATE_DECISION_MAKER"],
    },
  },
  {
    id: "eval_031",
    description: "Long friendly call hides one explicit champion loss signal",
    category: "high",
    deal: {
      id: "eval_031",
      name: "AlpenBank Coaching Desk",
      company: "AlpenBank AG",
      stage: "negotiation",
      amount: 144000,
      ownerName: "Sarah Mueller",
      lastActivity: "2026-05-07",
    },
    calls: [
      {
        id: "eval_031_call_1",
        title: "Long roadmap workshop with hidden champion loss",
        duration_seconds: 3900,
        recorded_at: "2026-05-06",
        transcript_segments: [
          {
            speaker_role: "ae",
            content:
              "Before we jump into the roadmap, quick recap from last month. We covered forecasting hygiene, the manager coaching view, the Gong import, and the Slack alerting route. Your team asked for role-based permissions, EU data processing, export controls, and a way to separate private coaching notes from deal-risk notes. We also agreed that the pilot group would be Swiss Enterprise plus two German strategic accounts. I brought a revised rollout plan today, with week one for configuration, week two for transcript validation, week three for manager enablement, and week four for executive readout. Nothing here requires a broad deployment yet, so we can keep the first phase lightweight.",
          },
          {
            speaker_role: "buyer",
            content:
              "That matches my notes. On the technical side, the main thing our architects wanted was clarity on where the transcript snippets are stored and whether deleted Gong calls disappear in your system as well. There was also a question about German call consent text, but that is not blocking. The sales managers liked the workflow, especially because they do not want another dashboard with generic analytics. They want three things: which deal is slipping, which moment in the call caused the flag, and what they should coach next. If you can keep it that practical, adoption is realistic.",
          },
          {
            speaker_role: "champion",
            content:
              "Small but important update before we close: I accepted a role in Group Strategy and will leave the Revenue Operations team in three weeks. I can still help with context, but I will not be the internal owner for Findr anymore. My replacement is not named yet, so please do not assume I can push the procurement packet after this month.",
          },
          {
            speaker_role: "ae",
            content:
              "Thanks for saying that directly. Who should we multi-thread now so this does not lose momentum when you move?",
          },
          {
            speaker_role: "buyer",
            content:
              "Probably Nina from Sales Ops and Tobias from Finance. But Nina is on holiday next week and Tobias has not seen the demo. We should schedule a restart call with both of them.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 64,
      scoreRangeMax: 79,
      requiredSignals: ["CHAMPION_LOSS"],
    },
  },
  {
    id: "eval_032",
    description: "Very long call where stalling becomes explicit late",
    category: "critical",
    deal: {
      id: "eval_032",
      name: "DACH Logistics Control Tower",
      company: "DACH Logistics AG",
      stage: "negotiation",
      amount: 225000,
      ownerName: "Hans Mueller",
      lastActivity: "2026-05-01",
    },
    calls: [
      {
        id: "eval_032_call_1",
        title: "Extended implementation workshop",
        duration_seconds: 5100,
        recorded_at: "2026-04-29",
        transcript_segments: [
          {
            speaker_role: "ae",
            content:
              "Let me walk through the implementation in detail because the rollout touches several regions. Phase one is read-only import from Gong and Hubspot, no writeback. Phase two introduces risk alerts to the sales manager channel, but only after the team validates the signal quality. Phase three adds coaching reports. We can keep all EU customer data in the EU region, use SSO, and restrict transcript access by role. Your logistics business also has seasonal volume spikes, so I would not recommend launching during quarter-end closing. The safer plan is configuration in June, pilot in July, and manager enablement in early August.",
          },
          {
            speaker_role: "buyer",
            content:
              "Technically that is fine. We discussed the architecture with IT, and they are not scared by the integration. The challenge is more internal sequencing. Operations, Sales, Finance, and Legal all want different success metrics. Operations cares about forecast misses, Sales cares about coaching, Finance cares about tool consolidation, and Legal wants a clean retention policy. None of that is surprising, but it means we need one steering owner who can force tradeoffs.",
          },
          {
            speaker_role: "champion",
            content:
              "I hear you. For now, let me take it back to the group. We should not decide today. I know we said the same after the last workshop, but I need another internal round. Vielleicht melden wir uns Ende Juni nochmal, because right now too many people have partial opinions and nobody wants to own the final call.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "To be transparent, before new leadership starts, no signature will happen. The board asked us to pause all non-critical commercial systems until the operating model is confirmed. If Findr still matters in Q3, we can restart with a new sponsor.",
          },
          {
            speaker_role: "champion",
            content:
              "Yes, that is where we are. Lass uns das im Q3 nochmal besprechen. I do not want to keep weekly meetings on the calendar if we cannot move anything forward.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "critical",
      scoreRangeMin: 82,
      scoreRangeMax: 96,
      // ENGAGEMENT_DROP removed: the only engagement signal here is the champion
      // pulling back from cadence ("I do not want to keep weekly meetings ... if we
      // cannot move anything forward") — the same root as CHAMPION_DISENGAGEMENT,
      // the more specific label the prompt asks for. Requiring both double-counts
      // one event; the buyer team is otherwise engaged.
      requiredSignals: ["STALLING_PATTERN"],
    },
  },
  {
    id: "eval_033",
    description: "Very long technical demo with no risk despite complexity",
    category: "low",
    deal: {
      id: "eval_033",
      name: "CloudCommerce Technical Evaluation",
      company: "CloudCommerce Inc.",
      stage: "demo",
      amount: 112000,
      ownerName: "Rebecca Davis",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_033_call_1",
        title: "Detailed architecture demo",
        duration_seconds: 5400,
        recorded_at: "2026-05-09",
        transcript_segments: [
          {
            speaker_role: "ae",
            content:
              "Today is intentionally technical. We will cover tenant isolation, transcript ingestion, the scoring pipeline, audit logging, and export controls. I will not ask for a decision in this meeting; the goal is to make sure your platform team has enough detail for the architecture checklist. After that we already have the commercial review scheduled for Thursday, and Sabine from procurement has the order form. The only open item from our side is whether you want manager coaching reports weekly or biweekly in the pilot.",
          },
          {
            speaker_role: "buyer",
            content:
              "That is exactly the right framing. Our architects tend to ask a lot of questions, but that is normal and not a blocker. The team wants to understand deletion behavior, field-level permissions, and how Findr handles transcripts when Gong marks a call private. We already agreed internally that if those three answers are clean, we move to procurement. Niemand stellt die Entscheidung grundsaetzlich in Frage.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "I am comfortable with the timeline. We have budget approved, and the executive sponsor wants this in place before the July QBR. Please send the security appendix after the call, and I will ask IT to confirm by Wednesday. There is no competitive track; this is a validation step, not a re-opened vendor search.",
          },
          {
            speaker_role: "champion",
            content:
              "I will own the internal follow-up. Thomas handles IT, Miriam handles legal, and I handle the pilot group. If anything slips, I will tell you directly, but right now this looks straightforward.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 5,
      scoreRangeMax: 28,
      requiredSignals: [],
      forbiddenSignals: ALL_SIGNALS,
    },
  },
  {
    id: "eval_034",
    description: "Long call with mixed engagement levels over time",
    category: "medium",
    deal: {
      id: "eval_034",
      name: "Bayrische Versicherung Manager Coaching",
      company: "Bayrische Versicherung AG",
      stage: "proposal_sent",
      amount: 92000,
      ownerName: "Thomas Becker",
      lastActivity: "2026-05-06",
    },
    calls: [
      {
        id: "eval_034_call_1",
        title: "Mixed engagement follow-up",
        duration_seconds: 4200,
        recorded_at: "2026-05-05",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "The first half of the pilot looked good. Sales managers used the risk timeline more than expected, and the team liked that the quotes were tied to call moments. The issue is that since the claims transformation project started, attendance has dropped. Last week we had seven people in the enablement session; this week only three joined. That does not mean Findr is dead, but attention is split.",
          },
          {
            speaker_role: "champion",
            content:
              "I am still positive. I just need to be honest that my response times got worse. Emails that I answered in one day are now taking three or four days because the transformation steering is eating my calendar.",
          },
          {
            speaker_role: "ae",
            content:
              "Would it help if we reduce the pilot scope and only keep the two teams that are still active?",
          },
          {
            speaker_role: "champion",
            content:
              "Yes, that would help. Let's not escalate yet. I can get Sales Ops back in the loop next Wednesday, and then we decide whether we keep the June business review.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 42,
      scoreRangeMax: 58,
      requiredSignals: ["ENGAGEMENT_DROP", "CHAMPION_DISENGAGEMENT"],
    },
  },
  {
    id: "eval_035",
    description: "Sales rep dominates long call before buyer pushes to Q3",
    category: "high",
    deal: {
      id: "eval_035",
      name: "KaiserTech Revenue Rollout",
      company: "KaiserTech GmbH",
      stage: "negotiation",
      amount: 101000,
      ownerName: "Rebecca Davis",
      lastActivity: "2026-05-02",
    },
    calls: [
      {
        id: "eval_035_call_1",
        title: "Rep-heavy demo with late Q3 deferral",
        duration_seconds: 3900,
        recorded_at: "2026-05-01",
        transcript_segments: [
          {
            speaker_role: "ae",
            content:
              "I will keep this structured. First, deal-risk overview; second, coaching recommendations by rep; third, Slack alerts; fourth, what changes after the Gong integration. For the deal-risk overview, every score is append-only, so your managers can see whether an account is improving or getting worse. For coaching, Sarah's team can see that stalling patterns cluster in late proposal stages. For alerts, thresholds can be tuned so you do not get spammed. Finally, the Gong integration will give you transcripts automatically, so AEs do not need to upload notes. I know that is a lot, but I want you to see the whole operating model.",
          },
          {
            speaker_role: "ae",
            content:
              "On implementation, we can start with a low-risk pilot. No writeback, no AI calls during demo mode, and only three managers. We map calls to deals using title and participant domains, then your RevOps team can manually override later. The important part is that the manager gets a simple view: deal, risk pattern, quote, recommended coaching action. This is not another forecasting dashboard; it is a weekly operating rhythm.",
          },
          {
            speaker_role: "buyer",
            content:
              "The walkthrough is useful, but I need to stop us before we pretend this is a May signature. Lass uns das im Q3 nochmal besprechen. Our new VP Sales starts in July, and she will want to own the coaching process. If we sign before she joins, I risk buying something she may change.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Correct. The VP Sales is the actual owner for this budget. She has not met Findr yet, so any decision before July would be premature.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 65,
      scoreRangeMax: 79,
      requiredSignals: ["STALLING_PATTERN", "LATE_DECISION_MAKER"],
    },
  },
  {
    id: "eval_036",
    description: "Internally discuss phrase in healthy context should not flag stalling",
    category: "low",
    deal: {
      id: "eval_036",
      name: "MunichSoft Expansion Pilot",
      company: "MunichSoft GmbH",
      stage: "qualified",
      amount: 26000,
      ownerName: "Christine Wagner",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_036_call_1",
        title: "Healthy internal review",
        duration_seconds: 1620,
        recorded_at: "2026-05-10",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Wir muessen das nochmal intern besprechen, aber nur damit ich die Pilotgruppe final bestaetige. Budget ist freigegeben, ich bin Owner, und der naechste Termin mit IT steht schon am Donnerstag.",
          },
          {
            speaker_role: "buyer",
            content:
              "Genau. Das ist kein Nein und kein Delay. Wir wollen nur sicherstellen, dass die zwei richtigen Teamleiter im Pilot sind.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 8,
      scoreRangeMax: 32,
      requiredSignals: [],
      forbiddenSignals: ["STALLING_PATTERN", "BUDGET_FRICTION"],
    },
  },
  {
    id: "eval_037",
    description: "Same internal-discussion phrase after six months without progress",
    category: "high",
    deal: {
      id: "eval_037",
      name: "RheinWerk Sales Analytics",
      company: "RheinWerk Maschinenbau",
      stage: "proposal_sent",
      amount: 88000,
      ownerName: "Petra Hoffmann",
      lastActivity: "2026-05-01",
    },
    calls: [
      {
        id: "eval_037_call_1",
        title: "Six month no-progress review",
        duration_seconds: 2100,
        recorded_at: "2026-04-30",
        transcript_segments: [
          {
            speaker_role: "ae",
            content:
              "We have had discovery in November, demo in January, procurement in March, and three follow-ups since then. What has to happen for this to move?",
          },
          {
            speaker_role: "champion",
            content:
              "Ich weiss, das zieht sich. Wir muessen das nochmal intern besprechen. Ich kann dir aber keinen Owner und kein Datum nennen, weil Sales, IT und Finance gerade alle sagen, jemand anders muesse entscheiden.",
          },
          {
            speaker_role: "buyer",
            content:
              "Realistisch passiert vor Ende Juni nichts. Wenn der neue Vertriebsleiter kommt, faengt die Diskussion vielleicht nochmal von vorne an.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 66,
      scoreRangeMax: 79,
      requiredSignals: ["STALLING_PATTERN", "LATE_DECISION_MAKER"],
    },
  },
  {
    id: "eval_038",
    description: "Written follow-up request as legitimate due diligence",
    category: "low",
    deal: {
      id: "eval_038",
      name: "TechCorp Security Renewal",
      company: "TechCorp Inc.",
      stage: "verbal_commit",
      amount: 120000,
      ownerName: "Mike Johnson",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_038_call_1",
        title: "Security due diligence",
        duration_seconds: 1740,
        recorded_at: "2026-05-09",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Koennen Sie mir das schriftlich schicken? Our security team needs the retention answer in the vendor file. They already approved the architecture verbally, but they need the document for audit.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "This is normal process. We are not reopening vendor selection. Send the written security response today and procurement can continue tomorrow.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 6,
      scoreRangeMax: 30,
      requiredSignals: [],
      forbiddenSignals: ["STALLING_PATTERN", "COMPETITOR_PRESSURE"],
    },
  },
  {
    id: "eval_039",
    description: "Discount request signals true pricing friction",
    category: "high",
    deal: {
      id: "eval_039",
      name: "CloudCommerce Expansion",
      company: "CloudCommerce Inc.",
      stage: "negotiation",
      amount: 174000,
      ownerName: "Emily Chen",
      lastActivity: "2026-05-04",
    },
    calls: [
      {
        id: "eval_039_call_1",
        title: "Discount escalation",
        duration_seconds: 2040,
        recorded_at: "2026-05-03",
        transcript_segments: [
          {
            speaker_role: "decision_maker",
            content:
              "I know every buyer asks for discount, but this is not negotiation theater. We only have 90k approved. If Findr stays near 174k, we cannot buy it this year.",
          },
          {
            speaker_role: "buyer",
            content:
              "HubSpot is not equivalent, but it is already in our stack and Finance is asking why we would double the spend. Unless you can show a hard ROI and a lower first-year commitment, this is blocked.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 64,
      scoreRangeMax: 79,
      requiredSignals: ["BUDGET_FRICTION", "COMPETITOR_PRESSURE"],
    },
  },
  {
    id: "eval_040",
    description: "Champion delegates to junior and early disengagement begins",
    category: "medium",
    deal: {
      id: "eval_040",
      name: "Helven Industries Coaching Pilot",
      company: "Helven Industries GmbH",
      stage: "demo",
      amount: 64000,
      ownerName: "Klaus Brandt",
      lastActivity: "2026-05-06",
    },
    calls: [
      {
        id: "eval_040_call_1",
        title: "Delegation ambiguity",
        duration_seconds: 1680,
        recorded_at: "2026-05-05",
        transcript_segments: [
          {
            speaker_role: "champion",
            content:
              "Ich gebe das Thema erstmal an Jonas aus meinem Team. Er sammelt die offenen Punkte. Ich selbst bin die naechsten Wochen eher raus, weil ich den neuen Segmentplan uebernehme.",
          },
          {
            speaker_role: "buyer",
            content:
              "Jonas kann viel vorbereiten, aber Budget und Priorisierung liegen weiter bei Petra. Wenn Petra nicht mehr aktiv ist, wird es schwer, das Thema oben zu halten.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 45,
      scoreRangeMax: 59,
      requiredSignals: ["CHAMPION_DISENGAGEMENT"],
    },
  },
  {
    id: "eval_041",
    description: "Six stakeholder committee with two stakeholders leaving",
    category: "high",
    deal: {
      id: "eval_041",
      name: "KaiserTech Enterprise Coaching",
      company: "KaiserTech GmbH",
      stage: "proposal_sent",
      amount: 118000,
      ownerName: "Rebecca Davis",
      lastActivity: "2026-05-03",
    },
    calls: [
      {
        id: "eval_041_call_1",
        title: "Stakeholder committee churn",
        duration_seconds: 3000,
        recorded_at: "2026-05-02",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "We had six people in the buying group: Sales Ops, RevOps, Legal, Procurement, Finance, and IT. Since last week, Lisa from Procurement moved to another company and Daniel from IT is transferring to the cloud team.",
          },
          {
            speaker_role: "champion",
            content:
              "That means two people who understood the Findr workflow are gone. The replacements have not seen the demo, and Legal does not want to continue until IT confirms the architecture again.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "I still like the idea, but we should assume a reset of at least three weeks. Bitte plant nicht mit Unterschrift im Mai.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "high",
      scoreRangeMin: 64,
      scoreRangeMax: 78,
      // ENGAGEMENT_DROP removed: the transcript shows an organizational reset (people leaving, Legal pausing), not falling engagement — the decision-maker still likes the deal. The signal overlapped with stakeholder churn and was not independently present.
      requiredSignals: ["STAKEHOLDER_CHURN"],
    },
  },
  {
    id: "eval_042",
    description: "Sales rep has only champion access despite CFO legal procurement blockers",
    category: "medium",
    deal: {
      id: "eval_042",
      name: "DACH Logistics Manager AI",
      company: "DACH Logistics AG",
      stage: "demo",
      amount: 99000,
      ownerName: "Hans Mueller",
      lastActivity: "2026-05-07",
    },
    calls: [
      {
        id: "eval_042_call_1",
        title: "Champion-only access",
        duration_seconds: 1920,
        recorded_at: "2026-05-06",
        transcript_segments: [
          {
            speaker_role: "ae",
            content:
              "Can we bring CFO, Legal, and Procurement into the next call so we do not discover blockers late?",
          },
          {
            speaker_role: "champion",
            content:
              "Noch nicht. Ich will das erstmal intern vorfiltern. CFO und Legal sind sehr kritisch bei neuen Tools, und Procurement spricht ungern mit Vendors, bevor ich ein internes Go habe.",
          },
          {
            speaker_role: "buyer",
            content:
              "Das ist bei uns normal, aber ja, wenn die drei spaet einsteigen, koennen sie einiges neu aufmachen.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 45,
      scoreRangeMax: 59,
      requiredSignals: ["LATE_DECISION_MAKER"],
    },
  },
  {
    id: "eval_043",
    description: "Five stakeholders with engagement drop among two important owners",
    category: "medium",
    deal: {
      id: "eval_043",
      name: "SaaSCo Coaching Analytics",
      company: "SaaSCo Holdings",
      stage: "negotiation",
      amount: 132000,
      ownerName: "Marcus Thompson",
      lastActivity: "2026-05-06",
    },
    calls: [
      {
        id: "eval_043_call_1",
        title: "Stakeholder engagement check",
        duration_seconds: 2460,
        recorded_at: "2026-05-05",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Product and RevOps are still engaged, but Finance and Enablement stopped joining the weekly calls. Finance has not answered the ROI thread since last Thursday.",
          },
          {
            speaker_role: "champion",
            content:
              "I can pull them back in. It is not dead, but attendance dropped from five stakeholders to three, and the enablement owner is distracted by QBR prep.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 42,
      scoreRangeMax: 58,
      requiredSignals: ["ENGAGEMENT_DROP"],
    },
  },
  {
    id: "eval_044",
    description: "Seven stakeholder group aligned with clear decision path",
    category: "low",
    deal: {
      id: "eval_044",
      name: "AlpenBank Multi-Region Rollout",
      company: "AlpenBank AG",
      stage: "verbal_commit",
      amount: 188000,
      ownerName: "Sarah Mueller",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_044_call_1",
        title: "Seven stakeholder alignment",
        duration_seconds: 2760,
        recorded_at: "2026-05-09",
        transcript_segments: [
          {
            speaker_role: "decision_maker",
            content:
              "We have seven stakeholders here because this is a regulated rollout, not because the decision is unclear. Finance approved the amount, Legal approved the DPA, IT approved SSO, Sales Ops owns admin, and the regional managers own adoption.",
          },
          {
            speaker_role: "champion",
            content:
              "Decision path is simple: security sign-off today, procurement order form Monday, signature Wednesday. I will send the owner list after the call.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 5,
      scoreRangeMax: 30,
      requiredSignals: [],
      forbiddenSignals: ALL_SIGNALS,
    },
  },
  {
    id: "eval_045",
    description: "New procurement lead enters late and demands compliance review",
    category: "medium",
    deal: {
      id: "eval_045",
      name: "Nordbank Sales Intelligence",
      company: "Nordbank GmbH",
      stage: "proposal_sent",
      amount: 149000,
      ownerName: "Sarah Mueller",
      lastActivity: "2026-05-05",
    },
    calls: [
      {
        id: "eval_045_call_1",
        title: "Late procurement compliance review",
        duration_seconds: 2100,
        recorded_at: "2026-05-04",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Small change: Procurement has a new lead, Birgit. She was not part of the process and now wants a compliance review before she accepts the order form.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "I do not think this kills the deal, but it adds a formal checkpoint. Birgit can approve vendors, and if she dislikes the data retention language, she can send us back to Legal.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 48,
      // Level-consistent band: medium tops out at 59 (>=60 maps to high). This is
      // a single, late compliance gate the decision-maker explicitly calls
      // non-fatal ("adds a formal checkpoint") — one materialized
      // LATE_DECISION_MAKER, so medium is the honest call. The previous 48-63 band
      // crossed the 60 level boundary, making the case unpassable by definition.
      scoreRangeMax: 59,
      requiredSignals: ["LATE_DECISION_MAKER"],
    },
  },
  {
    id: "eval_046",
    description: "FinTech regulatory review becomes commercial friction",
    category: "medium",
    deal: {
      id: "eval_046",
      name: "MainPay FinTech Risk Signals",
      company: "MainPay GmbH",
      stage: "demo",
      amount: 87000,
      ownerName: "Nadine Keller",
      lastActivity: "2026-05-06",
    },
    calls: [
      {
        id: "eval_046_call_1",
        title: "BaFin MiFID review",
        duration_seconds: 2340,
        recorded_at: "2026-05-05",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "BaFin and MiFID are not excuses; every vendor goes through that. The concern is that if the compliance team requires additional retention controls, we may need a smaller pilot or a lower first-year amount.",
          },
          {
            speaker_role: "champion",
            content:
              "I can still drive it, but the compliance review changes the business case. We should not promise the full rollout until the regulator-facing documentation is accepted.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 44,
      scoreRangeMax: 58,
      requiredSignals: ["BUDGET_FRICTION"],
    },
  },
  {
    id: "eval_047",
    description: "HR tech works council approval is normal DACH process",
    category: "low",
    deal: {
      id: "eval_047",
      name: "PeoplePulse HR Coaching",
      company: "PeoplePulse GmbH",
      stage: "proposal_sent",
      amount: 52000,
      ownerName: "Laura Stein",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_047_call_1",
        title: "Betriebsrat approval path",
        duration_seconds: 1860,
        recorded_at: "2026-05-09",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Wir muessen das mit dem Betriebsrat klaeren, aber das ist bei HR-Tech immer Standard. Der Termin ist schon fuer Dienstag gesetzt, und wir haben die Datenschutzunterlagen vorbereitet.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Budget und Projektziel sind freigegeben. Betriebsrat ist ein Prozessschritt, kein Zweifel an Findr.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 8,
      scoreRangeMax: 34,
      requiredSignals: [],
      forbiddenSignals: ["STALLING_PATTERN", "BUDGET_FRICTION"],
    },
  },
  {
    id: "eval_048",
    description: "Industrial software long sales cycle has legitimate budget gate",
    category: "medium",
    deal: {
      id: "eval_048",
      name: "RheinWerk Plant Sales OS",
      company: "RheinWerk Maschinenbau",
      stage: "qualified",
      amount: 135000,
      ownerName: "Petra Hoffmann",
      lastActivity: "2026-05-07",
    },
    calls: [
      {
        id: "eval_048_call_1",
        title: "Industrial annual planning",
        duration_seconds: 2640,
        recorded_at: "2026-05-06",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Bei uns sind 12 Monate Sales Cycle normal, vor allem bei Werkssoftware. Das ist kein Stalling. Der echte Punkt ist, dass CapEx erst im September Committee freigegeben wird.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Wenn wir es als OpEx Pilot unter 50k starten, geht es schneller. Fuer den vollen Rollout muessen wir in die Jahresplanung.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 42,
      scoreRangeMax: 58,
      requiredSignals: ["BUDGET_FRICTION"],
      forbiddenSignals: ["STALLING_PATTERN"],
    },
  },
  {
    id: "eval_049",
    description: "Mittelstand CEO approval is normal but discount pressure emerges",
    category: "medium",
    deal: {
      id: "eval_049",
      name: "Bergmann Mittelstand Revenue AI",
      company: "Bergmann Systeme GmbH",
      stage: "negotiation",
      amount: 68000,
      ownerName: "Felix Roth",
      lastActivity: "2026-05-08",
    },
    calls: [
      {
        id: "eval_049_call_1",
        title: "CEO approval and pricing",
        duration_seconds: 1980,
        recorded_at: "2026-05-07",
        transcript_segments: [
          {
            speaker_role: "buyer",
            content:
              "Unser CEO schaut jeden Deal ueber 50k an. Das ist bei uns normal und er war von Anfang an informiert, also bitte nicht als spaeten Entscheider interpretieren.",
          },
          {
            speaker_role: "decision_maker",
            content:
              "Ich bin grundsaetzlich dafuer, aber bei 68k brauche ich entweder einen klaren Pilotpreis oder eine Stufenlogik. Sonst wird es fuer den Mittelstandsetat eng.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "medium",
      scoreRangeMin: 42,
      scoreRangeMax: 58,
      requiredSignals: ["BUDGET_FRICTION"],
      forbiddenSignals: ["LATE_DECISION_MAKER"],
    },
  },
  {
    id: "eval_050",
    description: "Banking tech multi-year rollout pause without engagement drop",
    category: "low",
    deal: {
      id: "eval_050",
      name: "Nordbank Multi-Year Rollout",
      company: "Nordbank GmbH",
      stage: "verbal_commit",
      amount: 240000,
      ownerName: "Sarah Mueller",
      lastActivity: "2026-05-10",
    },
    calls: [
      {
        id: "eval_050_call_1",
        title: "Multi-year banking rollout",
        duration_seconds: 2220,
        recorded_at: "2026-05-09",
        transcript_segments: [
          {
            speaker_role: "decision_maker",
            content:
              "The rollout pause between phase one and phase two is intentional. Banking deployments run in waves because we need audit evidence after each country. This is not reduced engagement; it is our governance model.",
          },
          {
            speaker_role: "champion",
            content:
              "We will still meet every second Tuesday, and I will send adoption metrics after each wave. Budget is committed for the multi-year agreement.",
          },
        ],
      },
    ],
    expected: {
      riskLevel: "low",
      scoreRangeMin: 5,
      scoreRangeMax: 30,
      requiredSignals: [],
      forbiddenSignals: ["ENGAGEMENT_DROP", "STALLING_PATTERN"],
    },
  },
];
