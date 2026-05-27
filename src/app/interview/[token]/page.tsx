import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InterviewChat } from "@/components/interview/InterviewChat";
import { getPublicSession } from "@/lib/voice-agent/session-service";

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
  const session = await getPublicSession(token);
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
  const session = await getPublicSession(token);
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
