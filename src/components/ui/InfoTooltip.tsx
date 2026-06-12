interface InfoTooltipProps {
  label: string;
}

export function InfoTooltip({ label }: InfoTooltipProps) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-300 text-caption font-medium text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/10"
        aria-label={label}
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-56 -translate-x-1/2 rounded-md border border-neutral-200 bg-card px-3 py-2 text-left text-caption font-normal normal-case tracking-normal text-neutral-600 shadow-lg group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}

export default InfoTooltip;
