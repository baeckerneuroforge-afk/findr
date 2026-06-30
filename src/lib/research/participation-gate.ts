import type { ResearchPlanRecord } from "./plans-service";

/**
 * Participation Gate — die EINE Wahrheit, ob ein Teilnehmer an einer Studie
 * teilnehmen darf. Die Teilnehmer-Pfade (Resolver der Invite- und Open-Link-
 * Seite, der Session-Mint, der Voice-Token-Mint transitiv) lasen den Studien-
 * Status bisher NICHT — ein gültiger Link funktionierte vor der Aktivierung und
 * nach dem Schließen. Dieses Modul zentralisiert die Regel, damit sie nicht an
 * sechs Stellen driftet.
 *
 * Reine Logik, KEINE DB- oder Scheduler-Abhängigkeit: der einzige Import ist ein
 * `import type` (zur Laufzeit entfernt), damit das Modul von jedem Pfad — auch
 * dem zyklus-empfindlichen session-service — gefahrlos statisch importierbar ist.
 *
 * Zwei Achsen am `research_plans`-Record: `status` (draft/active/completed/
 * archived) trägt den Haupt-Lifecycle; `activation_state` + `scheduled_activation_at`
 * tragen das Deferred-Activation-Scheduling ORTHOGONAL dazu (eine geplante Studie
 * ist status='draft' MIT activation_state='scheduled'). Es gibt KEINEN Cron, der
 * scheduled→active flippt; deshalb behandelt `effectivePlanStatus` eine fällige
 * geplante Studie für die LESE-Sicht wie 'active', während der echte DB-Flip erst
 * beim Mint passiert (ensureDueActivation in scheduler.ts → activatePlanNow).
 */

export type ParticipationClosedReason = "not_yet_active" | "ended";

export type ParticipationGate =
  | { open: true }
  | { open: false; reason: ParticipationClosedReason };

type PlanStatus = ResearchPlanRecord["status"]; // "draft" | "active" | "completed" | "archived"

/**
 * Reine Status-Regel: Teilnahme NUR bei 'active'.
 *   draft     → noch nicht aktiv (schließt 'scheduled' ein — das bleibt 'draft')
 *   completed → beendet
 *   archived  → geschlossen
 * Aufrufer auf Lese-Pfaden reichen vorher `effectivePlanStatus(...)` durch, damit
 * eine fällige geplante Studie als 'active' zählt.
 */
export function planParticipationGate(plan: {
  status: PlanStatus;
}): ParticipationGate {
  if (plan.status === "active") return { open: true };
  if (plan.status === "draft") return { open: false, reason: "not_yet_active" };
  return { open: false, reason: "ended" }; // completed | archived
}

/**
 * Ist eine GEPLANTE Studie fällig (geplanter Zeitpunkt erreicht)? Nur dann darf
 * der On-Demand-Flip am Mint scharf schalten. Ein ungültiger Timestamp ergibt
 * NaN → `now >= NaN` ist false → fail-closed (kein versehentliches Aktivieren).
 */
export function isDueForActivation(
  plan: Pick<
    ResearchPlanRecord,
    "status" | "activationState" | "scheduledActivationAt"
  >,
  now: number,
): boolean {
  return (
    plan.status === "draft" &&
    plan.activationState === "scheduled" &&
    plan.scheduledActivationAt !== null &&
    now >= Date.parse(plan.scheduledActivationAt)
  );
}

/**
 * "Effektiver" Status für seiteneffektFREIE Lese-/Render-Pfade: eine fällige
 * geplante Studie zählt wie 'active', ohne die DB zu verändern. Der reale
 * scheduled→active-Flip (inkl. Invite-Release) passiert ausschließlich am Mint
 * über ensureDueActivation. So geht der Link exakt zum geplanten Zeitpunkt live,
 * auch ohne Cron.
 */
export function effectivePlanStatus(
  plan: Pick<
    ResearchPlanRecord,
    "status" | "activationState" | "scheduledActivationAt"
  >,
  now: number,
): PlanStatus {
  if (plan.status === "active") return "active";
  if (isDueForActivation(plan, now)) return "active";
  return plan.status;
}
