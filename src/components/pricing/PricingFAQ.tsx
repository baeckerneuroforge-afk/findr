const FAQS: { q: string; a: string }[] = [
  {
    q: "What counts as a call?",
    a: "A call is any recorded sales conversation that Findr analyzes — discovery, demo, follow-up, or post-loss interview. We only count completed calls with at least 5 minutes of speaker audio. Internal team meetings and personal calls don't count toward your monthly quota.",
  },
  {
    q: "Can I change plans mid-month?",
    a: "Yes. Upgrades take effect immediately and are pro-rated against the current billing cycle. Downgrades take effect at the start of the next cycle. No cancellation fees, no questions asked.",
  },
  {
    q: "Do you have a free trial on paid plans?",
    a: "All paid tiers include a 14-day free trial with full feature access. No credit card required to start. If you don't activate a paid plan after the trial, your account drops to Free automatically — no surprise charges.",
  },
  {
    q: "Is there a setup fee?",
    a: "No setup fees on any plan. Enterprise customers get free white-glove onboarding (CRM integration, custom risk-model training, team enablement) included in the contract.",
  },
  {
    q: "What's the difference between Scale and Enterprise?",
    a: "Scale ($1,499/month) is self-serve with unlimited seats and the outcome-based pricing option — built for revenue teams of 20–100. Enterprise is custom-priced with a dedicated Customer Success Manager, SSO (SAML/Okta/Azure AD), AI personas trained on your ICP, and SLA guarantees — for 500+ FTE companies with complex compliance needs.",
  },
];

export default function PricingFAQ() {
  return (
    <section className="mx-auto mt-24 max-w-3xl px-6">
      <h2 className="text-center text-3xl font-medium tracking-tight text-white">
        Frequently asked questions
      </h2>
      <div className="mt-12 space-y-3">
        {FAQS.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-xl border border-mist/15 bg-mist/5 px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-white">
              <span>{faq.q}</span>
              <svg
                className="h-5 w-5 shrink-0 text-mist transition-transform group-open:rotate-180"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-mist">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
