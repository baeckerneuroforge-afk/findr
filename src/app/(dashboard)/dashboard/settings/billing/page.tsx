export default function BillingSettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">Billing</h2>
        <p className="mt-1 text-body text-neutral-500">
          Current plan and commercial next steps.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-caption font-medium uppercase tracking-wider text-primary-700">
              Current plan
            </div>
            <div className="mt-1 text-h1 text-neutral-900">Design Partner</div>
            <p className="mt-1 text-body text-neutral-500">
              High-touch onboarding while Findr is being shaped with early DACH
              sales teams.
            </p>
          </div>
          <a
            href="mailto:andre@findr.ai?subject=Findr%20billing%20upgrade"
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-700"
          >
            Contact us
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            "Hubspot and Gong integration setup",
            "Risk, forecast, and loss-pattern analytics",
            "Slack alerts and DSGVO data export",
          ].map((item) => (
            <div
              key={item}
              className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-body text-neutral-700"
            >
              {item}
            </div>
          ))}
        </div>

        {/* Stripe billing integration deferred — see roadmap. */}
        <p className="mt-4 text-small text-neutral-500">
          Stripe billing integration deferred — see roadmap.
        </p>
      </div>
    </div>
  );
}
