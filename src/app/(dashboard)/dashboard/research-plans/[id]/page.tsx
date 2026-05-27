import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PlanStatusControl } from "@/components/dashboard/PlanStatusControl";

/**
 * /dashboard/research-plans/[id] — Detail-Seite.
 *
 * Read-only Darstellung des Plans plus Status-Lifecycle-Buttons. Topics
 * werden hier nicht inline editiert (siehe Designentscheidung: Edit-Modal
 * folgt in Etappe B). Invite-Bereich folgt ebenfalls in Etappe B.
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ResearchPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id: planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2">
          <Link
            href="/dashboard/research-plans"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            ← All research plans
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-display text-neutral-900">{plan.title}</h1>
              <Badge variant={STATUS_VARIANT[plan.status]}>
                {STATUS_LABEL[plan.status]}
              </Badge>
            </div>
            <p className="mt-1 text-small text-neutral-500">
              Created {formatDate(plan.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Objective + persona + sample-target */}
      <Card>
        <CardHeader>
          <h2 className="text-h3 text-neutral-900">Objective</h2>
        </CardHeader>
        <CardBody>
          <p className="whitespace-pre-wrap text-body text-neutral-700">
            {plan.objective}
          </p>

          {(plan.persona || plan.sampleTarget !== null) && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  Target persona
                </div>
                <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                  {plan.persona ?? (
                    <span className="text-neutral-400">— not specified —</span>
                  )}
                </p>
              </div>
              <div>
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  Sample target
                </div>
                <p className="mt-1 text-body text-neutral-700">
                  {plan.sampleTarget !== null ? (
                    `${plan.sampleTarget} completed interviews`
                  ) : (
                    <span className="text-neutral-400">— open-ended —</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Topics (read-only — Edit modal lands in Etappe B) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">Topics</h2>
          <p className="text-body text-neutral-500">
            The agent covers each topic in 2–4 turns, formulating questions
            from the intent.
          </p>
        </div>
        {plan.topics.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-4 text-center text-body text-neutral-500">
                No topics yet — the agent will run purely off the objective.
              </p>
            </CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {plan.topics.map((t, i) => (
              <li key={i}>
                <Card>
                  <CardBody className="space-y-3">
                    <div>
                      <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                        Topic {i + 1}
                      </div>
                      <div className="mt-0.5 text-h3 text-neutral-900">
                        {t.topic}
                      </div>
                    </div>
                    <div>
                      <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                        Intent
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                        {t.intent}
                      </p>
                    </div>
                    {t.hypotheses && t.hypotheses.length > 0 && (
                      <div>
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          Private hypotheses · {t.hypotheses.length}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {t.hypotheses.map((h, hi) => (
                            <li
                              key={hi}
                              className="border-l-2 border-neutral-200 pl-3 text-small text-neutral-600"
                            >
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Status-Lifecycle */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">Lifecycle</h2>
          <p className="text-small text-neutral-500">
            Drafts are editable but participants can&apos;t be invited yet.
            Activate to start, mark complete when sampling is done, archive
            to retire.
          </p>
        </div>
        <PlanStatusControl planId={plan.id} status={plan.status} />
      </section>
    </div>
  );
}
