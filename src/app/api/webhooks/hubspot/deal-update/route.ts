import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { processClosedLost, reconstructRequestUrl } from "./helpers";

const HubspotEventSchema = z.object({
  eventType: z.string().optional(),
  objectId: z.union([z.string(), z.number()]).transform(String),
  propertyName: z.string().optional(),
  propertyValue: z.string().optional(),
});

const HubspotWebhookSchema = z.union([
  z.object({ events: z.array(HubspotEventSchema) }),
  z.array(HubspotEventSchema),
]);

function getEvents(payload: z.infer<typeof HubspotWebhookSchema>) {
  return Array.isArray(payload) ? payload : payload.events;
}

function isClosedLostStage(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  return normalized === "closedlost";
}

const HUBSPOT_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Verify a HubSpot v3 webhook signature:
 *   base64(HMAC-SHA256(clientSecret, method + uri + rawBody + timestamp))
 * plus a 5-minute freshness window for replay protection, compared in constant
 * time.
 */
function isValidHubspotSignature(params: {
  secret: string;
  signature: string | null;
  timestamp: string | null;
  method: string;
  uri: string;
  rawBody: string;
}): boolean {
  const { secret, signature, timestamp, method, uri, rawBody } = params;
  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (
    !Number.isFinite(ts) ||
    Math.abs(Date.now() - ts) > HUBSPOT_SIGNATURE_MAX_AGE_MS
  ) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(method + uri + rawBody + timestamp, "utf8")
    .digest("base64");

  const expectedBuf = Buffer.from(expected);
  const presentedBuf = Buffer.from(signature);
  if (expectedBuf.length !== presentedBuf.length) return false;
  return timingSafeEqual(expectedBuf, presentedBuf);
}

export async function POST(request: Request) {
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret) {
    // Fail closed: this public endpoint mutates deal state, spends LLM budget
    // and fires Slack alerts — it must never run without its verification
    // secret configured.
    console.error(
      "[hubspot webhook] HUBSPOT_CLIENT_SECRET is not set — rejecting request.",
    );
    return NextResponse.json(
      { error: "Webhook verification is not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  if (
    !isValidHubspotSignature({
      secret,
      signature: request.headers.get("x-hubspot-signature-v3"),
      timestamp: request.headers.get("x-hubspot-request-timestamp"),
      method: "POST",
      uri: reconstructRequestUrl(request),
      rawBody,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = HubspotWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const results: Array<{ objectId: string; processed: boolean; reason?: string }> =
    [];

  for (const event of getEvents(parsed.data)) {
    if (
      event.propertyName === "dealstage" &&
      isClosedLostStage(event.propertyValue)
    ) {
      const result = await processClosedLost(event.objectId);
      results.push({ objectId: event.objectId, ...result });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
