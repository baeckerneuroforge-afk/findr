import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { ResearchPlanForm } from "@/components/dashboard/ResearchPlanForm";

/**
 * /dashboard/market-research/new — Markt-Studie anlegen (Phase M3, Optik v5/E6).
 *
 * Mirror von /dashboard/research-plans/new — server-rendered shell + dieselbe
 * client-ResearchPlanForm, NUR mit studyType="market_research". Das ist der
 * einzige Unterschied beim Anlegen: die Form stempelt den Diskriminator und
 * redirected danach in den Markt-Bereich. Das Discovery-Anlegen
 * (research-plans/new, <ResearchPlanForm /> ohne Prop) bleibt byte-identisch.
 *
 * E6 (v5): Über dem Formular stehen zwei Einstiegs-Karten (KI-Schnellstart
 * empfohlen vs. Manuell) und eine Drei-Schritte-Leiste. Beides ist reine
 * Orientierung — die Karten sind Anker-Links in dieselbe eine Seite
 * (#grundlagen / #leitfaden in der Form), kein Multi-Step, kein neuer
 * Submit-Pfad. Schritt 3 (Feldzugang) passiert ehrlich NACH dem Anlegen auf
 * der Studien-Seite und ist deshalb stumm/abgesetzt dargestellt.
 */

/** Sparkle — gleiche Pfadform wie der VI-Empfehlungshinweis im Formular. */
function SparkleIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-primary-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-neutral-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17Z" />
      <path d="m13.5 6.5 3 3" />
    </svg>
  );
}

/** Nummern-Punkt der Schritte-Leiste. `done`-Optik gibt es bewusst nicht —
 *  das ist keine Fortschrittsanzeige, sondern eine Landkarte der einen Seite. */
function StepDot({ n, muted }: { n: number; muted?: boolean }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border font-mono text-caption ${
        muted
          ? "border-neutral-200 text-neutral-400"
          : "border-primary-200 bg-primary-50 text-primary-700"
      }`}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}

export default async function NewMarketCampaignPage() {
  try {
    await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/onboarding/create-org");
      redirect("/sign-in");
    }
    throw err;
  }

  const t = await getTranslations("research.market");

  return (
    <div className="space-y-8">
      <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
        <div className="mb-2">
          <Link
            href="/dashboard/market-research"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {t("backToCampaigns")}
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">{t("newTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("newSubtitle")}</p>
      </div>

      {/* Zwei-Karten-Einstieg — der KI-Leitfaden-Generator existiert seit jeher
          im Formular, war dort aber erst nach langem Scrollen sichtbar. Die
          Karten machen die Wahl am Kopf der Seite explizit; beide sind reine
          Anker in dieselbe Seite (Form-Sektionen tragen die IDs). */}
      <div
        className="st-rise grid gap-4 sm:grid-cols-2"
        style={{ "--st": 1 } as React.CSSProperties}
      >
        <a
          href="#leitfaden"
          className="relative rounded-lg border border-primary-200 bg-gradient-to-b from-primary-50 to-white p-5 shadow-sm outline-none transition-all hover:border-primary-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500/40 motion-safe:hover:-translate-y-0.5"
        >
          <span className="absolute right-4 top-4 rounded-full border border-primary-200 bg-white px-2 py-0.5 text-caption font-medium leading-none text-primary-700">
            {t("startAiBadge")}
          </span>
          <span className="flex items-center gap-2 pr-24 text-body-strong text-neutral-900">
            <SparkleIcon />
            {t("startAiTitle")}
          </span>
          <p className="mt-1.5 max-w-[46ch] text-small text-neutral-600">
            {t("startAiDesc")}
          </p>
          <span className="mt-3 block text-small font-medium text-primary-700">
            {t("startAiCta")}
          </span>
        </a>
        <a
          href="#grundlagen"
          className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm outline-none transition-all hover:border-neutral-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500/40 motion-safe:hover:-translate-y-0.5"
        >
          <span className="flex items-center gap-2 text-body-strong text-neutral-900">
            <PencilIcon />
            {t("startManualTitle")}
          </span>
          <p className="mt-1.5 max-w-[46ch] text-small text-neutral-600">
            {t("startManualDesc")}
          </p>
          <span className="mt-3 block text-small font-medium text-neutral-500">
            {t("startManualCta")}
          </span>
        </a>
      </div>

      {/* Drei-Schritte-Leiste — Landkarte, kein Wizard: Schritt 1+2 sind die
          zwei Gruppen dieser einen Seite, Schritt 3 (Feldzugang) folgt nach dem
          Anlegen auf der Studien-Seite und bleibt deshalb gedimmt. */}
      <div
        className="st-rise flex flex-wrap items-center gap-x-2.5 gap-y-2"
        style={{ "--st": 2 } as React.CSSProperties}
      >
        <span className="inline-flex items-center gap-2 text-small font-medium text-neutral-700">
          <StepDot n={1} />
          {t("stepsLabel1")}
        </span>
        <span className="h-px w-6 bg-neutral-200" aria-hidden="true" />
        <span className="inline-flex items-center gap-2 text-small font-medium text-neutral-700">
          <StepDot n={2} />
          {t("stepsLabel2")}
        </span>
        <span className="h-px w-6 bg-neutral-200" aria-hidden="true" />
        <span className="inline-flex items-center gap-2 text-small text-neutral-400">
          <StepDot n={3} muted />
          {t("stepsLabel3")}
        </span>
        <span className="basis-full text-caption text-neutral-400 sm:ml-2 sm:basis-auto">
          {t("stepsHint")}
        </span>
      </div>

      <div className="st-rise" style={{ "--st": 3 } as React.CSSProperties}>
        <ResearchPlanForm studyType="market_research" />
      </div>
    </div>
  );
}
