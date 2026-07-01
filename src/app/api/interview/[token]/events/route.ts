import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getResearchPlan } from "@/lib/research/plans-service";
import { assertCaptureConsent } from "@/lib/research/capture-consent";
import {
  ingestSessionEvents,
  resolveResearchEventSession,
} from "@/lib/research/event-store";

/**
 * POST /api/interview/[token]/events
 *
 * Public participant route, scoped by the same unguessable interview token as
 * /api/interview/[token] and /visual-capture. It accepts a small batch of
 * behavioural usability events (clicks/scroll/dwell/nav/task lifecycle) and
 * returns the server-computed task result. NO org secret is ever required from
 * the browser — org_id is read from the token-owned session row.
 *
 * Gate-before-spend, FAIL-CLOSED (integration plan L7), mirroring
 * /visual-capture: resolve the session, enforce the per-study event-tracking
 * flag AND the participant's events-tier consent BEFORE persisting anything.
 *
 * Data minimisation (integration plan §9): payloads MUST NOT carry raw input
 * values or free text — the schema rejects such keys.
 */

export const maxDuration = 60;

const TokenSchema = z.string().min(20).max(200);

const MAX_EVENTS_PER_BATCH = 500;
const MAX_TOTAL_PAYLOAD_CHARS = 256_000;
// Generous upper bound: tolerates either task-relative ms or epoch ms (the
// client decides), while rejecting absurd values. computeTaskResult only ever
// uses differences and clamps negatives, so either convention is safe.
const MAX_TS_MS = 4_102_444_800_000; // ~year 2100 in epoch ms

// Keys that would smuggle PII / raw input content into the event store. Rejected
// on EVERY event payload, not just input events (defense in depth).
const FORBIDDEN_PAYLOAD_KEYS = [
  "value",
  "text",
  "textcontent",
  "innertext",
  "inputvalue",
  "password",
  "email",
];

// Server-side data-minimisation for target_selector. The legitimate client
// (useEventCollector.shortSelector) only ever sends a tag plus a single
// "#id" or ".class", e.g. "button#submit". We do NOT trust that: a hostile or
// buggy client could smuggle PII via an element id such as
// id="email-max@firma.de" -> "input#email-max@firma.de", bypassing the
// payload-key block. So we strip the value to whitelisted STRUCTURAL
// CSS-identifier characters and cap the length (integration plan §9). Never
// throws — PII is neutralised in place, so one odd id never kills a batch.
const MAX_SELECTOR_LEN = 120;
function sanitizeTargetSelector(raw: string): string | undefined {
  const cleaned = raw
    .replace(/[^A-Za-z0-9_.#\- ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SELECTOR_LEN);
  return cleaned.length > 0 ? cleaned : undefined;
}

const EventSchema = z.object({
  // B6 (UX-Engine-Fixes 2026-07-02): exakt die Typen, die der Collector
  // tatsächlich sendet — "dwell"/"nav" waren Geister-Einträge, die kein Client
  // je erzeugte (toter Vertragsteil, der Auswertungs-Erwartungen weckte).
  event_type: z.enum([
    "click",
    "scroll",
    "input_focus",
    "input_blur",
    "task_start",
    "task_complete",
    "task_abandon",
  ]),
  ts_ms: z.number().int().min(0).max(MAX_TS_MS),
  target_selector: z.string().max(512).transform(sanitizeTargetSelector).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const BodySchema = z
  .object({
    events: z.array(EventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
  })
  .superRefine((value, ctx) => {
    let totalPayloadChars = 0;
    value.events.forEach((event, index) => {
      if (!event.payload) return;
      const keys = Object.keys(event.payload);
      const offending = keys.find((key) =>
        FORBIDDEN_PAYLOAD_KEYS.includes(key.toLowerCase()),
      );
      if (offending) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["events", index, "payload"],
          message: "Event payloads must not include raw input values or text.",
        });
      }
      totalPayloadChars += JSON.stringify(event.payload).length;
    });
    if (totalPayloadChars > MAX_TOTAL_PAYLOAD_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["events"],
        message: "Event payload is too large.",
      });
    }
  });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const { token } = await params;
  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    return NextResponse.json(
      { error: t("interview.invalidLink") },
      { status: 400 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    // 1) Resolve the token-owned session (events stream during an OPEN session).
    const resolution = await resolveResearchEventSession(tokenParsed.data);
    if (!resolution.ok) {
      if (resolution.reason === "not_found") {
        return NextResponse.json(
          { error: t("notFound.interview") },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Event tracking is not available for this interview." },
        { status: 403 },
      );
    }
    const session = resolution.session;

    // 2) Per-study toggle: the study must have opted into event tracking.
    if (!session.plan_id) {
      return NextResponse.json(
        { error: "Event tracking is not available for this interview." },
        { status: 403 },
      );
    }
    const plan = await getResearchPlan(session.org_id, session.plan_id);
    if (!plan) {
      return NextResponse.json(
        { error: t("notFound.interview") },
        { status: 404 },
      );
    }
    if (plan.eventTrackingEnabled !== true) {
      return NextResponse.json(
        { error: "Event tracking is not enabled for this study." },
        { status: 403 },
      );
    }

    // 3) Participant consent: the EVENTS tier must be granted on this session
    //    (events_consent_at, stamped via POST /consent {purposes:['events']}).
    //    The toggle alone is NOT consent. Pre-migration the column is absent →
    //    undefined → 403. Fail-closed before any persistence.
    if (!assertCaptureConsent(session, "events")) {
      return NextResponse.json(
        { error: "Event tracking consent is missing for this session." },
        { status: 403 },
      );
    }

    const result = await ingestSessionEvents({
      session,
      events: parsed.data.events,
    });

    return NextResponse.json({
      success: true,
      eventCount: result.eventCount,
      taskResult: result.taskResult,
    });
  } catch (err) {
    console.error(
      "[events] processing failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: t("unexpected") }, { status: 500 });
  }
}
