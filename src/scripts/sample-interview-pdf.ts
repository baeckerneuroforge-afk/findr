/**
 * Generate a sample "Post-Loss Interview Report" PDF from mock data — no server,
 * no DB, no Claude call. Used to eyeball layout + verify German umlauts render.
 *
 * The generator imports "server-only", so run with the react-server condition:
 *   pnpm exec tsx --conditions=react-server src/scripts/sample-interview-pdf.ts
 *
 * Writes to /tmp/klymeo-interview-report-sample.pdf.
 */

import { writeFileSync } from "node:fs";

import { buildInterviewReportPdf } from "@/lib/pdf/interview-report";

async function main(): Promise<void> {
  const pdf = await buildInterviewReportPdf({
    locale: "de",
    deal: {
      name: "Q2 Renewal",
      company: "Nordwind Logistik GmbH",
      stage: "closed_lost",
      amount: 64000,
      currency: "EUR",
      contactName: "Anna Berg",
      contactEmail: "anna.berg@nordwind-logistik.de",
      contactPhone: "+49 151 23456789",
    },
    interview: {
      extractedReason: "champion_lost",
      evidence:
        "Unser Geschäftsführer, der das Projekt vorangetrieben hat, hat das Unternehmen verlassen — danach gab es niemanden mehr, der für die Lösung gekämpft hat.",
      matchedRiskPrediction: "yes",
      reasoning:
        "Klymeos Risk-Analyse sagte einen Champion-Verlust voraus, und das Interview bestätigt es: Der interne Fürsprecher ging, und ohne ihn fehlte die Priorität. Preis und Präsentation waren ausdrücklich nicht das Problem.",
      conversation: [
        {
          role: "agent",
          text: "Hallo Frau Berg, danke, dass Sie sich kurz Zeit nehmen. Dürfte ich fragen, was am Ende den Ausschlag gegeben hat, dass es mit uns nicht weiterging?",
        },
        {
          role: "customer",
          text: "Ehrlich gesagt war es eine Mischung. Das Timing war schwierig, und intern hat sich einiges verändert.",
        },
        {
          role: "agent",
          text: "Das verstehe ich. Wenn Sie sagen, intern hat sich einiges verändert — was meinen Sie da konkret?",
        },
        {
          role: "customer",
          text: "Unser Geschäftsführer, der das Projekt vorangetrieben hat, hat das Unternehmen verlassen. Danach gab es niemanden mehr, der für die Lösung gekämpft hat.",
        },
        {
          role: "agent",
          text: "Das ergibt Sinn — vielen Dank für Ihre Offenheit, das hilft uns wirklich weiter. Ich wünsche Ihnen alles Gute für die nächsten Schritte!",
        },
      ],
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
  });

  const out = "/tmp/klymeo-interview-report-sample.pdf";
  writeFileSync(out, pdf);
  console.log(`Wrote ${pdf.length} bytes to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
