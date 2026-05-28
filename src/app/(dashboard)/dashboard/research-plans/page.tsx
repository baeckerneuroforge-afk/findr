import Link from "next/link";
import { redirect } from "next/navigation";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { listResearchPlans } from "@/lib/research/plans-service";
import { listBridgeSuggestions } from "@/lib/bridge/cs-to-research";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { BridgeSuggestionsPanel } from "@/components/dashboard/BridgeSuggestionsPanel";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

/**
 * /dashboard/research-plans — Plan-Index.
 *
 * Pure-read server component, mirror of /dashboard/health: requireOrgId
 * with the established redirect contract, listResearchPlans returns
 * newest-first, empty-state when no plans exist yet.
 */

type Status = "draft" | "active" | "completed" | "archived";

const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_VARIANT: Record<Status, BadgeVariant> = {
  draft: "default",
  active: "success",
  completed: "low",
  archived: "default",
};

function ResearchIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 4h6m-7 4h8m-9 4h10M5 16h14M7 20h10"
      />
    </svg>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ResearchPlansIndexPage() {
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

  // Plans + bridge suggestions load in parallel — independent reads, no
  // ordering constraint. listBridgeSuggestions returns only `pending`
  // suggestions; approved/dismissed don't show up here anymore.
  const [plans, bridgeSuggestions] = await Promise.all([
    listResearchPlans(orgId),
    listBridgeSuggestions(orgId),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-neutral-900">Research plans</h1>
          <p className="mt-1 text-body text-neutral-500">
            Proactive research interviews — define a study, list its topics,
            invite participants.
          </p>
        </div>
        <Link
          href="/dashboard/research-plans/new"
          className="inline-flex h-8 items-center justify-center rounded-md bg-neutral-900 px-3 text-body-strong font-medium text-white transition-colors hover:bg-neutral-700"
        >
          + New plan
        </Link>
      </div>

      {/* Bridge-Suggestions: CS-Health → Research. Pflicht-Human-Gate —
          renderwert nur das pending-Set; approved/dismissed sind weg. Steht
          BEWUSST oberhalb der Plans-Tabelle, damit ein neuer Vorschlag
          sichtbar ist BEVOR der User in die Plans-Liste taucht. */}
      <BridgeSuggestionsPanel initialSuggestions={bridgeSuggestions} />

      {plans.length === 0 ? (
        <EmptyState
          icon={<ResearchIcon />}
          title="No research plans yet"
          description="Create a plan to define what you want to learn — objective, topics, target persona — then invite participants for AI-led research interviews."
          cta={{ label: "Create the first plan", href: "/dashboard/research-plans/new" }}
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Status</TH>
                <TH className="text-right">Topics</TH>
                <TH className="text-right">Sample target</TH>
                <TH>Created</TH>
              </TR>
            </THead>
            <TBody>
              {plans.map((plan) => (
                <TR key={plan.id}>
                  <TD>
                    <Link
                      href={`/dashboard/research-plans/${plan.id}`}
                      className="text-body-strong text-neutral-900 hover:text-primary-700 hover:underline"
                    >
                      {plan.title}
                    </Link>
                    {plan.objective && (
                      <div className="mt-0.5 line-clamp-1 text-small text-neutral-500">
                        {plan.objective}
                      </div>
                    )}
                  </TD>
                  <TD>
                    <Badge variant={STATUS_VARIANT[plan.status]}>
                      {STATUS_LABEL[plan.status]}
                    </Badge>
                  </TD>
                  <TD className="text-right text-neutral-700">
                    {plan.topics.length}
                  </TD>
                  <TD className="text-right text-neutral-700">
                    {plan.sampleTarget ?? "—"}
                  </TD>
                  <TD className="text-neutral-700 whitespace-nowrap">
                    {formatDate(plan.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
