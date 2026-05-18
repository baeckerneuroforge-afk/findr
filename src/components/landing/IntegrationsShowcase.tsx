const INTEGRATIONS: { name: string; category: string }[] = [
  { name: "Salesforce", category: "CRM" },
  { name: "Hubspot", category: "CRM" },
  { name: "Gong", category: "Recording" },
  { name: "Chorus", category: "Recording" },
  { name: "Slack", category: "Alerts" },
  { name: "Microsoft Teams", category: "Alerts" },
  { name: "Stripe", category: "Billing" },
  { name: "Chargebee", category: "Billing" },
];

export default function IntegrationsShowcase() {
  return (
    <section className="mx-auto mt-32 max-w-5xl px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
        Integrations
      </p>
      <h2 className="mt-4 text-4xl font-medium tracking-tight text-white">
        Lives in your stack, not next to it.
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-mist">
        Native Salesforce AppExchange and Hubspot Marketplace apps. Plus deep
        integrations with the tools your sales team already uses.
      </p>

      <div className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="rounded-xl border border-mist/15 bg-mist/5 p-6 text-center"
          >
            <p className="text-2xl font-medium text-mist">{integration.name}</p>
            <p className="mt-2 text-xs text-mist">{integration.category}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-mist">
        More integrations coming. Tell us what you need →
      </p>
    </section>
  );
}
