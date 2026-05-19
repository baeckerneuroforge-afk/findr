import type { Deal, RiskLevel } from "@/lib/deals/types";

export type CallType =
  | "discovery"
  | "demo"
  | "follow_up"
  | "negotiation"
  | "check_in"
  | "champion";

export interface MockSpeaker {
  name: string;
  role: string;
  organization: string;
  speaker_type: "sales_rep" | "buyer" | "buyer_team" | "champion";
}

export interface MockSegment {
  speaker_index: number;
  start_seconds: number;
  end_seconds: number;
  text: string;
  signals: string[];
}

export interface MockCall {
  deal_id: string;
  call_type: CallType;
  recorded_at: string;
  duration_seconds: number;
  speakers: MockSpeaker[];
  segments: MockSegment[];
  transcript: string;
  transcript_summary: string;
}

const SALES_REPS = [
  { name: "Sarah Müller", role: "Senior Account Executive", organization: "Your Company" },
  { name: "Marcus Schmidt", role: "Sales Manager", organization: "Your Company" },
  { name: "Anna Hoffmann", role: "Account Executive", organization: "Your Company" },
];

const HIGH_RISK_SEGMENTS = [
  {
    text:
      "Also ehrlich gesagt, unser CFO hat letzte Woche nochmal nachgefragt ob wir wirklich dieses Quartal entscheiden müssen. Er ist sich nicht sicher ob das Budget passt.",
    signals: ["BUDGET_FRICTION", "STALLING_PATTERN"],
  },
  {
    text:
      "Wir schauen uns parallel auch noch Salesforce an. Die haben uns ein interessantes Angebot gemacht.",
    signals: ["COMPETITOR_PRESSURE"],
  },
  {
    text:
      "Marcus ist leider letzte Woche das Unternehmen gewechselt. Sein Nachfolger Thomas muss sich erst einarbeiten in das Thema.",
    signals: ["CHAMPION_LOSS", "STAKEHOLDER_CHURN"],
  },
  {
    text:
      "Wir müssen das nochmal intern besprechen. Unser Geschäftsführer will auch dabei sein bei der Entscheidung.",
    signals: ["LATE_DECISION_MAKER", "STALLING_PATTERN"],
  },
  {
    text:
      "Können wir das Meeting nochmal um zwei Wochen verschieben? Bei uns ist gerade einiges los.",
    signals: ["STALLING_PATTERN", "ENGAGEMENT_DROP"],
  },
];

const MEDIUM_RISK_SEGMENTS = [
  {
    text:
      "Der Preis ist schon ein Thema. Wir haben in unserem Budget eigentlich nur 70 Prozent davon eingeplant. Können wir da nochmal drüber sprechen?",
    signals: ["BUDGET_FRICTION"],
  },
  {
    text:
      "Hubspot hat uns auch was gezeigt, aber das war nicht ganz das was wir suchen. Ihr seid da definitiv weiter.",
    signals: ["COMPETITOR_PRESSURE"],
  },
  {
    text:
      "Ich finde das sehr spannend, muss aber meinen Vorgesetzten überzeugen. Der ist beim nächsten Termin dabei.",
    signals: ["LATE_DECISION_MAKER"],
  },
];

const LOW_RISK_SEGMENTS = [
  {
    text: "Das passt alles sehr gut zu unseren Anforderungen. Lasst uns die nächsten Schritte besprechen.",
    signals: [],
  },
  {
    text: "Mein Team ist begeistert von der Demo. Wir wollen das jetzt schnell ins Pilot bringen.",
    signals: [],
  },
  {
    text: "Können wir den Vertrag schon mal aufsetzen? Ich denke wir sind da auf einer Linie.",
    signals: [],
  },
];

const FILLER_SEGMENTS_REP = [
  "Danke fürs Zeit nehmen heute. Lass mich kurz nochmal zusammenfassen wo wir stehen.",
  "Wir haben in unserer Plattform genau diesen Use Case schon mehrfach abgebildet bei ähnlichen Kunden.",
  "Wenn ich das richtig verstehe, ist eure Hauptanforderung dass das System mit eurem aktuellen Setup integriert.",
  "Vielleicht macht es Sinn wenn wir nächste Woche einen technischen Workshop machen.",
  "Wir können euch das gerne nochmal in einem extended Demo zeigen.",
];

const FILLER_SEGMENTS_BUYER = [
  "Okay, das klingt erstmal interessant. Lass mich das mit dem Team durchgehen.",
  "Wir haben aktuell folgendes Setup im Einsatz und da gibt es ein paar Reibungspunkte.",
  "Was uns wichtig ist: dass das DSGVO-konform läuft und die Daten in der EU bleiben.",
  "Wie sieht denn euer Support-Modell aus für Enterprise-Kunden?",
  "Ich melde mich nächste Woche bei euch mit Feedback aus dem Team.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * Infer expected risk-level from deal metadata when no classifier-set
 * riskLevel exists yet. Heuristic mirrors the mock-data comment blocks
 * (deals 001, 003 → high; 007 → critical; 002, 006, 010 → low; rest → medium).
 */
function inferRiskLevel(deal: Deal): RiskLevel {
  if (deal.riskLevel) return deal.riskLevel;

  const competitorCount = deal.competitorsMentioned.length;
  const stale = deal.daysSinceLastActivity;

  if (competitorCount >= 4 || stale >= 18) return "critical";
  if (competitorCount >= 3 || stale >= 14) return "high";
  if (competitorCount >= 1 || stale >= 7) return "medium";
  return "low";
}

export function generateMockCall(deal: Deal, callType: CallType, daysAgo: number): MockCall {
  const salesRep = pickRandom(SALES_REPS);
  const buyerName = deal.championName || "Klaus Becker";
  const buyerOrg = deal.companyName || deal.name.split("—")[0]?.trim() || "Customer Company";
  const inferredRisk = inferRiskLevel(deal);

  const speakers: MockSpeaker[] = [
    { ...salesRep, speaker_type: "sales_rep" },
    {
      name: buyerName,
      role: deal.championTitle || "Head of Operations",
      organization: buyerOrg,
      speaker_type: "champion",
    },
  ];

  if (inferredRisk === "high" || inferredRisk === "critical") {
    speakers.push({
      name: "Thomas Wagner",
      role: "Geschäftsführer",
      organization: buyerOrg,
      speaker_type: "buyer_team",
    });
  }

  const segments: MockSegment[] = [];
  let currentSeconds = 0;

  const riskSegments =
    inferredRisk === "critical" || inferredRisk === "high"
      ? pickN(HIGH_RISK_SEGMENTS, 3)
      : inferredRisk === "medium"
      ? pickN(MEDIUM_RISK_SEGMENTS, 2)
      : pickN(LOW_RISK_SEGMENTS, 2);

  for (let i = 0; i < 12; i++) {
    const isRiskSegment = i > 2 && i < 10 && riskSegments.length > 0;
    const isBuyerTurn = i % 2 === 1;

    let text: string;
    let signals: string[] = [];

    if (isRiskSegment && isBuyerTurn) {
      const riskSeg = riskSegments.shift()!;
      text = riskSeg.text;
      signals = riskSeg.signals;
    } else if (isBuyerTurn) {
      text = pickRandom(FILLER_SEGMENTS_BUYER);
    } else {
      text = pickRandom(FILLER_SEGMENTS_REP);
    }

    const speakerIndex = isBuyerTurn ? 1 : 0;
    const duration = 20 + Math.floor(Math.random() * 60);

    segments.push({
      speaker_index: speakerIndex,
      start_seconds: currentSeconds,
      end_seconds: currentSeconds + duration,
      text,
      signals,
    });

    currentSeconds += duration;
  }

  const recordedAt = new Date();
  recordedAt.setDate(recordedAt.getDate() - daysAgo);

  const transcript = segments
    .map(
      (s) =>
        `[${formatTime(s.start_seconds)}] ${speakers[s.speaker_index]!.name}: ${s.text}`,
    )
    .join("\n\n");

  const transcript_summary = generateSummary(segments, speakers);

  return {
    deal_id: deal.id,
    call_type: callType,
    recorded_at: recordedAt.toISOString(),
    duration_seconds: currentSeconds,
    speakers,
    segments,
    transcript,
    transcript_summary,
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function generateSummary(segments: MockSegment[], speakers: MockSpeaker[]): string {
  const allSignals = segments.flatMap((s) => s.signals);
  const uniqueSignals = [...new Set(allSignals)];
  const champion = speakers.find((s) => s.speaker_type === "champion")?.name ?? "buyer";

  if (uniqueSignals.length === 0) {
    return `Positive ${segments.length}-segment call. Buyer engagement high. Next steps clearly defined.`;
  }

  return `${segments.length}-segment call with ${uniqueSignals.length} risk signal${
    uniqueSignals.length === 1 ? "" : "s"
  } detected: ${uniqueSignals.join(", ")}. Champion: ${champion}.`;
}

export function generateCallsForDeal(deal: Deal, count: number = 3): MockCall[] {
  const callTypes: CallType[] = ["discovery", "demo", "follow_up"];
  return Array.from({ length: count }).map((_, i) =>
    generateMockCall(deal, callTypes[i] ?? "check_in", (count - i) * 7),
  );
}
