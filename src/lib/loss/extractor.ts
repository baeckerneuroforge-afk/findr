import type { CallWithSegments, DetectorInput } from "@/lib/risk/types";

export type LossReasonType =
  | "pricing"
  | "compliance"
  | "competitor"
  | "timing"
  | "budget"
  | "champion_lost"
  | "feature_gap"
  | "no_decision"
  | "internal_priority"
  | "other";

export interface LossReasonEvidence {
  call_id: string;
  speaker: string;
  quote: string;
  pattern_matched: string;
}

export interface LossAnalysis {
  deal_id: string;
  primary_reason: LossReasonType;
  secondary_reasons: LossReasonType[];
  confidence: number;
  evidence_quotes: LossReasonEvidence[];
  extraction_method: "heuristic";
  extracted_at: string;
}

interface LossPatternSet {
  de: RegExp[];
  en: RegExp[];
}

export const LOSS_PATTERNS: Record<LossReasonType, LossPatternSet> = {
  pricing: {
    de: [
      /zu\s+teuer/i,
      /preislich?\s+(nicht|schwer|zu\s+hoch)/i,
      /höher(es?)?\s+(als|wie)\s+(unser|geplant|budget)/i,
      /preis(\s|punkt|niveau)/i,
      /rabatt\s+(nötig|noetig|erforderlich|brauchen)/i,
    ],
    en: [
      /too\s+expensive/i,
      /price\s+(point|level|tag)\s+(too\s+high|prohibitive)/i,
      /budget\s+(constraint|limit|tight)/i,
      /need(ed)?\s+(more|bigger)\s+discount/i,
      /pricing\s+(issue|concern)/i,
    ],
  },
  compliance: {
    de: [
      /datenschutz/i,
      /dsgvo|gdpr/i,
      /compliance/i,
      /betriebsrat/i,
      /soc\s*2|iso\s*27001/i,
      /audit\s+(erforderlich|nötig|noetig)/i,
      /rechtsabteilung/i,
    ],
    en: [
      /data\s+protection/i,
      /gdpr|dsgvo/i,
      /soc\s*2|iso\s*27001/i,
      /compliance\s+(requirement|issue|concern)/i,
      /legal\s+(review|approval)\s+(required|needed)/i,
      /security\s+audit/i,
    ],
  },
  competitor: {
    de: [
      /entscheiden\s+uns\s+für\s+\w+/i,
      /haben\s+uns\s+für\s+\w+\s+entschieden/i,
      /(alternative|wettbewerber|konkurrent)/i,
      /(gong|clari|aviso|salesforce|hubspot)/i,
    ],
    en: [
      /going\s+with\s+\w+/i,
      /chose\s+\w+\s+over/i,
      /competitor/i,
      /(gong|clari|aviso|outreach|salesforce)/i,
    ],
  },
  timing: {
    de: [
      /nicht\s+der\s+richtige\s+zeitpunkt/i,
      /momentan\s+nicht/i,
      /nächstes?\s+(quartal|jahr)/i,
      /erstmal\s+(warten|abwarten)/i,
      /q[1-4]\s+(noch\s+nicht|nicht\s+jetzt)/i,
    ],
    en: [
      /not\s+the\s+right\s+time/i,
      /timing\s+(isn'?t|not)\s+right/i,
      /next\s+(quarter|year|fiscal)/i,
      /park\s+this\s+(for\s+now|until)/i,
      /revisit\s+in\s+\w+/i,
    ],
  },
  budget: {
    de: [
      /(kein|knapp(es?|er))\s+budget/i,
      /budget(freigabe|genehmigung)\s+(verweigert|nicht)/i,
      /cfo\s+(hat|sagt)\s+nein/i,
      /finanzabteilung\s+(blockt|stoppt)/i,
    ],
    en: [
      /no\s+budget/i,
      /budget\s+(approval|allocation)\s+denied/i,
      /cfo\s+(declined|said\s+no|won'?t\s+approve)/i,
      /finance\s+(blocked|stopped|rejected)/i,
    ],
  },
  champion_lost: {
    de: [
      /(verlasse|wechsle|gehe)\s+(die\s+firma|den\s+job)/i,
      /(neue|andere)\s+(rolle|position|stelle)/i,
      /(neuer|anderer)\s+ansprechpartner/i,
      /übergebe?\s+an\s+\w+/i,
    ],
    en: [
      /(leaving|moving|switching)\s+(the\s+company|jobs?)/i,
      /(new|different)\s+(role|position)/i,
      /handing\s+over\s+to/i,
      /(my\s+)?(replacement|successor)/i,
    ],
  },
  feature_gap: {
    de: [
      /(fehlt|brauchen)\s+\w+/i,
      /(unterstützt|integriert)\s+nicht\s+\w+/i,
      /feature\s+(fehlt|nicht\s+verfügbar)/i,
      /benötigen\s+(integration|funktion)/i,
    ],
    en: [
      /missing\s+(feature|capability|integration)/i,
      /doesn'?t\s+(support|integrate\s+with)/i,
      /need(s|ed)\s+(this|the)\s+capability/i,
      /(no|lacks)\s+(integration|connector)\s+(to|with|for)\s+\w+/i,
    ],
  },
  no_decision: {
    de: [
      /(noch\s+keine|keine)\s+entscheidung/i,
      /immer\s+noch\s+(am\s+)?prüfen/i,
      /(unklar|unentschieden|unsicher)/i,
      /melden\s+uns\s+(wieder|später)/i,
    ],
    en: [
      /no\s+decision\s+(yet|made)/i,
      /still\s+(evaluating|considering|deciding)/i,
      /(unclear|undecided|uncertain)/i,
      /circle\s+back\s+(in|later)/i,
    ],
  },
  internal_priority: {
    de: [
      /andere\s+(priorität|prioritaet|projekte).*?(zuerst|wichtiger)/i,
      /interne?\s+(reorganisation|umstrukturierung)/i,
      /fokus\s+liegt\s+(jetzt|momentan)\s+auf/i,
    ],
    en: [
      /other\s+(priorities|projects)\s+(first|more\s+important)/i,
      /internal\s+(restructuring|reorganization)/i,
      /focusing\s+on\s+\w+\s+(first|instead)/i,
    ],
  },
  other: {
    de: [],
    en: [],
  },
};

function getSpeaker(segment: CallWithSegments["segments"][number]): string {
  return segment.speaker_name ?? segment.speaker_id ?? "unknown";
}

function scoreEvidence(
  calls: CallWithSegments[],
): Map<LossReasonType, LossReasonEvidence[]> {
  const evidenceByReason = new Map<LossReasonType, LossReasonEvidence[]>();

  for (const call of calls) {
    for (const segment of call.segments) {
      for (const [reasonType, patterns] of Object.entries(LOSS_PATTERNS)) {
        const allPatterns = [...patterns.de, ...patterns.en];
        const matchedPattern = allPatterns.find((pattern) =>
          pattern.test(segment.text),
        );
        if (matchedPattern) {
          const reason = reasonType as LossReasonType;
          const existing = evidenceByReason.get(reason) ?? [];
          existing.push({
            call_id: call.id,
            speaker: getSpeaker(segment),
            quote: segment.text,
            pattern_matched: matchedPattern.source,
          });
          evidenceByReason.set(reason, existing);
        }
      }
    }
  }

  return evidenceByReason;
}

export async function extractLossReason(
  input: DetectorInput,
): Promise<LossAnalysis> {
  const evidenceByReason = scoreEvidence(input.calls);
  const ranked = Array.from(evidenceByReason.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  const primaryReason = ranked[0]?.[0] ?? "other";
  const secondaryReasons = ranked
    .slice(1, 4)
    .map(([reason]) => reason)
    .filter((reason) => reason !== "other");
  const primaryEvidence = ranked[0]?.[1] ?? [];
  const confidence =
    primaryReason === "other"
      ? 0.3
      : Math.min(0.95, 0.3 + primaryEvidence.length * 0.1);

  return {
    deal_id: input.deal_id,
    primary_reason: primaryReason,
    secondary_reasons: secondaryReasons,
    confidence,
    evidence_quotes: primaryEvidence.slice(0, 5),
    extraction_method: "heuristic",
    extracted_at: new Date().toISOString(),
  };
}
