import { getTranslations } from "next-intl/server";

export default async function BillingSettingsPage() {
  const t = await getTranslations("settings");
  const features = [
    t("billing.feature1"),
    t("billing.feature2"),
    t("billing.feature3"),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 text-neutral-900">{t("billing.title")}</h2>
        <p className="mt-1 text-body text-neutral-500">
          {t("billing.subtitle")}
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-caption font-medium uppercase tracking-wider text-primary-700">
              {t("billing.currentPlan")}
            </div>
            <div className="mt-1 text-h1 text-neutral-900">
              {t("billing.planName")}
            </div>
            <p className="mt-1 text-body text-neutral-500">
              {t("billing.planDesc")}
            </p>
          </div>
          <a
            href="mailto:andre@findr.ai?subject=Findr%20billing%20upgrade"
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-700"
          >
            {t("billing.contact")}
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {features.map((item) => (
            <div
              key={item}
              className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-body text-neutral-700"
            >
              {item}
            </div>
          ))}
        </div>

        <p className="mt-4 text-small text-neutral-500">
          {t("billing.stripeNote")}
        </p>
      </div>
    </div>
  );
}
