import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/csp-report — sink for Content-Security-Policy-Report-Only
 * violation reports (see headers() in next.config.ts).
 *
 * Browsers POST here credential-less with content type
 * `application/csp-report`. The route is intentionally unauthenticated (the
 * browser cannot attach auth) and write-nothing: it logs a compact one-liner
 * to the server log (= Vercel logs) and returns 204. That log stream is the
 * basis for promoting the Report-Only policy to an enforcing CSP.
 *
 * Abuse surface is bounded: body capped at 16 KB, no DB, no LLM, no echo of
 * the payload back to the client.
 */

const MAX_REPORT_BYTES = 16_384;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = await request.text();
    if (raw.length === 0 || raw.length > MAX_REPORT_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    const parsed = JSON.parse(raw) as {
      "csp-report"?: Record<string, unknown>;
    };
    const report = parsed["csp-report"];
    if (report && typeof report === "object") {
      console.warn(
        "[csp-report]",
        JSON.stringify({
          directive:
            report["effective-directive"] ?? report["violated-directive"],
          blocked: report["blocked-uri"],
          document: report["document-uri"],
          source: report["source-file"],
          line: report["line-number"],
        }),
      );
    }
  } catch {
    // Malformed reports are noise, not an error condition.
  }
  return new NextResponse(null, { status: 204 });
}
