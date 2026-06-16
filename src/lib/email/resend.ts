import "server-only";

import { Resend } from "resend";

/**
 * Thin Resend wrapper. Lazily initialized so a missing RESEND_API_KEY only fails
 * when an email is actually sent (with a clear message) — never at import.
 */

export class EmailError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "EmailError";
  }
}

let _client: Resend | null = null;

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailError(
      "RESEND_API_KEY is not set — cannot send email. Add it to your environment.",
    );
  }
  if (!_client) _client = new Resend(apiKey);
  return _client;
}

/**
 * Sender address from INTERVIEW_FROM_EMAIL (a Resend-verified-domain address).
 *
 * In PRODUCTION this is required: without it we refuse to send rather than fall
 * back to Resend's shared sandbox sender ("onboarding@resend.dev"), which can
 * only deliver to the account owner — so participant invites / check-in mails
 * would silently never arrive. Failing loud here surfaces in the route error and
 * (post-B2) in the check-in cron summary. Local dev keeps the sandbox sender so
 * you can test without verifying a domain.
 */
export function defaultFrom(): string {
  const configured = process.env.INTERVIEW_FROM_EMAIL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new EmailError(
      "INTERVIEW_FROM_EMAIL is not set — refusing to send from the Resend sandbox sender in production (external recipients are rejected). Set it to a verified-domain address.",
    );
  }
  return "onboarding@resend.dev";
}

/** One file attachment (ICS calendar, PDF, etc.). `content` is the raw
 *  bytes — supabase-js / Resend will base64-encode for transport.
 *  `contentType` defaults to "application/octet-stream" if omitted; for
 *  ICS use "text/calendar; charset=utf-8; method=REQUEST" so mail clients
 *  treat the file as a calendar invitation. */
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  /** Optional. Existing callers (interview / checkin invites) pass
   *  no attachments — that branch keeps working identically. */
  attachments?: EmailAttachment[];
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<{ id: string }> {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: params.from ?? defaultFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachments?.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
  });

  if (error) {
    throw new EmailError(
      `Resend could not send the email: ${error.message ?? "unknown error"}`,
      error,
    );
  }
  if (!data?.id) {
    throw new EmailError("Resend returned no message id.");
  }
  return { id: data.id };
}
