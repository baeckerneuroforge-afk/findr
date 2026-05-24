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
 * Sender address. Defaults to Resend's shared test sender, which works without
 * verifying a domain. Set INTERVIEW_FROM_EMAIL to send from your own verified
 * domain.
 */
export function defaultFrom(): string {
  return process.env.INTERVIEW_FROM_EMAIL ?? "onboarding@resend.dev";
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
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
