import Link from "next/link";

interface PricingTier {
  name: string;
  price: string;
  priceUnit?: string;
  subtitle: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted: boolean;
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    priceUnit: "/ month",
    subtitle: "For solo founders exploring loss-risk",
    features: [
      "5 calls analyzed per month",
      "Basic risk-score detection",
      "Email alerts",
      "1 user seat",
    ],
    cta: { label: "Start free", href: "/sign-up" },
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$99",
    priceUnit: "/ month",
    subtitle: "For small B2B SaaS sales teams",
    features: [
      "50 calls analyzed per month",
      "Predictive risk-scoring",
      "Hubspot integration",
      "Slack alerts",
      "3 user seats",
    ],
    cta: { label: "Start trial", href: "/sign-up" },
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$499",
    priceUnit: "/ month",
    subtitle: "Most popular for scaling sales teams",
    features: [
      "250 calls analyzed per month",
      "All integrations (Hubspot, Salesforce, Gong)",
      "Post-loss AI interviews",
      "Pipeline-health dashboard",
      "Slack + Teams alerts",
      "10 user seats",
    ],
    cta: { label: "Start trial", href: "/sign-up" },
    highlighted: true,
  },
  {
    name: "Scale",
    price: "$1,499",
    priceUnit: "/ month",
    subtitle: "For revenue teams at scale",
    features: [
      "1,000 calls analyzed per month",
      "Custom risk-models",
      "Multi-team analytics",
      "Outcome-based pricing option",
      "Salesforce AppExchange native app",
      "Unlimited user seats",
    ],
    cta: { label: "Start trial", href: "/sign-up" },
    highlighted: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    subtitle: "For 500+ FTE companies with custom needs",
    features: [
      "Unlimited calls",
      "Custom AI personas trained on your ICP",
      "SSO (SAML, Okta, Azure AD)",
      "Dedicated Customer Success Manager",
      "Custom contract terms",
      "SLA guarantees",
    ],
    cta: { label: "Contact sales", href: "#contact" },
    highlighted: false,
  },
];

function CheckIcon({ highlighted }: { highlighted: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`mt-0.5 h-4 w-4 shrink-0 ${
        highlighted ? "text-white" : "text-violet-400"
      }`}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PricingCard({ tier }: { tier: PricingTier }) {
  const cardClasses = tier.highlighted
    ? "bg-obsidian-light border-2 border-violet-600 xl:scale-105"
    : "bg-mist/5 border border-mist/15";

  const ctaClasses = tier.highlighted
    ? "bg-violet-600 text-white hover:bg-violet-700"
    : "bg-mist/10 text-white border border-mist/20 hover:bg-mist/20";

  return (
    <div className={`relative flex h-full flex-col rounded-xl p-6 ${cardClasses}`}>
      {tier.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white">
          Most Popular
        </span>
      )}

      <h3 className="text-lg font-medium text-white">{tier.name}</h3>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-medium text-white">{tier.price}</span>
        {tier.priceUnit && (
          <span className="text-sm text-mist">{tier.priceUnit}</span>
        )}
      </div>

      <p className="mt-3 min-h-[2.5rem] text-sm text-mist">{tier.subtitle}</p>

      <div className="mt-6 mb-6 border-t border-mist/10" />

      <ul className="space-y-3">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon highlighted={tier.highlighted} />
            <span className="text-sm leading-relaxed text-mist">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Link
          href={tier.cta.href}
          className={`block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${ctaClasses}`}
        >
          {tier.cta.label}
        </Link>
      </div>
    </div>
  );
}

export default function PricingTable() {
  return (
    <section className="mx-auto mt-20 max-w-7xl px-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {PRICING_TIERS.map((tier) => (
          <PricingCard key={tier.name} tier={tier} />
        ))}
      </div>
    </section>
  );
}
