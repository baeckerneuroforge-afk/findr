import "server-only";

import type { EmailAttachment } from "./resend";
import { translate } from "@/i18n/messages";
import { toBcp47, type Locale } from "@/i18n/locale";

/**
 * Research-interview invitation + reminder emails. Copy is sourced from the
 * message catalog (messages/{de,en}.json, namespace email.research.*) via the
 * direct catalog reader `translate` — NOT next-intl's request-scoped t(),
 * because these run in cron / route handlers without a cookie. The locale comes
 * from research_invites.language (threaded through invite-orchestration.ts).
 *
 * Static copy comes from the catalog; DYNAMIC values (org name, URL) are
 * HTML-escaped before interpolation into the HTML body (see htmlVars). Dates /
 * times are locale-aware via Intl in Europe/Berlin (the business timezone),
 * NOT in the catalog.
 *
 * Mode-agnostic by design — text / voice / video share the same copy.
 *
 * Duration default of 30 minutes is a Findr-side product choice. If a per-plan
 * duration is later added to research_plans, the orchestration passes it
 * through.
 */

/** Resolve the app's public base URL — same logic as interview-invite.ts.
 *  Keep these in sync if the resolution rules change. */
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

export function researchInterviewUrl(accessToken: string): string {
  return `${appBaseUrl()}/interview/${accessToken}`;
}

/** Öffentliche URL eines offenen Studien-Links (Phase 4, Baustein 2). Spiegelt
 *  researchInterviewUrl, aber unter dem physisch getrennten Open-Pfad. Die Route
 *  /interview/open/[token] selbst landet erst in Etappe 3 — hier wird die URL nur
 *  fürs Dashboard-Teilen gebaut (gleiche zentrale Env-Auflösung). */
export function researchOpenLinkUrl(accessToken: string): string {
  return `${appBaseUrl()}/interview/open/${accessToken}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toBcp47(locale), {
    timeZone: "Europe/Berlin",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(toBcp47(locale), {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

export interface ResearchInviteParams {
  contactName: string | null;
  /** The Findr customer running the research (vendor side). */
  orgName: string;
  scheduledAt: Date;
  /** Length of the interview window. Default 30 minutes — used for the ICS
   *  DTEND and the human-readable copy. */
  durationMinutes?: number;
  /** Absolute /interview/[token] URL. */
  url: string;
  /** Buyer-facing language. Defaults to "de" (DACH) when omitted. */
  locale?: Locale;
  /**
   * White-label branding for the Findr customer. When unset (or fields null)
   * the mail falls back to today's behavior: org-name text header, #4A51A8 CTA.
   * accentColor is re-validated inside the builder before use; logoUrl is an
   * absolute Supabase public URL (required for email clients).
   */
  branding?: {
    brandName: string | null;
    accentColor: string | null;
    logoUrl: string | null;
  };
}

const DEFAULT_DURATION_MINUTES = 30;

export function buildResearchInvite(params: ResearchInviteParams): BuiltEmail {
  const locale = params.locale ?? "de";
  const name = params.contactName?.trim();
  const org =
    params.orgName.trim() || translate(locale, "email.common.orgFallback");
  const date = formatDate(params.scheduledAt, locale);
  const time = formatTime(params.scheduledAt, locale);
  const minutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const url = params.url;

  // Validate the accent inline (never import the server-only branding-assets
  // module here). Fall back to today's #4A51A8 when unset / malformed.
  const accent =
    params.branding?.accentColor &&
    /^#[0-9A-Fa-f]{6}$/.test(params.branding.accentColor)
      ? params.branding.accentColor
      : "#4A51A8";
  // Header: logo > brand name > org name (today's behavior).
  const brandName = params.branding?.brandName?.trim();
  const logoUrl = params.branding?.logoUrl;
  const headerHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName || org)}" style="max-height:40px;display:block;"/>`
    : escapeHtml(brandName || org);

  // Raw values for the plain-text part; HTML-escaped values for the HTML part.
  const tvars = { name: name ?? "", org, date, time, minutes, url };
  const hvars = {
    name: escapeHtml(name ?? ""),
    org: escapeHtml(org),
    date: escapeHtml(date),
    time: escapeHtml(time),
    minutes,
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

  const subject = tt("email.research.invite.subject");

  const text = [
    greetingText,
    "",
    tt("email.research.invite.intro"),
    "",
    tt("email.research.invite.whenLine"),
    tt("email.research.invite.durationLine"),
    tt("email.research.invite.formatLine"),
    "",
    tt("email.research.invite.aiDisclaimer"),
    tt("email.research.invite.icsNote"),
    "",
    `${tt("email.research.invite.cta")}: ${url}`,
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
          <tr><td style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#221f2a;padding-bottom:20px;">${headerHtml}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:#3f3f46;">
            <p style="margin:0 0 14px;">${greetingHtml}</p>
            <p style="margin:0 0 14px;">${th("email.research.invite.intro")}</p>
            <p style="margin:0 0 14px;">
              ${th("email.research.invite.whenLine")}<br/>
              ${th("email.research.invite.durationLine")}<br/>
              ${th("email.research.invite.formatLine")}
            </p>
            <p style="margin:0 0 22px;">${th("email.research.invite.aiDisclaimer")} ${th("email.research.invite.icsNote")}</p>
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${hvars.url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">${th("email.research.invite.cta")}</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.6;color:#71717a;">
            <p style="margin:0 0 4px;">${th("email.common.linkFallback")}</p>
            <p style="margin:0 0 18px;word-break:break-all;"><a href="${hvars.url}" style="color:${accent};">${hvars.url}</a></p>
            <p style="margin:0;">${th("email.common.thanks")}<br/>${th("email.common.signatureOrg")}</p>
          </td></tr>
        </table>
        <p style="font-size:11px;color:#9b9ba3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:16px 0 0;">${th("email.research.invite.footer")}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

/** Reminder variant — same recipient + URL, copy differs by lead-time. */
export type ResearchReminderKind = "24h" | "1h";

export interface ResearchReminderParams extends ResearchInviteParams {
  kind: ResearchReminderKind;
}

export function buildResearchReminder(
  params: ResearchReminderParams,
): BuiltEmail {
  const locale = params.locale ?? "de";
  const name = params.contactName?.trim();
  const org =
    params.orgName.trim() || translate(locale, "email.common.orgFallback");
  const date = formatDate(params.scheduledAt, locale);
  const time = formatTime(params.scheduledAt, locale);
  const minutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const url = params.url;

  // Validate the accent inline (never import the server-only branding-assets
  // module here). Fall back to today's #4A51A8 when unset / malformed.
  const accent =
    params.branding?.accentColor &&
    /^#[0-9A-Fa-f]{6}$/.test(params.branding.accentColor)
      ? params.branding.accentColor
      : "#4A51A8";
  // Header: logo > brand name > org name (today's behavior).
  const brandName = params.branding?.brandName?.trim();
  const logoUrl = params.branding?.logoUrl;
  const headerHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName || org)}" style="max-height:40px;display:block;"/>`
    : escapeHtml(brandName || org);

  const tvars = { name: name ?? "", org, date, time, minutes, url };
  const hvars = {
    name: escapeHtml(name ?? ""),
    org: escapeHtml(org),
    date: escapeHtml(date),
    time: escapeHtml(time),
    minutes,
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

  const subjectKey =
    params.kind === "24h"
      ? "email.research.reminder.subject24h"
      : "email.research.reminder.subject1h";
  const leadKey =
    params.kind === "24h"
      ? "email.research.reminder.lead24h"
      : "email.research.reminder.lead1h";

  const subject = tt(subjectKey);

  const text = [
    greetingText,
    "",
    tt(leadKey),
    "",
    tt("email.research.reminder.body"),
    "",
    `${tt("email.research.reminder.cta")}: ${url}`,
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
          <tr><td style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#221f2a;padding-bottom:20px;">${headerHtml}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:#3f3f46;">
            <p style="margin:0 0 14px;">${greetingHtml}</p>
            <p style="margin:0 0 14px;">${th(leadKey)}</p>
            <p style="margin:0 0 22px;">${th("email.research.reminder.body")}</p>
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${hvars.url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">${th("email.research.reminder.cta")}</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.6;color:#71717a;">
            <p style="margin:0 0 4px;">${th("email.common.linkFallback")}</p>
            <p style="margin:0 0 18px;word-break:break-all;"><a href="${hvars.url}" style="color:${accent};">${hvars.url}</a></p>
            <p style="margin:0;">${th("email.common.thanks")}<br/>${th("email.common.signatureOrg")}</p>
          </td></tr>
        </table>
        <p style="font-size:11px;color:#9b9ba3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:16px 0 0;">${th("email.research.reminder.footer")}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

// ── ICS calendar attachment ─────────────────────────────────────────────────
//
// buildIcs assembles the RFC 5545 structure only; the human-visible SUMMARY /
// DESCRIPTION copy is resolved from the catalog by the caller
// (invite-orchestration.ts) so it can localize per invite. PRODID's trailing
// language tag is technical metadata, not user-facing copy, so it stays static.

function icsTimestamp(date: Date): string {
  // YYYYMMDDTHHmmssZ — strip ms and separators from ISO, force UTC.
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcsText(s: string): string {
  // RFC 5545 §3.3.11: backslash, semicolon, comma escaped; newlines as \\n.
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export interface IcsAttachmentParams {
  /** Stable per-invite identifier (research_invite id is the natural choice). */
  uid: string;
  /** ORG name of the sender — used as the calendar PRODID label. */
  orgName: string;
  /** What appears as the event title in the recipient's calendar. */
  summary: string;
  /** Body text in the event — the public interview URL belongs here. */
  description: string;
  scheduledAt: Date;
  durationMinutes?: number;
  url: string;
}

/**
 * Builds an RFC 5545 VCALENDAR + VEVENT for the research interview, suitable
 * for attachment to the invite mail. METHOD:REQUEST so receiving clients
 * surface it as a calendar invitation rather than a plain event.
 *
 * Output is a complete ICS string (CRLF line endings as the RFC requires).
 * Pass it via EmailAttachment as the `content`, with
 * contentType: "text/calendar; charset=utf-8; method=REQUEST".
 */
export function buildIcs(params: IcsAttachmentParams): string {
  const minutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const dtStart = icsTimestamp(params.scheduledAt);
  const dtEnd = icsTimestamp(
    new Date(params.scheduledAt.getTime() + minutes * 60_000),
  );
  const dtStamp = icsTimestamp(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeIcsText(params.orgName)}//Research Interview//DE`,
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(params.summary)}`,
    `DESCRIPTION:${escapeIcsText(params.description)}`,
    `URL:${params.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

export function buildResearchIcsAttachment(
  params: IcsAttachmentParams,
): EmailAttachment {
  return {
    filename: "research-interview.ics",
    content: buildIcs(params),
    contentType: "text/calendar; charset=utf-8; method=REQUEST",
  };
}
