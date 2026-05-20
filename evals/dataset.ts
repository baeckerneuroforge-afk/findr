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
      requiredSignals: ["LATE_DECISION_MAKER", "STALLING_PATTERN"],
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
];
