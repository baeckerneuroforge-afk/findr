export default function AlertCardDemo() {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-xl border border-mist/15 bg-mist/5 p-6 text-left">
      {/* Top row: label + source */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Pulsing red dot — static dot + ping ring */}
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alert-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-alert-500" />
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-alert-400">
            Risk Alert · Just now
          </span>
        </div>
        <span className="text-xs text-mist">From Salesforce</span>
      </div>

      {/* Deal name */}
      <h3 className="mb-1.5 font-medium text-white">
        Nordbank Enterprise — €85k ARR
      </h3>

      {/* Description */}
      <p className="mb-4 text-sm leading-relaxed text-mist">
        Champion said &lsquo;still evaluating other vendors&rsquo; twice on
        yesterday&rsquo;s call. Decision-maker has not joined the last three
        meetings. Risk:{" "}
        <span className="font-bold text-alert-500">87 / 100</span>
      </p>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-md bg-alert-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-alert-600"
        >
          Schedule rescue call
        </button>
        <button
          type="button"
          className="rounded-md bg-mist/10 px-3 py-1.5 text-xs text-mist transition-colors hover:bg-mist/20"
        >
          View 4 recommendations
        </button>
      </div>
    </div>
  );
}
