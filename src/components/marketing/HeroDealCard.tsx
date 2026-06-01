import { CornerBrackets } from "./primitives";

/**
 * Static product-glimpse card for the homepage hero — a deal-risk readout plus
 * two transcript lines (copy verbatim from landing.html:1084–1094). Purely
 * presentational; the *interactive* version lives on the Sales-Intelligence
 * module page (SalesLiveDemo).
 */
function RiskRing({ value }: { value: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg width="64" height="64" className="-rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e8e4f2" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#5b2fd4"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-neutral-900">
        {value}
      </div>
    </div>
  );
}

function MiniLine({
  who,
  rep,
  children,
}: {
  who: string;
  rep?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={`mt-0.5 inline-flex h-6 shrink-0 items-center rounded px-2 text-[11px] font-medium ${
          rep
            ? "bg-neutral-100 text-neutral-700"
            : "bg-primary-50 text-primary-700"
        }`}
      >
        {who}
      </span>
      <p className="text-sm leading-relaxed text-neutral-700">{children}</p>
    </div>
  );
}

export function HeroDealCard() {
  return (
    <div className="relative rounded border border-neutral-200 bg-white p-6 sm:p-7">
      <CornerBrackets className="border-primary-200" />
      <div className="flex items-center gap-4 border-b border-neutral-200 pb-5">
        <RiskRing value={72} />
        <div>
          <div className="text-sm font-medium text-neutral-900">Deal-Risk-Score</div>
          <div className="text-xs text-neutral-500">Acme Corp · Q2-Renewal</div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-4">
        <MiniLine who="Rep" rep>
          Wer auf eurer Seite muss das am Ende freigeben?
        </MiniLine>
        <MiniLine who="Kunde">
          <mark className="bg-primary-50 text-neutral-900 decoration-primary-300">
            Da müsste ich Markus, unseren CFO, mit reinholen — aber der ist gerade
            völlig im Stress.
          </mark>
        </MiniLine>
      </div>
    </div>
  );
}
