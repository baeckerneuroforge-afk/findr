interface EvidenceQuoteProps {
  quote: string;
  speaker?: string;
  speakerRole?: string;
  context?: string;
  callDate?: string;
}

const ROLE_LABELS: Record<string, string> = {
  sales_rep: "Sales Rep",
  buyer: "Buyer",
  buyer_team: "Buyer Team",
  champion: "Champion",
  decision_maker: "Decision Maker",
  unknown: "Speaker",
};

export function EvidenceQuote({
  quote,
  speaker,
  speakerRole,
  context,
  callDate,
}: EvidenceQuoteProps) {
  return (
    <div className="rounded-r-md border-l-2 border-primary-200 bg-neutral-50 py-3 pl-4 pr-3">
      <div className="mb-1.5 flex items-center gap-2">
        {speaker && (
          <span className="text-caption font-medium text-neutral-700">
            {speaker}
          </span>
        )}
        {speakerRole && (
          <span className="rounded bg-primary-50 px-1.5 py-0.5 text-caption text-primary-700">
            {ROLE_LABELS[speakerRole] ?? speakerRole}
          </span>
        )}
        {callDate && (
          <span className="ml-auto text-caption text-neutral-400">
            {callDate}
          </span>
        )}
      </div>
      <p className="text-body italic leading-relaxed text-neutral-700">
        &ldquo;{quote}&rdquo;
      </p>
      {context && (
        <p className="mt-1.5 text-caption leading-relaxed text-neutral-500">
          {context}
        </p>
      )}
    </div>
  );
}
