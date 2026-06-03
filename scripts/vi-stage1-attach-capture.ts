import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { existsSync } from "node:fs";

import type { Json } from "@/types/database";

interface Args {
  sessionId?: string;
  token?: string;
  file?: string;
  sampleEverySeconds?: number;
  maxFrames?: number;
  runDiscoveryNow: boolean;
}

function usage(): string {
  return [
    "Usage:",
    "  pnpm exec tsx --conditions=react-server scripts/vi-stage1-attach-capture.ts --session-id <uuid> --file /path/to/recording.mp4",
    "  pnpm exec tsx --conditions=react-server scripts/vi-stage1-attach-capture.ts --token <access_token> --file /path/to/recording.mp4",
    "",
    "Options:",
    "  --sample-every-seconds <n>  Default 8 (one frame every 8s)",
    "  --max-frames <n>            Default 24",
    "  --run-discovery-now         For an already completed research session, create the calls row and run Stage 1 immediately",
  ].join("\n");
}

function parseArgs(argv: string[]): Args {
  const args: Args = { runDiscoveryNow: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--session-id") {
      args.sessionId = next;
      i++;
    } else if (arg === "--token") {
      args.token = next;
      i++;
    } else if (arg === "--file") {
      args.file = next;
      i++;
    } else if (arg === "--sample-every-seconds") {
      args.sampleEverySeconds = Number(next);
      i++;
    } else if (arg === "--max-frames") {
      args.maxFrames = Number(next);
      i++;
    } else if (arg === "--run-discovery-now") {
      args.runDiscoveryNow = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }
  return args;
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    throw new Error(`${name} is not set. Add it to .env.local or the shell.`);
  }
}

function conversationToTranscript(conversation: unknown): string {
  if (!Array.isArray(conversation)) return "";
  return conversation
    .map((turn) => {
      const t =
        turn && typeof turn === "object"
          ? (turn as Record<string, unknown>)
          : {};
      const role = t.role === "agent" ? "Assistant" : "Customer";
      const text = typeof t.text === "string" ? t.text : "";
      return `${role}: ${text}`;
    })
    .join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.sessionId && !args.token) {
    throw new Error(`Provide --session-id or --token.\n\n${usage()}`);
  }
  if (args.sessionId && args.token) {
    throw new Error("Use only one of --session-id or --token.");
  }
  if (!args.file) throw new Error(`Provide --file.\n\n${usage()}`);
  if (!existsSync(args.file)) {
    throw new Error(`File does not exist: ${args.file}`);
  }

  requireEnv("ANTHROPIC_API_KEY");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");

  const [
    {
      appendVisualCaptureToTranscript,
      createVisualCaptureFromRecording,
    },
    { createResearchSupabase },
  ] = await Promise.all([
    import("@/lib/visual-intelligence/vision"),
    import("@/lib/research/db"),
  ]);

  console.log("Sampling frames + running Sonnet vision...");
  const visualCapture = await createVisualCaptureFromRecording(args.file, {
    sampleEverySeconds: args.sampleEverySeconds,
    maxFrames: args.maxFrames,
  });

  const supabase = createResearchSupabase();
  const lookup = supabase
    .from("interview_sessions")
    .select("id, org_id, plan_id, invite_id, status, kind, conversation");
  const sessionQuery = args.sessionId
    ? lookup.eq("id", args.sessionId)
    : lookup.eq("access_token", args.token!);
  const { data: rows, error: readError } = await sessionQuery.limit(1);
  if (readError) throw new Error(`Session lookup failed: ${readError.message}`);
  const session = rows?.[0];
  if (!session) throw new Error("No matching interview_sessions row found.");

  const { error: updateError } = await supabase
    .from("interview_sessions")
    .update({
      capture_source: "manual_file",
      visual_capture: visualCapture as unknown as Json,
    })
    .eq("id", session.id);
  if (updateError) {
    throw new Error(`Failed to update visual_capture: ${updateError.message}`);
  }

  console.log(
    `Stored visual_capture on session ${session.id}: ${visualCapture.frameCount} frame(s), model=${visualCapture.model}`,
  );

  if (args.runDiscoveryNow) {
    if (session.kind !== "research") {
      throw new Error("--run-discovery-now is only supported for research sessions.");
    }
    const transcript = conversationToTranscript(session.conversation);
    if (!transcript.trim()) {
      throw new Error("Session conversation is empty; no transcript to analyze.");
    }
    const now = new Date().toISOString();
    const transcriptWithVisual = appendVisualCaptureToTranscript(
      transcript,
      visualCapture,
    );
    const { data: callRow, error: callError } = await supabase
      .from("calls")
      .insert({
        org_id: session.org_id,
        account_id: null,
        deal_id: null,
        source: "research",
        call_type: "research_interview",
        transcript: transcriptWithVisual,
        recorded_at: now,
        participants: {
          source: "research",
          plan_id: session.plan_id,
          invite_id: session.invite_id,
          hint: "Plan-driven research interview transcript with manual visual capture.",
        } as unknown as Json,
      })
      .select("id")
      .single();
    if (callError || !callRow) {
      throw new Error(
        `Failed to insert calls row: ${callError?.message ?? "no row returned"}`,
      );
    }

    const { analyzeProductDiscovery, DEFAULT_PRODUCT_DISCOVERY_MODEL } =
      await import("@/lib/product-discovery/classifier");
    const model =
      process.env.PRODUCT_DISCOVERY_MODEL ?? DEFAULT_PRODUCT_DISCOVERY_MODEL;
    const result = await analyzeProductDiscovery(
      {
        transcript: transcriptWithVisual,
        recordedAt: now,
      },
      model,
    );

    const insertClient = supabase as unknown as {
      from: (table: "product_discovery_insights") => {
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: Record<string, unknown> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
    const { data: insightRow, error: insightError } = await insertClient
      .from("product_discovery_insights")
      .insert({
        org_id: session.org_id,
        source_call_id: callRow.id,
        deal_id: null,
        account_id: null,
        feature_requests: result.featureRequests,
        pain_points: result.painPoints,
        themes: result.themes,
        summary: result.summary,
        analysis_method: "ai",
        analyzed_at: now,
        respondent_role: result.respondentRole,
        respondent_segment: result.respondentSegment,
        sentiment: result.sentiment,
        respondent_source: "ai",
        plan_id: session.plan_id,
      })
      .select("id")
      .single();
    if (insightError || !insightRow) {
      throw new Error(
        `Failed to insert product_discovery_insights row: ${
          insightError?.message ?? "no row returned"
        }`,
      );
    }

    console.log(
      `Stage 1 ran inline: callId=${callRow.id}, insightId=${insightRow.id as string}, visualPainPoints=${
        result.painPoints.filter((pp) => pp.category === "VISUAL_OBSERVATION")
          .length
      }`,
    );
  } else {
    console.log(
      "Stage 1 will see the visual block when this research session completes.",
    );
  }

  console.log("\nVisual block preview:\n");
  console.log(visualCapture.textBlock);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
