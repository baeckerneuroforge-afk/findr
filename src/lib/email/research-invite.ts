import "server-only";

import type { EmailAttachment } from "./resend";

/**
 * Research-interview invitation + reminder emails (German by default — same
 * DACH posture as the post-loss interview + account-checkin invites). The
 * tone matches buildCheckinInvite: short, transparent that it's a KI-driven
 * research interview, no marketing.
 *
 * Mode-agnostic by design — text / voice / video share the same copy. The
 * mode lives on research_invites.mode_preference and only changes what the
 * /interview/[token] page renders, never the invite copy.
 *
 * Duration default of 30 minutes is a Findr-side product choice (short
 * research interviews, not deep customer calls). If a per-plan duration is
 * later added to research_plans, the orchestration passes it through.
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateDe(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatTimeDe(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
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
}

const DEFAULT_DURATION_MINUTES = 30;

export function buildResearchInvite(
  params: ResearchInviteParams,
): BuiltEmail {
  const name = params.contactName?.trim();
  const org = params.orgName.trim() || "uns";
  const date = formatDateDe(params.scheduledAt);
  const time = formatTimeDe(params.scheduledAt);
  const minutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const url = params.url;

  const greeting = name ? `Guten Tag ${name},` : "Guten Tag,";
  const subject = `Research-Interview am ${date}`;

  const text = [
    greeting,
    "",
    `wir von ${org} laden Sie herzlich zu einem kurzen Research-Interview ein. Termin: ${date} um ${time} Uhr (Europe/Berlin), Dauer ca. ${minutes} Minuten.`,
    "",
    "Das Interview wird von unserem KI-Assistenten geführt — vertraulich, keine Verkaufsmasche. Sie können bequem über Ihren Browser teilnehmen, kein Login nötig.",
    "",
    `Im Anhang dieser Mail finden Sie eine Kalender-Einladung (.ics) zum direkten Import.`,
    "",
    `Zum Interview: ${url}`,
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
            <p style="margin:0 0 14px;">wir von ${escapeHtml(org)} laden Sie herzlich zu einem kurzen <strong>Research-Interview</strong> ein.</p>
            <p style="margin:0 0 14px;">
              <strong>Termin:</strong> ${escapeHtml(date)}, ${escapeHtml(time)} Uhr (Europe/Berlin)<br/>
              <strong>Dauer:</strong> ca. ${minutes} Minuten<br/>
              <strong>Format:</strong> über Ihren Browser — kein Login nötig
            </p>
            <p style="margin:0 0 22px;">Das Interview wird von unserem <strong>KI-Assistenten</strong> geführt — vertraulich, keine Verkaufsmasche. Im Anhang finden Sie eine Kalender-Einladung (.ics) zum direkten Import.</p>
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${escapeHtml(url)}" style="display:inline-block;background:#5B2FD4;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">Zum Interview</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.6;color:#71717a;">
            <p style="margin:0 0 4px;">Falls der Button nicht funktioniert, nutzen Sie diesen Link:</p>
            <p style="margin:0 0 18px;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#5B2FD4;">${escapeHtml(url)}</a></p>
            <p style="margin:0;">Vielen Dank für Ihre Zeit.<br/>Ihr Team von ${escapeHtml(org)}</p>
          </td></tr>
        </table>
        <p style="font-size:11px;color:#9b9ba3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:16px 0 0;">Vertraulich · KI-gestütztes Research-Interview</p>
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
  const name = params.contactName?.trim();
  const org = params.orgName.trim() || "uns";
  const date = formatDateDe(params.scheduledAt);
  const time = formatTimeDe(params.scheduledAt);
  const minutes = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const url = params.url;

  const greeting = name ? `Guten Tag ${name},` : "Guten Tag,";
  const leadCopy =
    params.kind === "24h"
      ? `kurze Erinnerung: morgen, ${date} um ${time} Uhr, findet unser Research-Interview statt.`
      : `kurze Erinnerung: in etwa einer Stunde (${time} Uhr) findet unser Research-Interview statt.`;

  const subject =
    params.kind === "24h"
      ? `Morgen: Research-Interview um ${time} Uhr`
      : `In Kürze: Research-Interview um ${time} Uhr`;

  const text = [
    greeting,
    "",
    leadCopy,
    "",
    `Dauer: ca. ${minutes} Minuten. KI-geführt, über den Browser, kein Login nötig.`,
    "",
    `Zum Interview: ${url}`,
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
            <p style="margin:0 0 14px;">${escapeHtml(leadCopy)}</p>
            <p style="margin:0 0 22px;">Dauer ca. ${minutes} Minuten, KI-geführt, über Ihren Browser.</p>
          </td></tr>
          <tr><td style="padding-bottom:24px;">
            <a href="${escapeHtml(url)}" style="display:inline-block;background:#5B2FD4;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">Zum Interview</a>
          </td></tr>
          <tr><td style="font-size:13px;line-height:1.6;color:#71717a;">
            <p style="margin:0 0 4px;">Falls der Button nicht funktioniert, nutzen Sie diesen Link:</p>
            <p style="margin:0 0 18px;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#5B2FD4;">${escapeHtml(url)}</a></p>
            <p style="margin:0;">Vielen Dank für Ihre Zeit.<br/>Ihr Team von ${escapeHtml(org)}</p>
          </td></tr>
        </table>
        <p style="font-size:11px;color:#9b9ba3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:16px 0 0;">Erinnerung · KI-gestütztes Research-Interview</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

// ── ICS calendar attachment ─────────────────────────────────────────────────

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
