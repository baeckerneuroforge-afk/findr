import { CtaLink } from "./CtaLink";
import { CornerBrackets } from "./primitives";

type Cta = { label: string; href: string };

export type PricingFeature = {
  label: string;
  /** Roadmap feature — rendered muted with a "bald" badge (honest Live/Bald). */
  soon?: boolean;
};

export type PricingTier = {
  /** Product name — NOT translated (Starter/Growth/Scale). */
  name: string;
  /** Audience line, e.g. "Für kleine Teams". */
  audience: string;
  desc: string;
  /** Amount in DE format with dot thousands separator, e.g. "1.999". */
  amount: string;
  /** e.g. "/Monat". */
  period: string;
  priceSub: string;
  features: PricingFeature[];
  cta: Cta;
  featured?: boolean;
  /** e.g. "Beliebteste Wahl" — shown only on the featured tier. */
  popularLabel?: string;
};

export type PricingEnterprise = {
  name: string;
  title: string;
  desc: string;
  bullets: PricingFeature[];
  cta: Cta;
};

/**
 * The "bald" badge. In the original static HTML this was injected via CSS
 * `::after { content: 'soon' }`; rebuilt as real markup, we render the German
 * label directly — so no pseudo-content override is needed (§4.6). Live/Bald is
 * the honest labelling that runs through all the copy.
 */
function SoonBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
      bald
    </span>
  );
}

function PlanCard({ tier }: { tier: PricingTier }) {
  return (
    <div
      className={`relative flex flex-col p-9 ${
        tier.featured ? "bg-warm" : "bg-white"
      }`}
    >
      <CornerBrackets
        className={tier.featured ? "border-primary-500" : "border-primary-200"}
      />
      {tier.popularLabel ? (
        <span className="mb-4 inline-flex w-fit items-center rounded-full bg-primary-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
          {tier.popularLabel}
        </span>
      ) : null}
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-600">
        — {tier.name}
      </div>
      <h3 className="mt-3 font-marketing text-2xl font-semibold tracking-[-0.01em] text-neutral-900">
        {tier.audience}
      </h3>
      <p className="mt-2 min-h-[42px] text-[13px] leading-relaxed text-neutral-500">
        {tier.desc}
      </p>
      {/* DE currency: amount → "€" → period (symbol AFTER, dot thousands). */}
      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="font-marketing text-[44px] font-semibold leading-none tracking-[-0.03em] text-neutral-900">
          {tier.amount}
        </span>
        <span className="text-lg text-neutral-500">€</span>
        <span className="text-sm text-neutral-500">{tier.period}</span>
      </div>
      <div className="mt-1.5 text-[12px] text-neutral-400">{tier.priceSub}</div>
      <ul className="mt-6 flex flex-grow flex-col border-t border-dashed border-neutral-200 pt-5">
        {tier.features.map((f) => (
          <li
            key={f.label}
            className={`flex items-start gap-2.5 py-1.5 text-[13px] leading-snug ${
              f.soon ? "text-neutral-400" : "text-neutral-700"
            }`}
          >
            <span
              aria-hidden
              className={`mt-px font-semibold ${
                f.soon ? "text-neutral-300" : "text-primary-600"
              }`}
            >
              {f.soon ? "◆" : "✓"}
            </span>
            <span>
              {f.label}
              {f.soon ? <SoonBadge /> : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <CtaLink
          href={tier.cta.href}
          variant={tier.featured ? "primary" : "secondary"}
          size="lg"
          className="w-full"
        >
          {tier.cta.label}
        </CtaLink>
      </div>
    </div>
  );
}

/**
 * Pricing tiers + Enterprise band (§4.6). Hairline grid (gap-px on a neutral-200
 * bg gives 1px dividers); the featured tier is tinted + carries the popular
 * label and stronger corner brackets instead of a clipped scale transform. The
 * Enterprise band is one connected bordered row below the grid — every bullet is
 * a uniform <li> (fixes the stray <li> from the source HTML).
 */
export function PricingTable({
  tiers,
  enterprise,
}: {
  tiers: PricingTier[];
  enterprise: PricingEnterprise;
}) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-t border border-neutral-200 bg-neutral-200 lg:grid-cols-3">
        {tiers.map((tier) => (
          <PlanCard key={tier.name} tier={tier} />
        ))}
      </div>

      <div className="relative grid gap-8 border border-t-0 border-neutral-200 bg-white p-8 sm:p-10 lg:grid-cols-[1.3fr_1fr_auto] lg:items-center">
        <CornerBrackets className="border-primary-200" />
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary-600">
            — {enterprise.name}
          </div>
          <h3 className="mt-2 font-marketing text-2xl font-semibold tracking-[-0.01em] text-neutral-900">
            {enterprise.title}
          </h3>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-neutral-500">
            {enterprise.desc}
          </p>
        </div>
        <ul className="flex flex-col gap-2.5">
          {enterprise.bullets.map((b) => (
            <li
              key={b.label}
              className={`flex items-start gap-2.5 text-[13px] ${
                b.soon ? "text-neutral-400" : "text-neutral-700"
              }`}
            >
              <span
                aria-hidden
                className={`mt-2 h-px w-2.5 shrink-0 ${
                  b.soon ? "bg-neutral-300" : "bg-primary-500"
                }`}
              />
              <span>
                {b.label}
                {b.soon ? <SoonBadge /> : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="lg:justify-self-end">
          <CtaLink href={enterprise.cta.href} variant="secondary" size="lg">
            {enterprise.cta.label}
          </CtaLink>
        </div>
      </div>
    </div>
  );
}
