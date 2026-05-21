import { NextResponse } from "next/server";
import { requireOrgIdOrError, getOrgName } from "@/lib/auth/org";
import { getForecast } from "@/lib/forecast/service";
import { buildForecastPdf } from "@/lib/pdf/generator";

export async function GET() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  try {
    const forecast = await getForecast(orgId);
    const orgName = await getOrgName(orgId);
    const pdf = await buildForecastPdf(forecast, orgName);

    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="findr-forecast-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to generate forecast PDF",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
