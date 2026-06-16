import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getHubspotIntegration } from "@/lib/hubspot/service";
import { getGongIntegration } from "@/lib/gong/service";
import { getProlificCredentialSummary } from "@/lib/panel/service";
import { getSlackIntegration } from "@/lib/slack/service";
import { ENABLED_MODULES } from "@/config/modules";

type SourceStatus = "connected" | "available" | "not_connected";

interface SourceCard {
  title: string;
  category: string;
  description: string;
  href: string;
  cta: string;
  status: SourceStatus;
  detail?: string;
  icon: React.ReactNode;
}

function statusLabel(status: SourceStatus) {
  if (status === "connected") return "Connected";
  if (status === "available") return "Available";
  return "Not connected";
}

function statusVariant(status: SourceStatus): "success" | "default" {
  return status === "connected" ? "success" : "default";
}

function SourceIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-700">
      {children}
    </div>
  );
}

function InlineIcon({ path }: { path: string }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export default async function DataSourcesPage() {
  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/onboarding/create-org");
      redirect("/sign-in");
    }
    throw err;
  }

  const locale = await getLocale();
  const supabase = createAdminSupabaseClient();
  const [hubspot, gong, prolific, slack, manualCountResult] = await Promise.all([
    ENABLED_MODULES.salesIntelligence ? getHubspotIntegration(orgId) : null,
    ENABLED_MODULES.salesIntelligence ? getGongIntegration(orgId) : null,
    ENABLED_MODULES.marketResearch || ENABLED_MODULES.productDiscovery
      ? getProlificCredentialSummary(orgId)
      : null,
    ENABLED_MODULES.salesIntelligence ? getSlackIntegration(orgId) : null,
    ENABLED_MODULES.salesIntelligence
      ? supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("source", "manual")
      : { count: 0 },
  ]);

  const manualCount = manualCountResult.count ?? 0;
  const intro = ENABLED_MODULES.salesIntelligence
    ? "Connect CRM and call systems, or import a deal manually when a design partner wants to test Klymeo before integrations are ready."
    : "Manage research data sources and panel providers for market campaigns.";
  const sources: SourceCard[] = [];
  if (ENABLED_MODULES.salesIntelligence) {
    sources.push(
      {
        title: "Hubspot",
        category: "CRM",
        description: "Sync deals, companies, owners, stages, and close dates.",
        href: "/dashboard/integrations/hubspot",
        cta: hubspot ? "Manage Hubspot" : "Connect Hubspot",
        status: hubspot?.enabled ? "connected" : "not_connected",
        detail: hubspot?.last_synced_at
          ? `Last sync ${new Date(hubspot.last_synced_at).toLocaleString(toBcp47(locale))}`
          : undefined,
        icon: (
          <InlineIcon path="M8 7h8M8 12h8M8 17h5M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        ),
      },
      {
        title: "Gong",
        category: "Calls",
        description: "Import call metadata and transcripts from Gong.",
        href: "/dashboard/integrations/gong",
        cta: gong ? "Manage Gong" : "Connect Gong",
        status: gong?.enabled ? "connected" : "not_connected",
        detail: gong?.last_synced_at
          ? `Last sync ${new Date(gong.last_synced_at).toLocaleString(toBcp47(locale))}`
          : undefined,
        icon: (
          <InlineIcon path="M7 8v8m5-11v14m5-10v6M4 18h16M4 6h16" />
        ),
      },
      {
        title: "Manual import",
        category: "Deals + transcripts",
        description: "Create a deal, paste transcripts, and run live AI analysis.",
        href: "/dashboard/data-sources/manual",
        cta: "Start manual import",
        status: "available",
        detail:
          manualCount > 0
            ? `${manualCount} manual ${manualCount === 1 ? "deal" : "deals"}`
            : "No setup required",
        icon: (
          <InlineIcon path="M12 5v14m7-7H5m3 7h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3Z" />
        ),
      },
      {
        title: "Slack",
        category: "Alerts",
        description: "Send risk spikes and deal alerts to your team channel.",
        href: "/dashboard/integrations/slack",
        cta: slack ? "Manage Slack" : "Set up Slack",
        status: slack?.enabled ? "connected" : "not_connected",
        detail: slack ? slack.channel_name : undefined,
        icon: (
          <InlineIcon path="M7.5 10.5h9m-9 3h5M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        ),
      },
    );
  }
  if (ENABLED_MODULES.marketResearch || ENABLED_MODULES.productDiscovery) {
    sources.push({
      title: "Prolific",
      category: "Panels",
      description: "Create unpublished Prolific study drafts for open links.",
      href: "/dashboard/integrations/prolific",
      cta: prolific ? "Manage Prolific" : "Connect Prolific",
      status: prolific?.status === "connected" ? "connected" : "not_connected",
      detail:
        prolific?.status === "connected"
          ? (prolific.providerUserEmail ?? prolific.tokenHint ?? undefined)
          : prolific?.status === "invalid"
            ? "Stored token is invalid"
            : undefined,
      icon: <InlineIcon path="M4 7h16M4 12h16M4 17h10M7 4v16m10-16v8" />,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display text-neutral-900">Data Sources</h1>
        <p className="mt-1 max-w-2xl text-body text-neutral-500">
          {intro}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sources.map((source) => (
          <Card key={source.title} className="overflow-hidden">
            <CardBody className="flex h-full flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <SourceIcon>{source.icon}</SourceIcon>
                  <div>
                    <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                      {source.category}
                    </div>
                    <h2 className="text-h2 text-neutral-900">
                      {source.title}
                    </h2>
                  </div>
                </div>
                <Badge variant={statusVariant(source.status)}>
                  {statusLabel(source.status)}
                </Badge>
              </div>

              <div className="flex-1">
                <p className="text-body leading-relaxed text-neutral-600">
                  {source.description}
                </p>
                {source.detail && (
                  <p className="mt-2 text-small text-neutral-500">
                    {source.detail}
                  </p>
                )}
              </div>

              <Link
                href={source.href}
                className="inline-flex h-9 items-center justify-center self-start rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-hover"
              >
                {source.cta}
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
