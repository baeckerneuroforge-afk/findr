import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InterviewChat } from "@/components/interview/InterviewChat";
import { getPublicSession } from "@/lib/voice-agent/session-service";

export const metadata: Metadata = {
  title: "A quick question about your decision — findr.",
  description: "A short, confidential follow-up about a recent decision.",
  // Private capability links — never index them.
  robots: { index: false, follow: false },
};

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getPublicSession(token);
  if (!session) notFound();

  return (
    <InterviewChat
      token={token}
      initialConversation={session.conversation}
      initialStatus={session.status}
      company={session.company}
    />
  );
}
