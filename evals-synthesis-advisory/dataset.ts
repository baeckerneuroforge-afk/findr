import type { AdvisoryInput } from "@/lib/synthesis/advisory";

/**
 * Advisory eval cases (Runde 2). Each case is a FINISHED synthesis fixture (the
 * advisory layer's input) drawn from a realistic market-research context, plus
 * expectations. The spread deliberately tests BOTH sides:
 *   • rich syntheses → deduction quality (does it derive sharp, specific
 *     hypotheses that follow from the findings?);
 *   • sparse / empty syntheses → RESTRAINT (does it refuse to manufacture advice?).
 *
 * These are Claude-authored realistic fixtures for the first calibration run;
 * André can replace / extend them with his own real-context cases for the next
 * iteration (they only need to satisfy the AdvisoryEvalCase shape).
 */

export interface AdvisoryEvalCase {
  name: string;
  input: AdvisoryInput;
  expected: {
    minImplications: number;
    maxImplications: number;
    /** Manual-read hint for the report. */
    note: string;
  };
}

function theme(
  title: string,
  summary: string,
  frequency: number,
  quotes: string[],
) {
  return {
    title,
    summary,
    frequency,
    sourceInsightIds: quotes.map((_, i) => `s-${i}`),
    quotes,
  };
}

function side(label: string, quotes: string[]) {
  return { label, sourceInsightIds: quotes.map((_, i) => `t-${i}`), quotes };
}

export const ADVISORY_EVAL_CASES: AdvisoryEvalCase[] = [
  {
    name: "finflow-onboarding (rich)",
    input: {
      plan: {
        title: "FinFlow – Onboarding-Studie",
        objective:
          "Verstehen, wo Neukund:innen beim Einstieg abspringen und was Vertrauen schafft.",
      },
      overview:
        "Über 22 Interviews entscheidet der Einstieg über Bleiben oder Abspringen. Die automatische Kategorisierung der Ausgaben ist der stärkste Vertrauensanker, während ein überladenes Setup ohne Führung viele früh frustriert.",
      emergent_themes: [
        theme(
          "Setup-Komplexität blockiert den ersten Erfolg",
          "Neukund:innen brauchen zu viele Schritte, bevor ein erster Nutzen sichtbar wird.",
          14,
          ["Ich brauchte drei Anläufe, bis mein Konto verknüpft war."],
        ),
        theme(
          "Automatische Kategorisierung schafft Vertrauen",
          "Sobald die App Ausgaben selbstständig einsortiert, steigt das Vertrauen spürbar.",
          11,
          ["Dass die App meine Ausgaben selbst einsortiert, hat mich überzeugt."],
        ),
        theme(
          "Fehlende Guidance im ersten Flow",
          "Ohne geführten Einstieg wissen Neukund:innen nicht, was der nächste sinnvolle Schritt ist.",
          8,
          ["Niemand hat mir gesagt, was der nächste Schritt ist."],
        ),
      ],
      tensions: [
        {
          description: "Wie viel Automatisierung wollen Nutzer:innen beim Start?",
          side_a: side("Will maximale Automatisierung", [
            "Warum kann das nicht einfach automatisch laufen?",
          ]),
          side_b: side("Will zunächst selbst verstehen", [
            "Ich möchte am Anfang selbst sehen, was passiert.",
          ]),
        },
      ],
    },
    expected: {
      minImplications: 3,
      maxImplications: 6,
      note: "Reiche Befunde → scharfe, spezifische Hypothesen (z. B. Time-to-first-value, geführter Erststart, Automatik mit Opt-out).",
    },
  },
  {
    name: "kochbox-wechsel (medium)",
    input: {
      plan: {
        title: "Kochbox-Abo – Wechsel-Studie",
        objective:
          "Verstehen, warum Kund:innen zwischen Kochbox-Anbietern wechseln.",
      },
      overview:
        "18 Interviews: Rezeptvielfalt und die Flexibilität beim Pausieren treiben die Anbieterwahl. Verpackungsmüll ist ein wiederkehrender Kritikpunkt, der bei einigen zum Wechsel führte.",
      emergent_themes: [
        theme(
          "Rezeptvielfalt bindet",
          "Wiederholende Rezepte sind der häufigste genannte Wechselgrund; Abwechslung hält im Abo.",
          10,
          ["Nach zwei Monaten kamen immer dieselben Gerichte."],
        ),
        theme(
          "Verpackungsmüll als Ärgernis",
          "Der Verpackungsaufwand wird wiederholt als schlechtes Gewissen und Wechselauslöser genannt.",
          7,
          ["Der ganze Plastikmüll hat mich jede Woche geärgert."],
        ),
      ],
      tensions: [
        {
          description: "Flexibilität gegen Planbarkeit beim Liefermodell.",
          side_a: side("Will jederzeit pausieren können", [
            "Ich will spontan aussetzen können, wenn ich unterwegs bin.",
          ]),
          side_b: side("Will feste Lieferungen als Routine", [
            "Die feste wöchentliche Box ist Teil meiner Routine.",
          ]),
        },
      ],
    },
    expected: {
      minImplications: 2,
      maxImplications: 5,
      note: "Mittlere Dichte → 2–4 konkrete Hypothesen, je Befund eine.",
    },
  },
  {
    name: "hr-tool-admin (medium, B2B)",
    input: {
      plan: {
        title: "HR-Tool – Admin-Onboarding",
        objective: "Wie HR-Admins ein neues Personal-Tool einführen.",
      },
      overview:
        "15 Interviews mit HR-Admins: Der Datenimport aus Altsystemen ist die größte Einführungshürde. Self-Service für Mitarbeitende senkt die Support-Last der HR spürbar.",
      emergent_themes: [
        theme(
          "Datenimport als Einführungshürde",
          "Der Import aus Altsystemen ist fehleranfällig und verzögert den Go-Live am stärksten.",
          9,
          ["Der Import aus dem alten System hat Wochen gekostet."],
        ),
        theme(
          "Self-Service entlastet HR",
          "Wenn Mitarbeitende ihre Daten selbst pflegen, sinkt die Zahl der HR-Rückfragen deutlich.",
          8,
          ["Seit die Leute selbst pflegen, habe ich kaum noch Rückfragen."],
        ),
      ],
      tensions: [
        {
          description: "Zentral gepflegte gegen selbst gepflegte Mitarbeiterdaten.",
          side_a: side("HR will zentral kontrollieren", [
            "Ich will sichergehen, dass die Daten stimmen, also pflege ich sie selbst.",
          ]),
          side_b: side("Mitarbeitende sollen selbst pflegen", [
            "Es ist absurd, dass ich für jede Adressänderung die HR anmailen muss.",
          ]),
        },
      ],
    },
    expected: {
      minImplications: 2,
      maxImplications: 5,
      note: "B2B → Hypothesen zu Import-Assistent und gestuftem Self-Service (Kontrolle + Entlastung versöhnen).",
    },
  },
  {
    name: "sparse-single-signal (restraint)",
    input: {
      plan: {
        title: "App X – Erste Signale",
        objective: "Erste explorative Interviews zu App X.",
      },
      overview:
        "5 Interviews, inhaltlich sehr heterogen. Ein einziges wiederkehrendes Signal: die Ladezeit wird als langsam empfunden.",
      emergent_themes: [
        theme(
          "Langsame Ladezeit",
          "Mehrere Befragte empfinden die App beim Start als träge.",
          3,
          ["Die App braucht ewig, bis sie geladen hat."],
        ),
      ],
      tensions: [],
    },
    expected: {
      minImplications: 0,
      maxImplications: 2,
      note: "Dünn → höchstens 1–2 zurückhaltende Hypothesen; keine erfundenen Befunde.",
    },
  },
  {
    name: "no-clear-findings (hard restraint)",
    input: {
      plan: {
        title: "Studie ohne klare Befunde",
        objective: "Explorative Runde ohne erkennbaren roten Faden.",
      },
      overview:
        "8 Interviews, aber ohne erkennbare inhaltliche Überlappung — kein wiederkehrendes Thema, kein klares Lager.",
      emergent_themes: [],
      tensions: [],
    },
    expected: {
      minImplications: 0,
      maxImplications: 0,
      note: "Keine Befunde → MUSS leer bleiben (die ehrliche Nullantwort).",
    },
  },
];
