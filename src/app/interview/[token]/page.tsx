import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InterviewChat } from "@/components/interview/InterviewChat";
import { getPublicSession } from "@/lib/voice-agent/session-service";

/**
 * Per-render memoization of getPublicSession. The Next App Router runs
 * generateMetadata and the Page component in PARALLEL for the same
 * request — both functions below call this helper with the same token.
 *
 * Without the cache(), each call independently goes through
 * getPublicSession's lazy-create branch when the session doesn't exist
 * yet (research-invite first-hit). That causes:
 *   - 2× Opus opening-message calls (cost waste)
 *   - a race on the INSERT: only one wins on the UNIQUE access_token
 *     constraint; the loser's createResearchInterview returns
 *     status='error' inside its own try/catch, so the wrapper's final
 *     loadByToken can fire BEFORE the winner's INSERT has committed —
 *     and return null. That null was the visible bug: the first hit
 *     showed 404, the reload then served the row written by the
 *     "winner" call.
 *
 * React.cache() memoizes per render (= per request) on the same
 * argument key. Both generateMetadata and the Page now share ONE
 * promise — one Opus call, one INSERT, both reads of the same
 * eventual result. Different requests (e.g. two participants who
 * happen to click within the same second) still hit the engine's
 * existing UNIQUE-constraint backstop on interview_sessions.access_token;
 * cache() only closes the SAME-render race, which is the one that
 * was breaking the first-hit experience.
 *
 * IMPORTANT: `cache` is imported from "react" — NOT from "next/cache".
 * The latter is a different API (revalidatePath / unstable_cache /
 * etc.) for cross-request caching, which is exactly what we do NOT
 * want here: we want per-render dedup, not persistence.
 */
const getCachedPublicSession = cache(getPublicSession);

// Default metadata for unauthenticated probes (no session found) and for
// post_loss / checkin kinds — exactly the strings the page used to export
// statically pre-research. Kept as a named const so generateMetadata's
// non-research branch reads as "preserve the old behaviour" at a glance.
const DEFAULT_METADATA: Metadata = {
  title: "A quick question about your decision — findr.",
  description: "A short, confidential follow-up about a recent decision.",
  // Private capability links — never index them.
  robots: { index: false, follow: false },
};

/**
 * Per-token metadata. Only `research` sessions get a custom title (derived
 * from the research-plan title so the browser tab reads as the sponsor
 * intended, not "findr."). Other kinds — and any probe with no matching
 * session — fall through to DEFAULT_METADATA, byte-identical to the
 * previous static export.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const session = await getCachedPublicSession(token);
  if (!session || session.kind !== "research") return DEFAULT_METADATA;
  return {
    title: session.planTitle
      ? `Research interview — ${session.planTitle}`
      : "Research interview",
    description: "A short, confidential research conversation.",
    robots: { index: false, follow: false },
  };
}

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getCachedPublicSession(token);
  if (!session) notFound();

  const isResearch = session.kind === "research";

  return (
    <InterviewChat
      token={token}
      initialConversation={session.conversation}
      initialStatus={session.status}
      company={session.company}
      // Research-only: drop the Findr branding (logo + "Powered by …"
      // footer) and use the plan title as the h1. For post_loss / checkin
      // both props default to false/null, so render is byte-identical.
      brandless={isResearch}
      headingOverride={isResearch ? session.planTitle : null}
    />
  );
}
