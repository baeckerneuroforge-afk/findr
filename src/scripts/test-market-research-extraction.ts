/**
 * M1 verification — the MARKET LENS vs the DISCOVERY LENS on one transcript.
 *
 * The whole point of Phase M1 (docs/findr-market-research-separation-plan.md
 * §1–§2, §5) is that the product-discovery extraction prompt ACTIVELY DISCARDS
 * market signal — pricing / willingness-to-pay, competitor perception, general
 * attitude / brand — exactly the signal a market study wants to KEEP. M0 built
 * the market lens (prompt + schema + categories) but wired it to nothing; M1
 * switches the classifier to it for study_type='market_research' plans.
 *
 * This script proves the lens difference empirically: it runs BOTH classifiers
 * over the SAME fake DACH market interview (a respondent with NO product
 * relationship, talking only about price / a competitor / an unmet segment need
 * / purchase triggers / brand impression). Expected:
 *   - MARKET lens  → coded findings across PRICE_SENSITIVITY / PURCHASE_INTENT
 *                    / COMPETITIVE_PERCEPTION / SEGMENT_NEED / BRAND_PERCEPTION,
 *                    each grounded in a verbatim respondent quote.
 *   - DISCOVERY lens → little or nothing (this transcript has no product
 *                    feedback), or items it had to force into a SaaS-product
 *                    category — i.e. the market signal is dropped or distorted.
 *
 * It imports the two CLASSIFIERS directly (not the service), for the same
 * reason test-product-discovery-e2e.ts does: the service module transitively
 * pulls in the Clerk → next/navigation chain that tsx can't load. The
 * classifiers import only schemas + the anthropic client, so they run cleanly
 * under --conditions=react-server. No DB write — this is a pure lens comparison.
 *
 * Costs TWO real Opus calls. Invoke from the repo root:
 *
 *   env -u ANTHROPIC_API_KEY \
 *     pnpm exec tsx --conditions=react-server \
 *     src/scripts/test-market-research-extraction.ts
 */

import { config as loadEnv } from "dotenv";

// A fake market-research interview. DACH B2C concept test for a healthy
// meal-prep subscription. The RESPONDENT uses no such product today — every
// substantive line is market signal (price / competitor / segment / intent /
// brand), NOT product feedback. This is precisely the content the discovery
// prompt is told to "Skip".
const FAKE_MARKET_TRANSCRIPT = `
Interviewer: Danke, dass Sie sich Zeit nehmen. Wir erforschen gerade, wie Berufstätige in der Stadt sich unter der Woche ernähren. Erzählen Sie doch mal — wie läuft das bei Ihnen?

Befragte: Ehrlich gesagt chaotisch. Ich arbeite Vollzeit, hab zwei kleine Kinder, und abends fehlt mir komplett die Energie, noch frisch zu kochen. Meistens wird's dann doch wieder die Tiefkühlpizza oder ich bestell was.

Interviewer: Und Kochboxen oder Liefer-Abos — haben Sie sowas schon mal genutzt?

Befragte: Ich hab mal HelloFresh probiert. Das Essen war okay, aber ehrlich, mir war das auf Dauer zu kompliziert — dieses ganze Schnippeln und dreißig Minuten am Herd stehen, das ist genau das, wofür ich keine Zeit habe. Bei einer Freundin läuft Marley Spoon, die schwärmt davon, aber für mich ist das dasselbe Problem.

Interviewer: Verstehe. Angenommen, es gäbe ein Abo mit fertig vorgekochten, nur-noch-aufwärmen-Gerichten, frisch und gesund — wäre das was für Sie?

Befragte: Oh, das klingt schon eher nach was für mich. Wenn ich das nur noch in die Mikrowelle stellen müsste und es wäre trotzdem frisch und nicht so ein Fertigfraß — ja, da würde ich sofort eine Probewoche bestellen, um das zu testen. Ausschlaggebend wäre für mich wirklich: null Aufwand und es muss gesund sein.

Interviewer: Lassen Sie uns über den Preis sprechen. Was wäre Ihnen sowas wert?

Befragte: Also für fünf Abendessen die Woche... mehr als so 50, 55 Euro pro Woche würde ich dafür nie ausgeben, das wäre dann teurer als mein normaler Einkauf. So um die 8 bis 10 Euro pro Portion ist die Schmerzgrenze. Wenn das Richtung 15 Euro pro Mahlzeit geht, bin ich sofort raus, dann koch ich lieber selbst.

Interviewer: Und gibt es aus Ihrer Sicht eine Gruppe, die mit dem heutigen Angebot schlecht bedient wird?

Befragte: Total. Für uns berufstätige Eltern gibt es einfach nichts Passendes. Alles ist entweder auf Singles ausgelegt, die Spaß am Kochen haben, oder es ist ungesundes Fast Food. Der ganze Markt ignoriert Familien, die schnell UND gesund wollen.

Interviewer: Kennen Sie eigentlich die Marke "FrischFertig"? Wir nennen sie hier nur als Beispiel.

Befragte: Nee, nie gehört. Sagt mir gar nichts. Aber der Name klingt erstmal vertrauenswürdig, so ein bisschen nach Drogerie-Eigenmarke ehrlich gesagt — günstig und solide, nicht premium. Wenn da jetzt was Hochpreisiges käme, würde mich der Name eher abschrecken.

Interviewer: Sehr hilfreich. Gibt es noch etwas, das Ihnen wichtig wäre?

Befragte: Flexibilität beim Pausieren wäre schön, weil wir oft spontan bei den Großeltern essen. Aber das ist Detail. Das Hauptthema ist und bleibt: bezahlbar, gesund, und ich will dafür nicht kochen müssen.
`.trim();

function fmtItems(
  label: string,
  items: Array<{
    category: string;
    title: string;
    intensity?: string;
    severity?: string;
    confidence: number;
    evidence: string[];
  }>,
): void {
  console.log(`${label} (${items.length}):`);
  if (items.length === 0) {
    console.log("  (none)");
    return;
  }
  items.forEach((it, i) => {
    const strength = it.intensity ?? it.severity ?? "—";
    console.log(
      `  ${i} [${it.category}] strength=${strength} conf=${it.confidence.toFixed(2)}`,
    );
    console.log(`    title: ${it.title}`);
    if (it.evidence[0]) console.log(`    ev:    "${it.evidence[0]}"`);
  });
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local" });
  loadEnv();

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Run with: env -u ANTHROPIC_API_KEY pnpm exec tsx --conditions=react-server src/scripts/test-market-research-extraction.ts",
    );
  }

  console.log("=".repeat(78));
  console.log("M1 LENS COMPARISON — same transcript, two lenses");
  console.log("=".repeat(78));
  console.log(`transcript: ${FAKE_MARKET_TRANSCRIPT.length} chars`);
  console.log(
    "content: pure market signal (price / competitor / segment / intent / brand),",
  );
  console.log("         a respondent with NO product relationship.");

  const study = {
    subject: "Konzept: gesundes Aufwärm-Abendessen-Abo (Probe-Konzepttest)",
    market: "Berufstätige Eltern in deutschen Großstädten",
    orgName: "Klymeo Research",
  };

  // ── MARKET LENS (the M1 path) ──────────────────────────────────────────────
  console.log("");
  console.log("─".repeat(78));
  console.log("MARKET lens — analyzeMarketResearch (real Opus call #1)");
  console.log("─".repeat(78));
  const { analyzeMarketResearch, DEFAULT_MARKET_RESEARCH_MODEL } = await import(
    "@/lib/market-research/classifier"
  );
  const mrModel =
    process.env.MARKET_RESEARCH_MODEL ?? DEFAULT_MARKET_RESEARCH_MODEL;
  console.log(`  model: ${mrModel}`);
  let t0 = Date.now();
  const market = await analyzeMarketResearch({
    transcript: FAKE_MARKET_TRANSCRIPT,
    study,
  });
  console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("");
  fmtItems("MARKET FINDINGS", market.findings);
  console.log("");
  console.log(`  respondentRole:    ${market.respondentRole ?? "(null)"}`);
  console.log(`  respondentSegment: ${market.respondentSegment ?? "(null)"}`);
  console.log(`  sentiment:         ${market.sentiment}`);
  console.log(`  summary:           ${market.summary}`);

  // ── DISCOVERY LENS (the default path — what M1 leaves untouched) ───────────
  console.log("");
  console.log("─".repeat(78));
  console.log("DISCOVERY lens — analyzeProductDiscovery (real Opus call #2)");
  console.log("─".repeat(78));
  const { analyzeProductDiscovery, DEFAULT_PRODUCT_DISCOVERY_MODEL } =
    await import("@/lib/product-discovery/classifier");
  const pdModel =
    process.env.PRODUCT_DISCOVERY_MODEL ?? DEFAULT_PRODUCT_DISCOVERY_MODEL;
  console.log(`  model: ${pdModel}`);
  t0 = Date.now();
  const discovery = await analyzeProductDiscovery({
    transcript: FAKE_MARKET_TRANSCRIPT,
  });
  console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("");
  fmtItems("FEATURE REQUESTS", discovery.featureRequests);
  console.log("");
  fmtItems("PAIN POINTS", discovery.painPoints);

  // ── Verdict ────────────────────────────────────────────────────────────────
  const marketCats = new Set<string>(market.findings.map((f) => f.category));
  const expectedMarketCats = [
    "PRICE_SENSITIVITY",
    "PURCHASE_INTENT",
    "COMPETITIVE_PERCEPTION",
    "SEGMENT_NEED",
    "BRAND_PERCEPTION",
  ];
  const hitCats = expectedMarketCats.filter((c) => marketCats.has(c));
  const discoveryCount =
    discovery.featureRequests.length + discovery.painPoints.length;

  console.log("");
  console.log("=".repeat(78));
  console.log("VERDICT");
  console.log("=".repeat(78));
  console.log(
    `  MARKET lens kept ${market.findings.length} findings across ${hitCats.length}/5 market categories:`,
  );
  console.log(`    present: ${hitCats.join(", ") || "(none)"}`);
  const missing = expectedMarketCats.filter((c) => !marketCats.has(c));
  if (missing.length) console.log(`    absent:  ${missing.join(", ")}`);
  console.log(
    `  DISCOVERY lens kept ${discoveryCount} item(s) — market signal it must classify as SaaS product feedback or drop.`,
  );
  console.log("");
  if (hitCats.length >= 3 && marketCats.has("PRICE_SENSITIVITY")) {
    console.log(
      "  ✅ PASS — the market lens captures price/intent/segment/brand signal the discovery lens is built to discard.",
    );
  } else {
    console.log(
      "  ⚠️  REVIEW — market lens captured fewer market categories than expected; inspect the findings above.",
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("");
  console.error("LENS COMPARISON FAILED:");
  console.error(err);
  process.exit(1);
});
