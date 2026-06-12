import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { PanelCredentialSummary } from "@/lib/panel/credentials";

/**
 * Panels-Sektion auf der Teilnehmer-Pool-Seite — Discovery-/Status-Surface,
 * KEIN zweiter Rekrutierungs-Pfad: die Org-Verbindung wird unter
 * /dashboard/integrations/prolific verwaltet, die eigentliche Rekrutierung
 * startet pro Studie im Studien-Detail (ProlificDraftPanel). Diese Sektion
 * macht beides vom Pool aus auffindbar und zeigt den Verbindungsstatus.
 *
 * Server-Komponente (pure Anzeige + Links); der Credential-Read passiert im
 * Page-Load parallel zu listPoolMembers. Bewusst gestapelte Sektion unter dem
 * Manager statt Tabs — die CRUD-Surface oben bleibt unangetastet.
 */

const STATUS_BADGE: Record<
  PanelCredentialSummary["status"],
  { variant: BadgeVariant; key: "statusConnected" | "statusInvalid" | "statusUnknown" }
> = {
  connected: { variant: "success", key: "statusConnected" },
  invalid: { variant: "critical", key: "statusInvalid" },
  unknown: { variant: "default", key: "statusUnknown" },
};

export async function PoolPanelsSection({
  credential,
  studiesHref,
}: {
  credential: PanelCredentialSummary | null;
  studiesHref: string;
}) {
  const t = await getTranslations("research.pool.panels");
  const connected = credential?.status === "connected";
  const badge = credential
    ? STATUS_BADGE[credential.status]
    : ({ variant: "default", key: "statusNotConnected" } as const);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-h2 text-neutral-900">{t("title")}</h2>
        <p className="mt-1 text-body text-neutral-500">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-h3 text-neutral-900">Prolific</h3>
              <Badge variant={badge.variant}>{t(badge.key)}</Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <p className="text-small text-neutral-600">{t("prolificDesc")}</p>
              {connected && (credential?.providerUserEmail || credential?.tokenHint) && (
                <p className="text-caption text-neutral-500">
                  {t("account", {
                    account:
                      credential?.providerUserEmail ?? credential?.tokenHint ?? "",
                  })}
                </p>
              )}
              <p className="text-small text-neutral-600">
                {t("perStudyHint")}{" "}
                <Link
                  href={studiesHref}
                  className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-900"
                >
                  {t("perStudyLink")}
                </Link>
              </p>
              <div>
                <Link
                  href="/dashboard/integrations/prolific"
                  className="inline-flex items-center rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-small font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
                >
                  {connected ? t("manage") : t("connect")}
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-h3 text-neutral-900">{t("comingSoonTitle")}</h3>
              <Badge variant="default">{t("badgePlanned")}</Badge>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-small text-neutral-600">{t("comingSoonDesc")}</p>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
