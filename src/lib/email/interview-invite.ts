import "server-only";

import { translate } from "@/i18n/messages";
import type { Locale } from "@/i18n/locale";

/**
 * Post-loss interview invite + account check-in invite emails. Copy is sourced
 * from the message catalog (messages/{de,en}.json, namespaces email.postLoss.*
 * / email.checkin.* / email.common.*) via the direct catalog reader `translate`
 * — NOT next-intl's request-scoped t(), because these run in routes / crons
 * without a cookie. Locale defaults to "de" (DACH); callers thread it through.
 *
 * Static copy comes from the catalog; dynamic values (name, company, product,
 * org, URL) are HTML-escaped before interpolation into the HTML body.
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
  /** Buyer-facing language. Defaults to "de" (DACH) when omitted. */
  locale?: Locale;
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildInterviewInvite(params: InterviewInviteParams): BuiltEmail {
  const locale = params.locale ?? "de";
  const name = params.contactName?.trim();
  const company = params.company?.trim();
  const url = params.url;

  const tvars = { name: name ?? "", company: company ?? "", url };
  const hvars = {
    name: escapeHtml(name ?? ""),
    company: escapeHtml(company ?? ""),
    url: escapeHtml(url),
  };
  const tt = (key: string, extra: Record<string, string | number> = {}) =>
    translate(locale, key, { ...tvars, ...extra });
  const th = (key: string, extra: Record<string, string | number> = {}) =>
    translate(locale, key, { ...hvars, ...extra });

  const greetingText = name
    ? tt("email.common.greetingNamed")
    : tt("email.common.greetingPlain");
  const greetingHtml = name
    ? th("email.common.greetingNamed")
    : th("email.common.greetingPlain");

  const subject = company
    ? tt("email.postLoss.subjectWithCompany")
    : tt("email.postLoss.subject");
  const introText = company
    ? tt("email.postLoss.introWithCompany")
    : tt("email.postLoss.intro");
  const introHtml = company
    ? th("email.postLoss.introWithCompany")
    : th("email.postLoss.intro");

  const text = [
    greetingText,
    "",
    introText,
    "",
    tt("email.postLoss.body"),
    "",
    `${tt("email.postLoss.cta")}: ${url}`,
    "",
    tt("email.common.thanks"),
    tt("email.postLoss.signature"),
  ].join("\n");

  const html = `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;padding:0;background:#f5f4f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f8;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #dcdeef;border-radius:12px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#221f2a;">
          <tr><td style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#221f2a;padding-bottom:20px;">Klymeo</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:#3f3f46;">
            <p style="margin:0 0 14px;">${greetingHtml}</p>
            <p style="margin:0 0 14px;">${introHtml}</p>
            <p style="margin:0 0 22px;">${th("email.postLoss.body")}</p>
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${hvars.url}" style="display:inline-block;background:#4A51A8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">${th("email.postLoss.cta")}</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.6;color:#71717a;">
            <p style="margin:0 0 4px;">${th("email.common.linkFallback")}</p>
            <p style="margin:0 0 18px;word-break:break-all;"><a href="${hvars.url}" style="color:#4A51A8;">${hvars.url}</a></p>
            <p style="margin:0;">${th("email.common.thanks")}<br/>${th("email.postLoss.signature")}</p>
          </td></tr>
        </table>
        <p style="font-size:11px;color:#9b9ba3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:16px 0 0;">${th("email.postLoss.footer")}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

export interface CheckinInviteParams {
  contactName?: string | null;
  /** The Klymeo customer — the company in whose name the check-in is sent. */
  orgName: string;
  /** The product to check in about. */
  productName: string;
  /** Absolute interview URL (build via interviewUrl()). */
  url: string;
  /** Buyer-facing language. Defaults to "de" (DACH) when omitted. */
  locale?: Locale;
}

/**
 * Builds the account check-in invitation email — friendly, short, in the Klymeo
 * CUSTOMER's name (not Klymeo), and transparent that the chat is run by an AI
 * assistant. Locale defaults to "de" (DACH). Distinct from the post-loss invite.
 */
export function buildCheckinInvite(params: CheckinInviteParams): BuiltEmail {
  const locale = params.locale ?? "de";
  const name = params.contactName?.trim();
  const org =
    params.orgName.trim() || translate(locale, "email.common.orgFallback");
  const product =
    params.productName.trim() ||
    translate(locale, "email.checkin.productFallback");
  const url = params.url;

  const tvars = { name: name ?? "", org, product, url };
  const hvars = {
    name: escapeHtml(name ?? ""),
    org: escapeHtml(org),
    product: escapeHtml(product),
    url: escapeHtml(url),
  };
  const tt = (key: string, extra: Record<string, string | number> = {}) =>
    translate(locale, key, { ...tvars, ...extra });
  const th = (key: string, extra: Record<string, string | number> = {}) =>
    translate(locale, key, { ...hvars, ...extra });

  const greetingText = name
    ? tt("email.common.greetingNamed")
    : tt("email.common.greetingPlain");
  const greetingHtml = name
    ? th("email.common.greetingNamed")
    : th("email.common.greetingPlain");

  const subject = tt("email.checkin.subject");

  const text = [
    greetingText,
    "",
    tt("email.checkin.intro"),
    "",
    tt("email.checkin.body"),
    "",
    `${tt("email.checkin.cta")}: ${url}`,
    "",
    tt("email.common.thanks"),
    tt("email.common.signatureOrg"),
  ].join("\n");

  const html = `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;padding:0;background:#f5f4f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f8;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #dcdeef;border-radius:12px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#221f2a;">
          <tr><td style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#221f2a;padding-bottom:20px;">${hvars.org}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:#3f3f46;">
            <p style="margin:0 0 14px;">${greetingHtml}</p>
            <p style="margin:0 0 14px;">${th("email.checkin.intro")}</p>
            <p style="margin:0 0 22px;">${th("email.checkin.body")}</p>
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${hvars.url}" style="display:inline-block;background:#4A51A8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">${th("email.checkin.cta")}</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.6;color:#71717a;">
            <p style="margin:0 0 4px;">${th("email.common.linkFallback")}</p>
            <p style="margin:0 0 18px;word-break:break-all;"><a href="${hvars.url}" style="color:#4A51A8;">${hvars.url}</a></p>
            <p style="margin:0;">${th("email.common.thanks")}<br/>${th("email.common.signatureOrg")}</p>
          </td></tr>
        </table>
        <p style="font-size:11px;color:#9b9ba3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:16px 0 0;">${th("email.checkin.footer")}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
