import type { DetectedSignal, Recommendation, SignalType } from "./types";

export const RECOMMENDATIONS_LIBRARY: Record<SignalType, Recommendation[]> = {
  champion_loss: [
    {
      signal_type: "champion_loss",
      priority: "urgent",
      action:
        "Schedule a transition meeting with the former champion and ask them to name the replacement sponsor.",
      rationale:
        "Champion loss removes internal deal momentum; acting immediately preserves context before it disappears.",
      template_id: "champion_transition_meeting",
    },
    {
      signal_type: "champion_loss",
      priority: "urgent",
      action:
        "Map the next-best champion from existing buyer contacts and run a dedicated value recap with them.",
      rationale:
        "A replacement champion needs both relationship and narrative before they can sell internally.",
      template_id: "replacement_champion_map",
    },
    {
      signal_type: "champion_loss",
      priority: "high",
      action:
        "Send a transition-aware value summary to all known stakeholders with decisions, proof points, and open items.",
      rationale:
        "When the champion leaves, institutional memory of the solution often leaves with them.",
      template_id: "stakeholder_value_summary",
    },
  ],
  competitor_pressure: [
    {
      signal_type: "competitor_pressure",
      priority: "high",
      action:
        "Send a tailored competitor-differentiation note addressing the named vendor and the buyer's exact comparison criteria.",
      rationale:
        "Competitive pressure is recoverable when differentiation is specific and tied to the buyer's stated priorities.",
      template_id: "competitive_diff_note",
    },
    {
      signal_type: "competitor_pressure",
      priority: "high",
      action:
        "Ask the buyer which competitor capability is most compelling and run a focused objection call.",
      rationale:
        "Named competitors often hide a deeper buying concern; direct discovery prevents generic battle-card responses.",
      template_id: "competitive_objection_call",
    },
    {
      signal_type: "competitor_pressure",
      priority: "medium",
      action:
        "Create a mutual scorecard comparing Klymeo and the competitor across business outcomes, not only features.",
      rationale:
        "Outcome-based scorecards shift the evaluation away from pricing bundles and toward business impact.",
      template_id: "competitive_scorecard",
    },
  ],
  stalling: [
    {
      signal_type: "stalling",
      priority: "high",
      action:
        "Reset the deal with a mutual action plan that names every owner, date, and decision gate.",
      rationale:
        "Stalling persists when next steps are vague; named owners and dates create measurable movement.",
      template_id: "mutual_action_plan",
    },
    {
      signal_type: "stalling",
      priority: "high",
      action:
        "Ask what changed since the last committed next step and whether this is still a priority this quarter.",
      rationale:
        "A direct priority check separates normal process drag from deals that are quietly slipping.",
      template_id: "priority_reset_email",
    },
    {
      signal_type: "stalling",
      priority: "medium",
      action:
        "Offer a smaller validation step with a clear yes/no outcome instead of another broad follow-up.",
      rationale:
        "Reducing scope can restart momentum when the full buying process feels too heavy.",
      template_id: "scope_reduction_step",
    },
  ],
  budget_friction: [
    {
      signal_type: "budget_friction",
      priority: "high",
      action:
        "Build a CFO-ready ROI case using the buyer's current forecast misses, lost deals, and manager coaching cost.",
      rationale:
        "Budget objections are rarely solved by discount alone; finance needs credible business impact.",
      template_id: "cfo_roi_case",
    },
    {
      signal_type: "budget_friction",
      priority: "high",
      action:
        "Offer a phased commercial path that protects the strategic rollout while lowering first-year commitment.",
      rationale:
        "Phasing can unblock budget timing without permanently devaluing the solution.",
      template_id: "phased_commercial_plan",
    },
    {
      signal_type: "budget_friction",
      priority: "medium",
      action:
        "Bring procurement and finance into the next call to clarify whether price, payment timing, or ROI is the real blocker.",
      rationale:
        "Different budget objections require different recovery plays; guessing leads to unnecessary discounting.",
      template_id: "finance_procurement_discovery",
    },
  ],
  late_decision_maker: [
    {
      signal_type: "late_decision_maker",
      priority: "high",
      action:
        "Run an executive alignment call for the new approver with a concise recap of pain, impact, and decision criteria.",
      rationale:
        "Late approvers often restart discovery unless they receive a compressed but credible context transfer.",
      template_id: "late_approver_alignment",
    },
    {
      signal_type: "late_decision_maker",
      priority: "medium",
      action:
        "Ask the champion to confirm the new stakeholder's veto power, success criteria, and required proof.",
      rationale:
        "Understanding authority and criteria prevents overreacting to normal sign-off steps.",
      template_id: "decision_power_map",
    },
    {
      signal_type: "late_decision_maker",
      priority: "medium",
      action:
        "Update the stakeholder map and add a decision-specific next step for the new approver.",
      rationale:
        "Late stakeholders need explicit ownership in the buying plan or they become hidden blockers.",
      template_id: "stakeholder_map_update",
    },
  ],
  stakeholder_churn: [
    {
      signal_type: "stakeholder_churn",
      priority: "high",
      action:
        "Create a handover packet for replacement stakeholders with prior decisions, objections, and proof points.",
      rationale:
        "Churn forces re-discovery; a handover packet reduces the reset cost.",
      template_id: "stakeholder_handover_packet",
    },
    {
      signal_type: "stakeholder_churn",
      priority: "high",
      action:
        "Ask the buyer to identify which decisions remain valid and which ones need to be re-approved.",
      rationale:
        "Separating stable decisions from reopened decisions keeps the deal from fully restarting.",
      template_id: "decision_validity_check",
    },
    {
      signal_type: "stakeholder_churn",
      priority: "medium",
      action:
        "Schedule a short re-discovery call with new stakeholders focused only on deltas from the original scope.",
      rationale:
        "New stakeholders need context, but a narrow agenda prevents unnecessary re-litigation.",
      template_id: "delta_rediscovery_call",
    },
  ],
  engagement_drop: [
    {
      signal_type: "engagement_drop",
      priority: "high",
      action:
        "Send a candid re-engagement note asking whether the initiative is still a priority and what changed.",
      rationale:
        "Engagement drops often hide priority shifts; direct language surfaces the real status.",
      template_id: "reengagement_note",
    },
    {
      signal_type: "engagement_drop",
      priority: "medium",
      action:
        "Reduce the next ask to one low-friction meeting with a clear outcome and only essential stakeholders.",
      rationale:
        "Lowering coordination cost can restore momentum when buyers are distracted but still interested.",
      template_id: "low_friction_meeting",
    },
    {
      signal_type: "engagement_drop",
      priority: "medium",
      action:
        "Compare recent attendance, reply times, and meeting length with the earlier baseline before escalating.",
      rationale:
        "Measuring the drop prevents false alarms from one-off busy weeks.",
      template_id: "engagement_baseline_review",
    },
  ],
  multi_threading_failure: [
    {
      signal_type: "multi_threading_failure",
      priority: "high",
      action:
        "Ask the champion for introductions to finance, legal, procurement, and the business owner before proposal review.",
      rationale:
        "Single-threaded deals fail when hidden stakeholders appear late with veto power.",
      template_id: "multi_thread_intro_request",
    },
    {
      signal_type: "multi_threading_failure",
      priority: "high",
      action:
        "Build a stakeholder coverage map showing who is engaged, who is missing, and who can block the deal.",
      rationale:
        "Coverage gaps are easiest to fix when they are visible and tied to decision authority.",
      template_id: "stakeholder_coverage_map",
    },
    {
      signal_type: "multi_threading_failure",
      priority: "medium",
      action:
        "Identify a backup champion who understands the value narrative and can continue if the primary sponsor slows down.",
      rationale:
        "Backup champions reduce dependency on one relationship and protect the deal from organizational changes.",
      template_id: "backup_champion_identification",
    },
  ],
};

export function generateRecommendations(
  signals: DetectedSignal[],
): Recommendation[] {
  const seen = new Set<SignalType>();
  const recommendations: Recommendation[] = [];

  for (const signal of signals) {
    if (seen.has(signal.type)) continue;
    seen.add(signal.type);

    const candidates = RECOMMENDATIONS_LIBRARY[signal.type] ?? [];
    const filtered =
      signal.severity === "critical" || signal.severity === "high"
        ? candidates.filter(
            (candidate) =>
              candidate.priority === "urgent" || candidate.priority === "high",
          )
        : candidates;

    if (filtered[0]) recommendations.push(filtered[0]);
  }

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );
}
