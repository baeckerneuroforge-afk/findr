import type {
  InterviewTurn,
  ResearchInput,
} from "@/lib/voice-agent/interviewer";
import type { ResearchPlanUseCase } from "@/lib/research/db";

export type EngineProbingGroup =
  | "universal"
  | "general_survey"
  | "brand_research"
  | "creative_test"
  | "concept_test"
  | "negative_control";

export interface ForbiddenPattern {
  label: string;
  pattern: string;
  flags?: string;
}

export type ExpectedAction = "probe" | "move_on_or_close" | "close";

export interface EngineProbingEvalCase {
  id: string;
  group: EngineProbingGroup;
  description: string;
  input: ResearchInput;
  history: InterviewTurn[];
  expected: {
    /** probe = ask into current topic; move_on_or_close = don't keep drilling current topic; close = done=true. */
    action?: ExpectedAction;
    behavior: string;
    should: string[];
    avoid: string[];
    requiredPatterns?: ForbiddenPattern[];
    forbiddenPatterns?: ForbiddenPattern[];
  };
}

function input(
  useCase: ResearchPlanUseCase | null,
  topic: string,
  intent: string,
  objective = "Wir möchten verstehen, wie Menschen in ihrem Arbeitsalltag Entscheidungen treffen und Reibung erleben.",
): ResearchInput {
  return {
    plan: {
      title: "Engine Probing Eval",
      objective,
      persona: "B2B-Nutzerinnen und Nutzer in DACH",
      useCase,
      topics: [{ topic, intent }],
    },
    brand: null,
  };
}

function multiTopicInput(
  useCase: ResearchPlanUseCase | null,
  topics: Array<{ topic: string; intent: string }>,
  objective = "Wir möchten verstehen, wie Menschen in ihrem Arbeitsalltag Entscheidungen treffen und Reibung erleben.",
): ResearchInput {
  return {
    plan: {
      title: "Engine Probing Eval",
      objective,
      persona: "B2B-Nutzerinnen und Nutzer in DACH",
      useCase,
      topics,
    },
    brand: null,
  };
}

const OPENING_CONTEXT =
  "Ich bin eine KI-Research-Assistentin und führe ein vertrauliches Gespräch; es gibt keine richtigen oder falschen Antworten.";

function turns(agentQuestion: string, participantAnswer: string): InterviewTurn[] {
  return [
    { role: "agent", text: `${OPENING_CONTEXT}\n\n${agentQuestion}` },
    { role: "customer", text: participantAnswer },
  ];
}

const HYPOTHETICALS: ForbiddenPattern = {
  label: "keine hypothetische Würden-/Wäre-Frage",
  pattern: "\\b(würden|wuerden|würde|wuerde|wäre|waere|könnten sie sich vorstellen|koennten sie sich vorstellen)\\b",
  flags: "i",
};

const PURCHASE_INTENT: ForbiddenPattern = {
  label: "keine Kaufabsichtsfrage als nächster Schritt",
  pattern: "\\b(kaufen|kaufabsicht|abschließen|abschliessen|würden sie.*nutzen|wuerden sie.*nutzen)\\b",
  flags: "i",
};

const PAST_BEHAVIOR: ForbiddenPattern = {
  label: "kein Vergangenheitsverhalten bei Markenwahrnehmung",
  pattern: "\\b(letzte[ns]? mal|konkrete situation|was ist da passiert|was haben sie getan|workaround)\\b",
  flags: "i",
};

const SUGGESTIVE_REASON: ForbiddenPattern = {
  label: "keine untergeschobene Erklärung",
  pattern: "\\b(liegt es daran|meinen sie damit, dass|also war|also ist|vermutlich|wahrscheinlich|weil es)\\b",
  flags: "i",
};

const CURRENT_TOPIC_DRILL: ForbiddenPattern = {
  label: "kein weiteres Bohren im erschöpften aktuellen Thema",
  pattern:
    "\\b(nochmal|mehr darüber|mehr darueber|konkretes beispiel|letzte[ns]? mal|was ist da passiert|woran machen sie|erzählen sie.*mehr|erzaehlen sie.*mehr)\\b",
  flags: "i",
};

export const ENGINE_PROBING_EVAL_CASES: EngineProbingEvalCase[] = [
  {
    id: "ep_01_vague_needs_example",
    group: "universal",
    description: "Vage Aussage muss konkretisiert werden, kein Themenwechsel.",
    input: input(
      null,
      "Reporting im Alltag",
      "Verstehen, wo Reporting-Prozesse unklar oder belastend sind.",
    ),
    history: turns(
      "Wie erleben Sie Reporting in Ihrem Arbeitsalltag?",
      "Das ist oft einfach nervig und unübersichtlich.",
    ),
    expected: {
      behavior:
        "Nach einem konkreten Beispiel oder der letzten Situation fragen, in der es nervig/unübersichtlich war.",
      should: [
        "an die Wörter 'nervig' oder 'unübersichtlich' anschließen",
        "eine konkrete Situation, ein Beispiel oder das letzte Auftreten erfragen",
        "neutral und offen bleiben",
      ],
      avoid: [
        "zu einem neuen Thema wechseln",
        "Details erfinden, was genau nervig war",
        "mit 'Warum' starten",
      ],
    },
  },
  {
    id: "ep_02_surface_laddering",
    group: "universal",
    description: "Oberflächliche erste Antwort braucht Laddering in den Ablauf.",
    input: input(
      null,
      "Aktuelle Arbeitsweisen",
      "Verstehen, wie Teams heute mit manuellen Übergaben umgehen.",
    ),
    history: turns(
      "Wie lösen Sie solche Übergaben heute?",
      "Ach, meistens halt irgendwie in Excel und Slack, das passt schon.",
    ),
    expected: {
      behavior:
        "Auf Excel/Slack aufbauen und den letzten konkreten Ablauf oder die Reibung darin erfragen.",
      should: [
        "auf die genannte aktuelle Lösung Excel/Slack Bezug nehmen",
        "tiefer in Ablauf, Aufwand oder letztes Beispiel gehen",
        "nicht bei 'passt schon' stehenbleiben",
      ],
      avoid: [
        "fragen, ob ein neues Tool helfen würde",
        "eine Feature-Lösung anbieten",
        "mehrere Fragen auf einmal stellen",
      ],
      forbiddenPatterns: [HYPOTHETICALS],
    },
  },
  {
    id: "ep_03_emotional_signal",
    group: "universal",
    description: "Emotionale Frustration behutsam aufgreifen.",
    input: input(
      null,
      "Frustmomente",
      "Verstehen, welche Momente im Prozess emotional stark auffallen.",
    ),
    history: turns(
      "Gab es in letzter Zeit einen Moment, der besonders hängen geblieben ist?",
      "Da könnte ich jedes Mal ausrasten, wenn die Freigabe wieder irgendwo hängt.",
    ),
    expected: {
      behavior:
        "Die Frustration aufgreifen und nach der konkreten Freigabe-Situation oder dem letzten Ablauf fragen.",
      should: [
        "behutsam auf die starke Emotion eingehen",
        "nach einer konkreten Situation oder dem letzten Mal fragen",
        "keine Schuld oder Ursache unterstellen",
      ],
      avoid: [
        "die Emotion wegmoderieren",
        "eine Ursache vorgeben",
        "direkt nach einer Lösungsidee fragen",
      ],
      forbiddenPatterns: [SUGGESTIVE_REASON],
    },
  },
  {
    id: "ep_04_hesitant_signal",
    group: "universal",
    description: "Zögernde Sprache soll vorsichtig geklärt werden.",
    input: input(
      null,
      "Entscheidungsgefühl",
      "Verstehen, welche Signale Vertrauen oder Unsicherheit erzeugen.",
    ),
    history: turns(
      "Wie hat sich die Entscheidung für Sie angefühlt?",
      "Vielleicht ist das eher ein Bauchgefühl, ich weiß nicht so recht.",
    ),
    expected: {
      behavior:
        "Das Zögern aufgreifen und offen klären, was zu diesem Bauchgefühl beiträgt.",
      should: [
        "die Unsicherheit nicht pathologisieren",
        "nach dem gemeinten Eindruck oder konkreten Anhaltspunkten fragen",
        "kurz und offen bleiben",
      ],
      avoid: [
        "eine Interpretation des Bauchgefühls erfinden",
        "konfrontativ nach 'Warum' fragen",
        "Antwortoptionen anbieten",
      ],
      forbiddenPatterns: [SUGGESTIVE_REASON],
    },
  },
  {
    id: "ep_05_open_before_specific",
    group: "universal",
    description: "Vor enger Nachschärfung offen Raum lassen.",
    input: input(
      null,
      "Auswahlkriterien",
      "Verstehen, welche Kriterien in der Auswahl tatsächlich wichtig sind.",
    ),
    history: turns(
      "Was war Ihnen bei der Auswahl besonders wichtig?",
      "Geschwindigkeit war auf jeden Fall ein Thema.",
    ),
    expected: {
      behavior:
        "Offen nach weiterer Bedeutung, konkreter Ausprägung oder einem Beispiel zu Geschwindigkeit fragen, ohne sofort eine Metrik vorzugeben.",
      should: [
        "auf Geschwindigkeit Bezug nehmen",
        "offen bleiben, bevor eine enge Kennzahl abgefragt wird",
        "keine Antwortoptionen vorgeben",
      ],
      avoid: [
        "Latenz, Ladezeit oder Performance-Metriken erfinden",
        "Suggestivfrage stellen",
        "mehrere Kriterien zur Auswahl anbieten",
      ],
      forbiddenPatterns: [SUGGESTIVE_REASON],
    },
  },
  {
    id: "ep_06_general_survey_hypothesis_trap",
    group: "general_survey",
    description:
      "General Survey: hypothetische Nutzungszusage ist kein Signal; echte Vergangenheit erfragen.",
    input: input(
      "general_survey",
      "Problemhäufigkeit und heutige Lösung",
      "Verstehen, ob das Problem im echten Arbeitsalltag relevant ist.",
    ),
    history: turns(
      "Wie relevant ist dieses Problem aktuell für Sie?",
      "Ja, wahrscheinlich würden wir so etwas schon nutzen, wenn es gut gemacht ist.",
    ),
    expected: {
      behavior:
        "Die hypothetische Aussage zurück auf tatsächliches Verhalten drehen: letztes Auftreten, aktuelle Lösung oder Aufwand.",
      should: [
        "nach dem letzten konkreten Problemfall fragen",
        "aktuelle Workarounds oder Aufwand erfragen",
        "hypothetische Nutzung nicht als Signal behandeln",
      ],
      avoid: [
        "weiter nach zukünftiger Nutzung fragen",
        "Kauf- oder Nutzungsabsicht abfragen",
        "Kompliment/Interesse als Validierung nehmen",
      ],
      forbiddenPatterns: [HYPOTHETICALS, PURCHASE_INTENT],
    },
  },
  {
    id: "ep_07_general_survey_compliment_trap",
    group: "general_survey",
    description:
      "General Survey: Kompliment ignorieren, nach Verhalten/Commitment suchen.",
    input: input(
      "general_survey",
      "Bedarf und Workarounds",
      "Herausfinden, ob ein echter Bedarf hinter positiven Reaktionen steht.",
    ),
    history: turns(
      "Was halten Sie grundsätzlich von der Idee?",
      "Das klingt spannend, bestimmt hilfreich. Gute Idee eigentlich.",
    ),
    expected: {
      behavior:
        "Nicht das Kompliment vertiefen, sondern nach konkreter Vergangenheit, heutiger Lösung oder bereits investiertem Aufwand fragen.",
      should: [
        "Kompliment nicht als Signal behandeln",
        "konkrete vergangene Situation oder aktuelles Verhalten erfragen",
        "nach Workaround, Zeit, Geld oder Frust fragen",
      ],
      avoid: [
        "fragen, ob sie es kaufen oder nutzen würden",
        "sich für das Lob bedanken und weiter validieren",
        "hypothetische Features diskutieren",
      ],
      forbiddenPatterns: [HYPOTHETICALS, PURCHASE_INTENT],
    },
  },
  {
    id: "ep_08_brand_association",
    group: "brand_research",
    description:
      "Brand Research: Assoziation/Wahrnehmung vertiefen, nicht Problemvergangenheit.",
    input: input(
      "brand_research",
      "Markenwahrnehmung",
      "Verstehen, welche spontanen Assoziationen und Gefühle die Marke auslöst.",
    ),
    history: turns(
      "Welche Worte oder Bilder kommen Ihnen spontan bei der Marke in den Kopf?",
      "Die Marke wirkt irgendwie erwachsen, aber auch ein bisschen distanziert.",
    ),
    expected: {
      behavior:
        "Die Assoziationen 'erwachsen' und 'distanziert' klären oder nach Bildern/Gefühlen/Vergleichsmarken fragen.",
      should: [
        "spontane Wahrnehmung, Gefühle oder Bilder vertiefen",
        "die genannten Begriffe klären",
        "optional nach Vergleich mit Alternativen fragen",
      ],
      avoid: [
        "nach der letzten Nutzungssituation fragen",
        "auf Pain Points oder Workarounds wechseln",
        "eine Markeninterpretation vorgeben",
      ],
      forbiddenPatterns: [PAST_BEHAVIOR, SUGGESTIVE_REASON],
    },
  },
  {
    id: "ep_09_brand_comparison",
    group: "brand_research",
    description:
      "Brand Research: Differenzierung gegenüber Alternative herausarbeiten.",
    input: input(
      "brand_research",
      "Differenzierung",
      "Verstehen, wodurch sich die Marke in der Wahrnehmung von Alternativen unterscheidet.",
    ),
    history: turns(
      "Wenn Sie die Marke mit Alternativen vergleichen: Was fällt Ihnen auf?",
      "Im Vergleich zu Notion fühlt es sich seriöser an, aber weniger leicht.",
    ),
    expected: {
      behavior:
        "Den Wahrnehmungsunterschied seriöser/weniger leicht vertiefen, ohne in Nutzungsverhalten abzudriften.",
      should: [
        "auf den Vergleich mit Notion Bezug nehmen",
        "Differenzierung oder emotionale Wirkung klären",
        "neutral nach Bedeutung der genannten Wörter fragen",
      ],
      avoid: [
        "nach dem letzten konkreten Nutzungsfall fragen",
        "fragen, welches Tool sie kaufen würden",
        "die Alternative schlechtreden",
      ],
      forbiddenPatterns: [PAST_BEHAVIOR, PURCHASE_INTENT],
    },
  },
  {
    id: "ep_10_creative_test_asset_clarity",
    group: "creative_test",
    description:
      "Creative Test: erster Eindruck und unklare Botschaft am Asset vertiefen.",
    input: input(
      "creative_test",
      "Reaktion auf Kampagnenmotiv",
      "Verstehen, wie das gezeigte Motiv spontan wirkt und ob die Botschaft klar ist.",
    ),
    history: turns(
      "Was ist Ihr erster spontaner Eindruck von dem Motiv?",
      "Es sieht hochwertig aus, aber die Botschaft habe ich nicht sofort verstanden.",
    ),
    expected: {
      behavior:
        "Auf hochwertigen Eindruck und unklare Botschaft eingehen: was auffällt, was unklar bleibt oder welches Element wirkt.",
      should: [
        "sich klar auf das gezeigte Asset/Motiv beziehen",
        "Botschaftsklarheit oder auffällige Elemente erfragen",
        "emotionale/visuelle Reaktion vertiefen",
      ],
      avoid: [
        "allgemein über Produktbedarf sprechen",
        "Kaufabsicht erfragen",
        "unterstellen, welche Botschaft gemeint war",
      ],
      forbiddenPatterns: [PURCHASE_INTENT, SUGGESTIVE_REASON],
    },
  },
  {
    id: "ep_11_concept_understanding_first",
    group: "concept_test",
    description:
      "Concept Test: erst Verständnis in eigenen Worten prüfen, nicht Kaufabsicht.",
    input: input(
      "concept_test",
      "Konzeptverständnis",
      "Verstehen, ob das Konzept verständlich ist und welchen Nutzen Teilnehmer wahrnehmen.",
    ),
    history: turns(
      "Was kommt bei dem Konzept für Sie an?",
      "Ich glaube, es geht um automatische Interview-Auswertung, aber ich bin mir nicht sicher.",
    ),
    expected: {
      behavior:
        "Zuerst Verständnis/Unklarheit klären, idealerweise in eigenen Worten, bevor Relevanz oder Kaufabsicht kommt.",
      should: [
        "Verständnis und Unsicherheit aufgreifen",
        "nach der eigenen Wiedergabe oder dem unklaren Teil fragen",
        "noch nicht auf Nutzen oder Kauf springen",
      ],
      avoid: [
        "fragen, ob sie das kaufen würden",
        "das Konzept für den Teilnehmer erklären",
        "Relevanz bewerten lassen, bevor Verständnis klar ist",
      ],
      forbiddenPatterns: [PURCHASE_INTENT, HYPOTHETICALS],
    },
  },
  {
    id: "ep_12_negative_why_suggestive",
    group: "negative_control",
    description:
      "Negativ-Kontrolle: kein 'Warum' und keine Suggestiv-Erklärung.",
    input: input(
      null,
      "Einstieg in das Gespräch",
      "Verstehen, wie der Einstieg in ein Angebot oder Asset wahrgenommen wird.",
    ),
    history: turns(
      "Wie war Ihr erster Eindruck vom Einstieg?",
      "Ich fand den Einstieg etwas komisch.",
    ),
    expected: {
      behavior:
        "Neutral klären, was mit 'komisch' gemeint ist oder welches konkrete Element diesen Eindruck ausgelöst hat.",
      should: [
        "das Wort 'komisch' klären",
        "neutral nach Eindruck, Element oder Beispiel fragen",
        "kurz bleiben",
      ],
      avoid: [
        "mit 'Warum'/'Wieso' starten",
        "unterstellen, dass Ton, Länge oder Design der Grund war",
        "Antwortoptionen vorgeben",
      ],
      forbiddenPatterns: [SUGGESTIVE_REASON],
    },
  },
  {
    id: "ep_13_evasive_answer",
    group: "universal",
    description:
      "Ausweichende Antwort: neutral konkretisieren, nicht lenken oder akzeptieren.",
    input: input(
      null,
      "Entscheidungsprozess",
      "Verstehen, wie Entscheidungen im Team tatsächlich ablaufen.",
    ),
    history: turns(
      "Wie läuft so eine Entscheidung bei Ihnen konkret ab?",
      "Das ist schwer zu sagen, bei uns ist jeder Fall anders und hängt von vielen Dingen ab.",
    ),
    expected: {
      action: "probe",
      behavior:
        "Die Ausweichbewegung neutral auffangen und nach einem konkreten letzten Entscheidungsfall fragen.",
      should: [
        "die Ausweichantwort nicht als Signal abhaken",
        "nach einem konkreten Fall oder letzten Auftreten fragen",
        "keine Ursache oder Prozessstruktur vorgeben",
      ],
      avoid: [
        "Antwortoptionen wie Budget/Management/IT anbieten",
        "auf ein neues Thema springen",
        "die Aussage als ausreichend covered behandeln",
      ],
      forbiddenPatterns: [SUGGESTIVE_REASON],
    },
  },
  {
    id: "ep_14_mom_test_social_desirable",
    group: "general_survey",
    description:
      "Mom-Test-Falle: sozial erwünschtes Lob und Nutzungsabsicht zählen nicht.",
    input: input(
      "general_survey",
      "Bedarf und heutiges Verhalten",
      "Validieren, ob hinter positivem Feedback echtes Verhalten und Aufwand stehen.",
    ),
    history: turns(
      "Was wäre Ihr erster Eindruck von so einer Lösung?",
      "Klingt super, ehrlich. Das würden wir bestimmt nutzen, wenn es verfügbar wäre.",
    ),
    expected: {
      action: "probe",
      behavior:
        "Lob und hypothetische Nutzung nicht validieren; nach aktueller Lösung, letztem Fall oder Commitment fragen.",
      should: [
        "hypothetische Nutzungsabsicht ignorieren",
        "auf vergangenes Verhalten oder aktuellen Workaround drehen",
        "nach Aufwand, Zeit, Geld, Frust oder Commitment suchen",
      ],
      avoid: [
        "fragen, ob sie es kaufen würden",
        "Lob bestätigen oder als Signal behandeln",
        "Feature- oder Produktdiskussion starten",
      ],
      forbiddenPatterns: [HYPOTHETICALS, PURCHASE_INTENT],
    },
  },
  {
    id: "ep_15_verbose_empty_move_on",
    group: "universal",
    description:
      "Verbose-aber-leer nach Probe: Thema erschöpft, nicht weiterbohren.",
    input: multiTopicInput(null, [
      {
        topic: "Auswahlkriterien",
        intent: "Verstehen, welche Kriterien bei der Tool-Auswahl wirklich zählen.",
      },
      {
        topic: "Team-Routine",
        intent: "Verstehen, wie das Team Entscheidungen im Alltag operationalisiert.",
      },
    ]),
    history: [
      {
        role: "agent",
        text: `${OPENING_CONTEXT}\n\nWas war Ihnen bei der Auswahl besonders wichtig?`,
      },
      {
        role: "customer",
        text: "Geschwindigkeit ist natürlich wichtig, aber das ist bei uns immer ein Zusammenspiel aus ganz vielen Faktoren.",
      },
      {
        role: "agent",
        text: "Woran haben Sie Geschwindigkeit in der letzten Auswahl konkret festgemacht?",
      },
      {
        role: "customer",
        text: "Also grundsätzlich ist Geschwindigkeit schon ein Thema, weil man ja nicht ewig warten will. Es muss sich einfach schnell anfühlen, ohne dass ich da jetzt eine konkrete Situation nennen könnte.",
      },
    ],
    expected: {
      action: "move_on_or_close",
      behavior:
        "Nicht weiter in Geschwindigkeit bohren; die Antwort wiederholt nur allgemein und gibt keinen neuen Punkt. Zum nächsten Plan-Topic wechseln oder schließen.",
      should: [
        "verbose Wiederholung als erschöpft erkennen",
        "nicht noch ein drittes Mal in Geschwindigkeit bohren",
        "zum Topic Team-Routine wechseln oder kurz schließen",
      ],
      avoid: [
        "noch ein Beispiel zu Geschwindigkeit verlangen",
        "eine weitere Metrik oder Ursache nachschieben",
        "die vage Antwort durch eigene Details auffüllen",
      ],
      requiredPatterns: [
        {
          label: "wenn nicht closing, muss die nächste Nachricht vom erschöpften Thema wegführen",
          pattern: "\\b(team|routine|alltag|entscheidung|weiter)\\b",
          flags: "i",
        },
      ],
      forbiddenPatterns: [
        {
          label: "nicht weiter in Geschwindigkeit bohren",
          pattern:
            "\\b(geschwindigkeit|schnell|warten|konkrete situation|konkretes beispiel)\\b",
          flags: "i",
        },
      ],
    },
  },
  {
    id: "ep_16_abstract_ambiguous",
    group: "universal",
    description:
      "Mehrdeutige abstrakte Aussage: Bedeutung klären, kein Themensprung.",
    input: input(
      null,
      "Eindruck und Sprache",
      "Verstehen, welche Bedeutungen Teilnehmer mit abstrakten Eindrücken verbinden.",
    ),
    history: turns(
      "Wie wirkt die Beschreibung auf Sie?",
      "Sie ist irgendwie enterprise-y, aber nicht im guten Sinn.",
    ),
    expected: {
      action: "probe",
      behavior:
        "Den abstrakten Begriff 'enterprise-y' oder 'nicht im guten Sinn' klären, ohne selbst eine Bedeutung zu erfinden.",
      should: [
        "an den abstrakten Ausdruck anschließen",
        "nach Bedeutung oder konkretem Eindruck fragen",
        "neutral bleiben",
      ],
      avoid: [
        "unterstellen, es gehe um teuer, langsam oder Konzernsprache",
        "auf ein anderes Thema wechseln",
        "Antwortoptionen anbieten",
      ],
      forbiddenPatterns: [
        SUGGESTIVE_REASON,
        {
          label: "keine erfundene Deutung von enterprise-y",
          pattern: "\\b(teuer|langsam|konzern|bürokratisch|buerokratisch)\\b",
          flags: "i",
        },
      ],
    },
  },
  {
    id: "ep_17_saturation_close_after_covered",
    group: "universal",
    description:
      "Saturation: einziges Topic ist konkret + vertieft, richtige Aktion ist abschließen.",
    input: input(
      null,
      "Onboarding-Reibung",
      "Verstehen, wo Onboarding im Alltag konkret hakt.",
    ),
    history: [
      {
        role: "agent",
        text: `${OPENING_CONTEXT}\n\nErzählen Sie mir vom letzten Mal, als Onboarding für Sie schwierig war.`,
      },
      {
        role: "customer",
        text: "Letzten Dienstag wollte ich einen neuen Kollegen einrichten. Ich musste drei Systeme öffnen, die Rechte manuell setzen und habe am Ende den IT-Admin per Slack geholt.",
      },
      {
        role: "agent",
        text: "Was war an diesem Ablauf für Sie der schwierigste Moment?",
      },
      {
        role: "customer",
        text: "Der Rechte-Teil, weil ich nicht wusste, welche Rolle passt. Das hat etwa 30 Minuten gekostet.",
      },
    ],
    expected: {
      action: "close",
      behavior:
        "Nicht weiterbohren: Das einzige Topic hat konkrete Situation, Workaround und Aufwand plus eine Vertiefung geliefert. Kurz abschließen.",
      should: [
        "done=true setzen",
        "warm und kurz schließen",
        "keine weitere Onboarding-Frage stellen",
      ],
      avoid: [
        "dritte Frage in dasselbe Topic stellen",
        "nach noch einem Beispiel fragen",
        "neues off-plan Thema eröffnen",
      ],
      forbiddenPatterns: [CURRENT_TOPIC_DRILL],
    },
  },
  {
    id: "ep_18_saturation_no_signal_move_on",
    group: "universal",
    description:
      "Saturation: Teilnehmer signalisiert einmal keinen konkreten Punkt, also wechseln.",
    input: multiTopicInput(null, [
      {
        topic: "Frustmomente",
        intent: "Verstehen, ob es konkrete Friktion im aktuellen Prozess gibt.",
      },
      {
        topic: "Entscheidungsroutine",
        intent: "Verstehen, wie Entscheidungen im Team angestoßen werden.",
      },
    ]),
    history: turns(
      "Gab es zuletzt einen Frustmoment in diesem Prozess?",
      "Nein, nichts Konkretes. War eigentlich alles fine.",
    ),
    expected: {
      action: "move_on_or_close",
      behavior:
        "Das No-Signal akzeptieren und zum nächsten Plan-Topic wechseln oder schließen; nicht ein zweites Mal nach Frust bohren.",
      should: [
        "absence/no-signal als probed-no-signal behandeln",
        "zum nächsten Topic Entscheidungsroutine wechseln oder schließen",
        "keinen Druck machen",
      ],
      avoid: [
        "nochmals nach Frust, Problemen oder Beispielen fragen",
        "unterstellen, es müsse doch etwas geben",
        "Suggestivfrage stellen",
      ],
      requiredPatterns: [
        {
          label: "wenn nicht closing, muss die nächste Nachricht zum nächsten Topic führen",
          pattern: "\\b(entscheidung|routine|team|angestoßen|angestossen|weiter)\\b",
          flags: "i",
        },
      ],
      forbiddenPatterns: [
        {
          label: "nicht weiter in Frust/no-signal bohren",
          pattern: "\\b(frust|problem|konkretes|beispiel|fine|doch)\\b",
          flags: "i",
        },
      ],
    },
  },
  {
    id: "ep_19_general_vague_depth",
    group: "general_survey",
    description:
      "Tiefe General Survey: vage Relevanz zählt nicht als covered.",
    input: input(
      "general_survey",
      "Problemvorkommen",
      "Verstehen, ob und wie das Problem im echten Alltag auftritt.",
    ),
    history: turns(
      "Wie häufig begegnet Ihnen dieses Problem im Alltag?",
      "Das kommt schon immer mal wieder vor, würde ich sagen.",
    ),
    expected: {
      action: "probe",
      behavior:
        "Nicht abhaken; nach dem letzten konkreten Auftreten mit Situation, aktuellem Vorgehen oder Aufwand fragen.",
      should: [
        "vage Häufigkeit nicht als covered zählen",
        "nach dem letzten konkreten Fall fragen",
        "Workaround oder Aufwand anbahnen",
      ],
      avoid: [
        "zum nächsten Topic wechseln",
        "eine Skala oder Schätzung abfragen",
        "hypothetische Lösung diskutieren",
      ],
      forbiddenPatterns: [HYPOTHETICALS],
    },
  },
  {
    id: "ep_20_brand_flat_after_two_associations",
    group: "brand_research",
    description:
      "Tiefe Brand: nach zwei Assoziationen/Vergleich nicht überbohren.",
    input: multiTopicInput(
      "brand_research",
      [
        {
          topic: "Spontane Markenassoziationen",
          intent: "Spontane Bilder, Gefühle und Worte zur Marke verstehen.",
        },
        {
          topic: "Kommunikationskanäle",
          intent: "Verstehen, wo die Marke wahrgenommen wird.",
        },
      ],
      "Verstehen, wie die Marke spontan wahrgenommen und erinnert wird.",
    ),
    history: [
      {
        role: "agent",
        text: `${OPENING_CONTEXT}\n\nWelche Worte oder Bilder kommen Ihnen spontan bei der Marke in den Kopf?`,
      },
      {
        role: "customer",
        text: "Innovativ und nahbar. Nicht so steif wie SAP, eher unkompliziert.",
      },
      {
        role: "agent",
        text: "Was meinen Sie genau mit nahbar?",
      },
      {
        role: "customer",
        text: "Menschlich, kurze Sprache, weniger Konzerngefühl. Mehr fällt mir dazu gerade nicht ein.",
      },
    ],
    expected: {
      action: "move_on_or_close",
      behavior:
        "Brand-Assoziationen als ausreichend erschöpft behandeln und zum nächsten Topic wechseln oder schließen; nicht dritte Markenassoziations-Probe stellen.",
      should: [
        "flache Brand-Tiefe respektieren",
        "nicht weiter nach nahbar/innovativ/SAP bohren",
        "zum Topic Kommunikationskanäle wechseln oder schließen",
      ],
      avoid: [
        "noch ein Beispiel zu nahbar verlangen",
        "weiter nach SAP-Vergleich bohren",
        "Vergangenheitsverhalten abfragen",
      ],
      requiredPatterns: [
        {
          label: "wenn nicht closing, muss die nächste Nachricht zum nächsten Brand-Topic führen",
          pattern: "\\b(kommunikation|kanal|kanäle|kanaele|wahrgenommen|kontakt|begegnet|weiter)\\b",
          flags: "i",
        },
      ],
      forbiddenPatterns: [
        PAST_BEHAVIOR,
        {
          label: "nicht weiter in erschöpfte Assoziationen bohren",
          pattern: "\\b(nahbar|innovativ|sap|steif|unkompliziert|menschlich|konzerngefühl|konzerngefuehl)\\b",
          flags: "i",
        },
      ],
    },
  },
  {
    id: "ep_21_concept_depth_to_relevance",
    group: "concept_test",
    description:
      "Tiefe Concept: nach Verständnis-Paraphrase eine Stufe zu Relevanz/Nutzen.",
    input: input(
      "concept_test",
      "Konzeptverständnis und Nutzen",
      "Verstehen, ob das Konzept verstanden wird und welchen Nutzen Teilnehmer wahrnehmen.",
    ),
    history: turns(
      "Wie würden Sie das Konzept in eigenen Worten beschreiben?",
      "Ich verstehe es so: Interviews werden automatisch ausgewertet und daraus werden Muster und Themen sichtbar gemacht.",
    ),
    expected: {
      action: "probe",
      behavior:
        "Verständnis als geprüft behandeln und genau eine Stufe zu Relevanz oder wahrgenommenem Nutzen gehen, ohne Kaufabsicht.",
      should: [
        "nicht erneut Verständnis paraphrasieren lassen",
        "nach Relevanz, Nutzen oder aktueller Passung fragen",
        "keine Kauf- oder Würden-Frage stellen",
      ],
      avoid: [
        "weiter an Verständnis hängen bleiben",
        "fragen, ob sie es kaufen würden",
        "Feature-Ideen anbieten",
      ],
      forbiddenPatterns: [
        PURCHASE_INTENT,
        HYPOTHETICALS,
        {
          label: "nicht erneut Verständnis prüfen",
          pattern: "\\b(in eigenen worten|unklar|verstanden|beschreiben sie das konzept)\\b",
          flags: "i",
        },
      ],
    },
  },
];
