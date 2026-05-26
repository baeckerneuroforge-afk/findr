/**
 * Save-Play Eval Dataset
 * ----------------------
 * 7 hand-crafted cases for measuring the QUALITY of generateSavePlayLLM().
 * Mirror of evals-solution/dataset.ts — the CS-side equivalent. There is no
 * right/wrong label: save-plays are judged on properties (grounded? concrete
 * next step? no hallucination? respects context?) plus a human read.
 *
 * Each case is a realistic CS conversation (renewal pre-call, QBR, check-in,
 * support handoff) with:
 *   - account context (companyName, sponsor, sponsorEmail, renewal, MRR, currency)
 *   - transcript (DE / EN / mixed)
 *   - HAND-SET health analysis (the kind the v2 health classifier would emit
 *     after src/lib/accounts/health-service.ts persists it)
 *   - rationale describing what a GOOD save-play would do for this account
 *
 * IMPORTANT: every quote inside `health.signals[].quotes` is written as a
 * verbatim substring of that case's `transcript`. That keeps the cases honest
 * (the model can ground on them) and lets the runner's anchoring /
 * hallucination heuristics check evidence against the transcript.
 *
 * The cases cover one signal each + one multi/mild lukewarm + one healthy
 * control:
 *   sp_01 CHAMPION_LOSS · sp_02 BUDGET_FRICTION · sp_03 STAKEHOLDER_CHURN
 *   sp_04 ENGAGEMENT_DROP · sp_05 COMPETITOR_PRESSURE · sp_06 lukewarm
 *   (single mild STALLING_PATTERN) · sp_07 healthy control (no signals)
 *
 * No `companyProfile` in this first round — that variant comes later.
 */

import type { SavePlayInput } from "@/lib/accounts/save-play-extractor";

export interface SavePlayEvalCase {
  id: string;
  description: string;
  account: SavePlayInput["account"];
  transcript: string;
  /** A hand-set health analysis standing in for the v2 classifier's output. */
  health: SavePlayInput["health"];
  /** Why this case exists / what a GOOD save-play would do here. For human readers. */
  rationale: string;
}

export const SAVE_PLAY_EVAL_CASES: SavePlayEvalCase[] = [
  {
    id: "sp_01",
    description: "CHAMPION_LOSS — sponsor announces departure, no successor yet",
    account: {
      companyName: "Logistik Hamburg GmbH",
      sponsorName: "Markus Renz",
      sponsorEmail: "m.renz@logistik-hamburg.de",
      renewalDate: "2026-08-15",
      mrr: 4500,
      currency: "EUR",
      transcriptsCount: 3,
    },
    transcript: [
      "csm: Hi Markus, schön dass wir zur Renewal-Vorbereitung sprechen. Wie schaust du auf die nächsten Wochen?",
      "sponsor: Ich muss dir was sagen: Ich verlasse Ende Juni die Firma. Ist noch nicht offiziell, aber mein Vertrag ist unterschrieben.",
      "csm: Oh, das tut mir leid. Ist denn schon klar, wer dein Projekt mit uns übernimmt?",
      "sponsor: Noch nicht, der Geschäftsführer entscheidet das nächste Woche. Ich befürchte aber, dass die Person erstmal alle Tools überprüfen will — das ist hier so üblich.",
      "csm: Was würde dir helfen, einen sauberen Übergang sicherzustellen?",
      "sponsor: Ich brauche eine Zusammenfassung was wir mit Aurora dieses Jahr erreicht haben — Zahlen, Cases — damit der Nachfolger nicht bei Null anfangen muss.",
    ].join("\n"),
    health: {
      healthScore: 28,
      healthLevel: "at_risk",
      overallReasoning:
        "Sponsor Markus Renz leaves end of June; no successor named and the company custom is to re-evaluate all tools when a new owner takes over. Sponsor explicitly asked for a value-summary artifact to give the successor.",
      signals: [
        {
          type: "CHAMPION_LOSS",
          confidence: 0.92,
          reasoning:
            "Sponsor is leaving end of June with no named successor and the explicit company custom of re-evaluating tools when a new owner takes over.",
          quotes: [
            "Ich verlasse Ende Juni die Firma. Ist noch nicht offiziell, aber mein Vertrag ist unterschrieben.",
            "die Person erstmal alle Tools überprüfen will — das ist hier so üblich",
          ],
        },
      ],
    },
    rationale:
      "Single clear CHAMPION_LOSS. A good save-play (a) builds Markus's hand-off pack with concrete Aurora results before he leaves, (b) requests a warm intro the moment the successor is named, (c) protects the renewal via a specific value-summary artifact — NOT generic 'build relationship'.",
  },
  {
    id: "sp_02",
    description: "BUDGET_FRICTION — CFO froze renewals, hard ROI gate",
    account: {
      companyName: "Stuttgart Industriebau AG",
      sponsorName: "Karin Faber",
      sponsorEmail: "k.faber@stuttgart-industriebau.de",
      renewalDate: "2026-07-10",
      mrr: 6800,
      currency: "EUR",
      transcriptsCount: 4,
    },
    transcript: [
      "sponsor: Ich muss dir direkt sagen: Unser CFO hat letzte Woche alle SaaS-Renewals auf Eis gelegt. Bis Ende August keine neuen Verträge.",
      "csm: Auch unsere Verlängerung?",
      "sponsor: Auch eure. Er hat wörtlich gesagt: 'ohne harte Zahlen wird hier kein Vertrag mehr unterschrieben.' Ich brauche eine ROI-Rechnung, sonst ist Schluss.",
      "csm: Welche Zahlen würden bei deinem CFO funktionieren?",
      "sponsor: Er will eingesparte Stunden, fehlervermiedene Kosten, am liebsten quantifiziert auf Quartalsebene. Bisher haben wir das nur qualitativ.",
      "csm: Wir können in den nächsten zwei Wochen einen quantifizierten Business Case bauen, wenn du mir die Q1-Nutzungsdaten gibst.",
      "sponsor: Mach das. Wenn es überzeugend ist, kämpfe ich. Sonst können wir es vergessen.",
    ].join("\n"),
    health: {
      healthScore: 30,
      healthLevel: "at_risk",
      overallReasoning:
        "CFO froze all SaaS renewals through end of August; sponsor Karin Faber needs a quantified ROI case (saved hours, avoided costs at quarter granularity) to unfreeze our renewal. Sponsor relationship is strong — she will fight if the case is solid.",
      signals: [
        {
          type: "BUDGET_FRICTION",
          confidence: 0.9,
          reasoning:
            "CFO froze all renewals until end of August; explicit threshold is quantitative ROI (hours saved, costs avoided per quarter).",
          quotes: [
            "Unser CFO hat letzte Woche alle SaaS-Renewals auf Eis gelegt",
            "ohne harte Zahlen wird hier kein Vertrag mehr unterschrieben",
            "eingesparte Stunden, fehlervermiedene Kosten, am liebsten quantifiziert auf Quartalsebene",
          ],
        },
      ],
    },
    rationale:
      "BUDGET_FRICTION with an explicit CFO threshold. A good save-play (a) commits to a quantified business case from Q1 nutzungsdaten, (b) targets the CFO's exact metrics (saved hours, avoided costs, quarterly), (c) timeline before renewal date — NOT generic 'show value' or 'demonstrate ROI'.",
  },
  {
    id: "sp_03",
    description:
      "STAKEHOLDER_CHURN — new VP Procurement reopens vendor decision",
    account: {
      companyName: "Helvetia Foods AG",
      sponsorName: "Daniel Frey",
      sponsorEmail: "d.frey@helvetia-foods.ch",
      renewalDate: "2026-08-30",
      mrr: 8200,
      currency: "EUR",
      transcriptsCount: 5,
    },
    transcript: [
      "sponsor: Heads up — we have a new VP Procurement, Patrick Wenger, started Monday. He's calling for a full vendor review across all categories.",
      "csm: Including ours?",
      "sponsor: Including yours. He told me he wants to see at least two competing offers per category before any renewal.",
      "csm: Wir sind im August dran. Wie ist Patricks Background?",
      "sponsor: Er kommt von Migros, hat dort die Vendor-Konsolidierung gemacht. Sein Statement intern war: 'I'm not married to any incumbent.'",
      "csm: Was würde ihn überzeugen, uns zu behalten?",
      "sponsor: ROI-Nachweis plus Migration-Cost-Vergleich gegen die zwei wahrscheinlichsten Alternativen. Er hört auf Zahlen — ich nicht mehr.",
      "csm: Klar. Ich brauche von dir die zwei Alternativen, die er prüfen wird.",
      "sponsor: Schicke ich dir morgen. I personally still think you're the right tool, but I don't have the final call anymore.",
    ].join("\n"),
    health: {
      healthScore: 31,
      healthLevel: "at_risk",
      overallReasoning:
        "New VP Procurement (Patrick Wenger, ex-Migros vendor consolidation) is reopening the vendor decision Q3; needs ROI + migration-cost comparison vs two named alternatives. Sponsor has lost final authority but still backs us internally.",
      signals: [
        {
          type: "STAKEHOLDER_CHURN",
          confidence: 0.88,
          reasoning:
            "New VP Procurement (Patrick Wenger) explicitly resetting the vendor decision; sponsor no longer has final say. Per round-4 disambiguation: a NEW hire whose arrival is the event = STAKEHOLDER_CHURN, not LATE_DECISION_MAKER.",
          quotes: [
            "we have a new VP Procurement, Patrick Wenger, started Monday. He's calling for a full vendor review across all categories",
            "I'm not married to any incumbent",
            "I personally still think you're the right tool, but I don't have the final call anymore",
          ],
        },
      ],
    },
    rationale:
      "STAKEHOLDER_CHURN (new VP, not late-decision-maker). A good save-play (a) gets the CSM/rep into a meeting with Patrick BEFORE the vendor review, (b) builds the migration-cost comparison Daniel asked for, (c) treats Daniel as an influencer not the decision-maker — NOT generic 'align stakeholders'.",
  },
  {
    id: "sp_04",
    description:
      "ENGAGEMENT_DROP — power user left, 60% login drop, two QBRs skipped",
    account: {
      companyName: "Riverside Group LLC",
      sponsorName: "Dana Ortiz",
      sponsorEmail: "dana@riverside-group.com",
      renewalDate: "2026-09-22",
      mrr: 5200,
      currency: "USD",
      transcriptsCount: 4,
    },
    transcript: [
      "csm: Hi Dana, just our quarterly check-in. How are things on your side?",
      "sponsor: Honestly not great. We've slipped a lot since Sarah left in February — she was our power user and the team hasn't picked it back up.",
      "csm: How does usage look from your side?",
      "sponsor: Logins are down maybe 60% since Sarah's last week. We've also skipped the last two QBRs — I just didn't have anything to discuss.",
      "csm: What would help re-anchor the team?",
      "sponsor: Honestly I think we need a re-onboarding. But not the generic one — something specific to how Sarah had it set up. Otherwise the team won't bother.",
      "csm: Who's Sarah's replacement on usage?",
      "sponsor: Nobody yet. Maria from analytics knows it casually, but she'd need formal training to take it over.",
    ].join("\n"),
    health: {
      healthScore: 26,
      healthLevel: "at_risk",
      overallReasoning:
        "Power user Sarah left in February; logins dropped ~60%, two consecutive QBRs skipped, no formal replacement. Maria from analytics is the natural successor but needs targeted training to mirror Sarah's setup.",
      signals: [
        {
          type: "ENGAGEMENT_DROP",
          confidence: 0.85,
          reasoning:
            "Sharp 60% login drop after a named trigger event (Sarah's departure), two consecutive QBR cancellations, no replacement power user.",
          quotes: [
            "We've slipped a lot since Sarah left in February — she was our power user",
            "Logins are down maybe 60% since Sarah's last week",
            "We've also skipped the last two QBRs",
          ],
        },
      ],
    },
    rationale:
      "ENGAGEMENT_DROP with a NAMED trigger (Sarah). A good save-play (a) proposes a Sarah-replica re-onboarding for Maria specifically — not the generic one Dana already rejected, (b) re-schedules the QBR with a concrete topic Dana can use, (c) maps Sarah's old workflows so Maria can mirror them — NOT generic 're-engage the team'.",
  },
  {
    id: "sp_05",
    description:
      "COMPETITOR_PRESSURE — Gong pilot started, named feature gap (coaching)",
    account: {
      companyName: "Bayern Werke AG",
      sponsorName: "Lukas Hartmann",
      sponsorEmail: "l.hartmann@bayern-werke.de",
      renewalDate: "2026-06-20",
      mrr: 5800,
      currency: "EUR",
      transcriptsCount: 4,
    },
    transcript: [
      "sponsor: Ich muss euch was direkt sagen. Wir haben letzte Woche einen Pilot mit Gong gestartet — parallel.",
      "csm: Wer hat das initiiert?",
      "sponsor: Unsere Bereichsleiterin Frau Bauer. Sie hat auf der Saastr ein Demo gesehen und will Vergleichszahlen vor der Verlängerung.",
      "csm: Was an Gong hat sie besonders überzeugt?",
      "sponsor: Die Conversation Intelligence — sie sagte: 'Bei Findr fehlt mir das Coaching-Modul, das Gong dazu zeigt.' Das ist ihr O-Ton.",
      "csm: Wie groß ist der Vergleichszeitraum?",
      "sponsor: Drei Wochen Pilot, dann Entscheidung. Renewal ist in vier Wochen.",
      "csm: Was würdest du mir empfehlen?",
      "sponsor: Bring die Coaching-Funktion auf den Tisch und zeig konkret, was wir bei euch nutzen, was Gong nicht ersetzen kann. Frau Bauer guckt auf Features, nicht auf Beziehung.",
    ].join("\n"),
    health: {
      healthScore: 33,
      healthLevel: "at_risk",
      overallReasoning:
        "Bereichsleiterin Frau Bauer started a 3-week Gong pilot in parallel, citing a missing coaching module. Renewal decision in 4 weeks based on feature comparison. Sponsor signals Frau Bauer is feature-driven, not relationship-driven.",
      signals: [
        {
          type: "COMPETITOR_PRESSURE",
          confidence: 0.87,
          reasoning:
            "Active competitor pilot (Gong) initiated by named executive (Frau Bauer); concrete feature gap (coaching module) cited verbatim; renewal decision tied to the 3-week pilot outcome.",
          quotes: [
            "Wir haben letzte Woche einen Pilot mit Gong gestartet — parallel",
            "Bei Findr fehlt mir das Coaching-Modul, das Gong dazu zeigt",
            "Drei Wochen Pilot, dann Entscheidung. Renewal ist in vier Wochen",
          ],
        },
      ],
    },
    rationale:
      "COMPETITOR_PRESSURE with a specific feature gap (coaching module) and a feature-driven buyer (Frau Bauer). NO company profile, so the model must stay grounded in the transcript. Good save-play (a) directly addresses the coaching gap — show what Findr coaching workflows DO exist OR commit a roadmap date, (b) gets Frau Bauer into a feature-comparison conversation before the pilot ends, (c) does NOT fall into 'build relationship' platitudes — sponsor explicitly said she is a feature buyer.",
  },
  {
    id: "sp_06",
    description:
      "Lukewarm — single mild STALLING_PATTERN, sponsor genuinely overloaded",
    account: {
      companyName: "Bavaria Mittelstand GmbH",
      sponsorName: "Henrik Schäfer",
      sponsorEmail: "h.schaefer@bavaria-mittelstand.de",
      renewalDate: "2026-10-15",
      mrr: 3200,
      currency: "EUR",
      transcriptsCount: 3,
    },
    transcript: [
      "csm: Hi Henrik, lass uns kurz auf den QBR von letzter Woche zurückkommen — den hattest du verschoben.",
      "sponsor: Ja, sorry. Ich musste den dritten Mal verschieben. Mein Team ist gerade mitten in der ERP-Migration, das frisst alles.",
      "csm: Verstehe. Was wäre der nächste realistische Termin?",
      "sponsor: Frühestens August, ehrlich. Vorher kommen wir nicht zur Ruhe.",
      "csm: Bedeutet das auch, dass die Renewal-Diskussion Q4 läuft?",
      "sponsor: Ja. Wir nutzen es weiterhin, aber ich kann dir bis dahin keine harten Zahlen liefern. Das Team hat den Kopf nicht frei.",
      "csm: Was würde dir zwischendurch helfen?",
      "sponsor: Eigentlich nur Ruhe. Wenn ihr Updates schickt, lese ich sie wenn ich kann.",
    ].join("\n"),
    health: {
      healthScore: 48,
      healthLevel: "lukewarm",
      overallReasoning:
        "Sponsor genuinely overloaded by an ERP migration; QBR pushed three times in a row but with a legitimate reason. Usage continues, no churn intent — but sponsor explicitly cannot engage on metrics until Q4.",
      signals: [
        {
          type: "STALLING_PATTERN",
          confidence: 0.72,
          reasoning:
            "Three consecutive QBR postponements with an honest but indefinite reason (ERP migration through August).",
          quotes: [
            "Ich musste den dritten Mal verschieben",
            "Frühestens August, ehrlich. Vorher kommen wir nicht zur Ruhe",
            "Wenn ihr Updates schickt, lese ich sie wenn ich kann",
          ],
        },
      ],
    },
    rationale:
      "Single STALLING with legitimate context — salvageable should be 'maybe'. Good save-play (a) RESPECTS the sponsor's stated bandwidth (no aggressive push), (b) proposes a minimum-touchpoint async cadence with concrete artifact (e.g., a monthly 2-paragraph update instead of QBR), (c) pre-builds the renewal case from usage data WITHOUT asking Henrik for input — NOT generic 'stay in touch' or 'be proactive'.",
  },
  {
    id: "sp_07",
    description:
      "Healthy control — best quarter, expansion approved, NO signals",
    account: {
      companyName: "Pinnacle Capital Inc.",
      sponsorName: "Alex Chen",
      sponsorEmail: "alex@pinnacle-capital.com",
      renewalDate: "2026-11-30",
      mrr: 7500,
      currency: "USD",
      transcriptsCount: 4,
    },
    transcript: [
      "sponsor: Quick check-in — honestly this has been our best quarter using Findr. The new SDR team is fully on it.",
      "csm: That's amazing. Anything you want to flag?",
      "sponsor: Not really. We saved at least 12 hours a week per rep on pipeline reviews — our CFO already approved an early renewal at 30 seats instead of 20.",
      "csm: Want me to send the expansion order form?",
      "sponsor: Yeah, send it. We're targeting signature within two weeks. The team is aligned.",
      "csm: And case study — would you be open?",
      "sponsor: Happy to. Send me a draft and I'll get it past marketing.",
    ].join("\n"),
    health: {
      healthScore: 88,
      healthLevel: "thriving",
      overallReasoning:
        "Best quarter using Findr; CFO pre-approved expansion (20 → 30 seats); customer offered to be a case study and targets signature in 2 weeks. No churn signals whatsoever.",
      signals: [],
    },
    rationale:
      "Healthy control case — a correct save-play returns recommendations: [] and salvageable: 'yes'. Tests whether the model manufactures problems where none exist — mirror role to sol_06 in the solution eval.",
  },
];

/**
 * Distribution:
 *   Signals covered: CHAMPION_LOSS, BUDGET_FRICTION, STAKEHOLDER_CHURN,
 *                    ENGAGEMENT_DROP, COMPETITOR_PRESSURE, STALLING_PATTERN
 *                    (the mild lukewarm one), plus one healthy (no signals).
 *   Language:        de ×4, en ×2, mixed ×1.
 *   Company profile: none (round 1).
 */
