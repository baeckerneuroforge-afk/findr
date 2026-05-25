import "server-only";

/**
 * Builds the post-loss interview invitation email (German by default — the buyer
 * context is DACH). Polite, short, serious; no marketing noise.
 */

/** Resolve the app's public base URL for absolute links in emails. */
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

/** Public, login-free interview URL for a session's access token. */
export function interviewUrl(accessToken: string): string {
  return `${appBaseUrl()}/interview/${accessToken}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface InterviewInviteParams {
  contactName?: string | null;
  company?: string | null;
  /** Absolute interview URL (build via interviewUrl()). */
  url: string;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildInterviewInvite(params: InterviewInviteParams): BuiltEmail {
  const name = params.contactName?.trim();
  const company = params.company?.trim();
  const url = params.url;

  const greeting = name ? `Guten Tag ${name},` : "Guten Tag,";
  const companyPhrase = company ? ` mit ${company}` : "";
  const subject = company
    ? `Kurzes Feedback zu ${company}?`
    : "Kurzes, ehrliches Feedback?";

  const text = [
    greeting,
    "",
    `schade, dass es zwischen uns${companyPhrase} nicht geklappt hat — wir möchten daraus lernen.`,
    "",
    "Wenn Sie 2 Minuten haben, würden wir uns sehr über kurzes, ehrliches Feedback freuen: was am Ende den Ausschlag gegeben hat. Ein kurzer, vertraulicher Chat — keine Verkaufsmasche.",
    "",
    `Feedback geben: ${url}`,
    "",
    "Vielen Dank für Ihre Zeit.",
    "Ihr Findr-Team",
  ].join("\n");

  const html = `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#f5f4f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f8;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #e8e4f2;border-radius:12px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0e0a1f;">
          <tr><td style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#0e0a1f;padding-bottom:20px;">findr<span style="color:#b00;">.</span></td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:#3f3f46;">
            <p style="margin:0 0 14px;">${escapeHtml(greeting)}</p>
            <p style="margin:0 0 14px;">schade, dass es zwischen uns${escapeHtml(companyPhrase)} nicht geklappt hat — wir möchten daraus lernen.</p>
            <p style="margin:0 0 22px;">Wenn Sie <strong>2 Minuten</strong> haben, würden wir uns sehr über kurzes, ehrliches Feedback freuen: was am Ende den Ausschlag gegeben hat. Ein kurzer, vertraulicher Chat — keine Verkaufsmasche.</p>
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${escapeHtml(url)}" style="display:inline-block;background:#5B2FD4;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">Feedback geben</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.6;color:#71717a;">
            <p style="margin:0 0 4px;">Falls der Button nicht funktioniert, nutzen Sie diesen Link:</p>
            <p style="margin:0 0 18px;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#5B2FD4;">${escapeHtml(url)}</a></p>
            <p style="margin:0;">Vielen Dank für Ihre Zeit.<br/>Ihr Findr-Team</p>
          </td></tr>
        </table>
        <p style="font-size:11px;color:#9b9ba3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:16px 0 0;">Vertraulich · Powered by findr.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

export interface CheckinInviteParams {
  contactName?: string | null;
  /** The Findr customer — the company in whose name the check-in is sent. */
  orgName: string;
  /** The product to check in about. */
  productName: string;
  /** Absolute interview URL (build via interviewUrl()). */
  url: string;
}

/**
 * Builds the account check-in invitation email — friendly, short, in the Findr
 * CUSTOMER's name (not findr.), and transparent that the chat is run by an AI
 * assistant. German by default (DACH). Distinct from the post-loss invite.
 */
export function buildCheckinInvite(params: CheckinInviteParams): BuiltEmail {
  const name = params.contactName?.trim();
  const org = params.orgName.trim() || "uns";
  const product = params.productName.trim() || "Ihrem Produkt";
  const url = params.url;

  const greeting = name ? `Guten Tag ${name},` : "Guten Tag,";
  const subject = `Kurzer Check-in zu ${product}`;

  const text = [
    greeting,
    "",
    `wir von ${org} möchten kurz hören, wie es mit ${product} läuft — sind Sie zufrieden, hakt irgendwo etwas, läuft die Nutzung wie geplant?`,
    "",
    "Ein kurzer, vertraulicher Chat mit unserem KI-Assistenten — etwa 2 Minuten, keine Verkaufsmasche.",
    "",
    `Check-in starten: ${url}`,
    "",
    "Vielen Dank für Ihre Zeit.",
    `Ihr Team von ${org}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#f5f4f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f8;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #e8e4f2;border-radius:12px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0e0a1f;">
          <tr><td style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#0e0a1f;padding-bottom:20px;">${escapeHtml(org)}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:#3f3f46;">
            <p style="margin:0 0 14px;">${escapeHtml(greeting)}</p>
            <p style="margin:0 0 14px;">wir von ${escapeHtml(org)} möchten kurz hören, wie es mit <strong>${escapeHtml(product)}</strong> läuft — sind Sie zufrieden, hakt irgendwo etwas, läuft die Nutzung wie geplant?</p>
            <p style="margin:0 0 22px;">Ein kurzer, vertraulicher Chat mit unserem <strong>KI-Assistenten</strong> — etwa 2 Minuten, keine Verkaufsmasche.</p>
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${escapeHtml(url)}" style="display:inline-block;background:#5B2FD4;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">Check-in starten</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.6;color:#71717a;">
            <p style="margin:0 0 4px;">Falls der Button nicht funktioniert, nutzen Sie diesen Link:</p>
            <p style="margin:0 0 18px;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#5B2FD4;">${escapeHtml(url)}</a></p>
            <p style="margin:0;">Vielen Dank für Ihre Zeit.<br/>Ihr Team von ${escapeHtml(org)}</p>
          </td></tr>
        </table>
        <p style="font-size:11px;color:#9b9ba3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:16px 0 0;">Vertraulich · KI-gestützter Check-in</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
