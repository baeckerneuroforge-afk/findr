import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOrgIdOrError, getOrgName } from "@/lib/auth/org";
import { getForecast } from "@/lib/forecast/service";
import { buildForecastPdf } from "@/lib/pdf/generator";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locale";

export async function GET() {
  const t = await getTranslations("errors");
  const resolvedLocale = await getLocale();
  const locale: Locale = isLocale(resolvedLocale)
    ? resolvedLocale
    : DEFAULT_LOCALE;
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  try {
    const forecast = await getForecast(orgId);
    const orgName = await getOrgName(orgId);
    const pdf = await buildForecastPdf(forecast, orgName, locale);

    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="findr-forecast-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[forecast/pdf] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        error: t("forecast.pdfFailed"),
      },
      { status: 500 },
    );
  }
}
