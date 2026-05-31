import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

/**
 * Findr Voice — Etappe-1-Ende-zu-Ende-Smoke gegen die ECHTEN HTTP-Routes.
 *
 * Beweist genau die Verifikationsziele aus dem Plan:
 *   - jede Zuordnung → richtige Engine-Ausgabe (engine = health|risk|discovery)
 *   - "inbox" → pending im Posteingang
 *   - assign → routet (status = assigned)
 *   - Idempotenz: gleicher externalMeetingId → idempotent, kein zweiter Lauf
 *
 * Voraussetzungen (André, NACH dem Anwenden der Migration):
 *   1. Migration 20260627000000_voice_ingest.sql angewendet (SQL-Editor)
 *   2. Token: pnpm voice:token <orgId>
 *   3. Server läuft als PROD-Build (NICHT next dev): `pnpm build && pnpm start`
 *      ODER eine Vercel-Preview-URL. Anthropic-/Supabase-Keys müssen serverseitig
 *      gesetzt sein (die Engines laufen echt → echte Opus/Sonnet-Calls).
 *   4. Org hat mind. 1 Account / Deal / Research-Plan (für die Routing-Fälle).
 *
 * Lauf:
 *   BASE_URL=http://localhost:3000 VOICE_TOKEN=fv_xxx pnpm voice:smoke
 */

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.VOICE_TOKEN;

if (!TOKEN) {
  console.error("VOICE_TOKEN fehlt. Erst `pnpm voice:token <orgId>` ausführen.");
  process.exit(1);
}

const RUN = Date.now();
const TRANSCRIPT = [
  "Sprecher A (Findr): Schön, dass es heute klappt. Wie läuft es mit dem Rollout?",
  "Sprecher B (Kunde): Ehrlich gesagt zäh. Unser interner Champion hat das Team verlassen,",
  "und das Budget für nächstes Jahr steht auf der Kippe. Ein Wettbewerber hat auch angeklopft.",
  "Sprecher A (Findr): Verstanden. Lassen Sie uns die offenen Punkte durchgehen.",
  "Sprecher B (Kunde): Wichtig wäre uns eine bessere Reporting-Funktion und SSO.",
].join("\n");

type Json = Record<string, unknown>;
const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅ PASS" : "❌ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

async function post(path: string, body: Json): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, json };
}

async function get(path: string): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, json };
}

function ingestBody(externalMeetingId: string, assignment: Json): Json {
  return {
    transcriptText: TRANSCRIPT,
    externalMeetingId,
    recordedAt: new Date(RUN).toISOString(),
    durationSeconds: 900,
    assignment,
  };
}

async function main() {
  // 0) Auth + Ziele entdecken.
  const targets = await get("/api/voice/targets");
  if (targets.status !== 200) {
    record("auth + GET /api/voice/targets", false, `status ${targets.status} ${JSON.stringify(targets.json)}`);
    return finish();
  }
  const accounts = (targets.json.accounts as { id: string }[]) ?? [];
  const deals = (targets.json.deals as { id: string }[]) ?? [];
  const plans = (targets.json.plans as { id: string }[]) ?? [];
  record(
    "auth + GET /api/voice/targets",
    true,
    `accounts=${accounts.length} deals=${deals.length} plans=${plans.length}`,
  );

  // 1) Bestandskunde → health
  if (accounts[0]) {
    const r = await post("/api/voice/ingest", ingestBody(`smoke-${RUN}-health`, { kind: "existing_customer", accountId: accounts[0].id }));
    record(
      "ingest existing_customer → engine=health",
      r.status === 200 && r.json.status === "routed" && r.json.engine === "health",
      `status ${r.status} engine=${r.json.engine}`,
    );
  } else {
    record("ingest existing_customer → engine=health", true, "SKIP: kein Account in der Org");
  }

  // 2) Sales-Call → risk
  if (deals[0]) {
    const r = await post("/api/voice/ingest", ingestBody(`smoke-${RUN}-risk`, { kind: "sales_call", dealId: deals[0].id }));
    record(
      "ingest sales_call → engine=risk",
      r.status === 200 && r.json.status === "routed" && r.json.engine === "risk",
      `status ${r.status} engine=${r.json.engine}`,
    );
  } else {
    record("ingest sales_call → engine=risk", true, "SKIP: kein Deal in der Org");
  }

  // 3) Discovery → discovery
  if (plans[0]) {
    const r = await post("/api/voice/ingest", ingestBody(`smoke-${RUN}-disc`, { kind: "discovery", planId: plans[0].id }));
    record(
      "ingest discovery → engine=discovery",
      r.status === 200 && r.json.status === "routed" && r.json.engine === "discovery",
      `status ${r.status} engine=${r.json.engine}`,
    );
  } else {
    record("ingest discovery → engine=discovery", true, "SKIP: kein Research-Plan in der Org");
  }

  // 4) inbox → pending, dann assign → routet
  const inboxExt = `smoke-${RUN}-inbox`;
  const ing = await post("/api/voice/ingest", ingestBody(inboxExt, { kind: "inbox" }));
  const inboxId = ing.json.inboxId as string | undefined;
  record(
    "ingest inbox → status=pending",
    ing.status === 200 && ing.json.status === "pending" && Boolean(inboxId),
    `status ${ing.status} inboxId=${inboxId}`,
  );

  const list = await get("/api/voice/inbox");
  const items = (list.json.items as { id: string }[]) ?? [];
  record(
    "GET /api/voice/inbox enthält das pending-Item",
    list.status === 200 && items.some((i) => i.id === inboxId),
    `items=${items.length}`,
  );

  if (inboxId) {
    const target =
      (accounts[0] && { kind: "existing_customer", accountId: accounts[0].id }) ||
      (deals[0] && { kind: "sales_call", dealId: deals[0].id }) ||
      (plans[0] && { kind: "discovery", planId: plans[0].id });
    if (target) {
      const a = await post(`/api/voice/inbox/${inboxId}/assign`, { assignment: target });
      record(
        "assign pending-Item → status=assigned + Engine lief",
        a.status === 200 && a.json.status === "assigned" && Boolean(a.json.engine),
        `status ${a.status} engine=${a.json.engine}`,
      );
    } else {
      record("assign pending-Item → status=assigned", true, "SKIP: kein Ziel zum Zuordnen");
    }
  }

  // 5) Idempotenz: derselbe externalMeetingId ein zweites Mal → idempotent, kein neuer Lauf.
  const idemExt = `smoke-${RUN}-idem`;
  await post("/api/voice/ingest", ingestBody(idemExt, { kind: "inbox" }));
  const second = await post("/api/voice/ingest", ingestBody(idemExt, { kind: "inbox" }));
  record(
    "Idempotenz: zweiter Ingest mit gleichem externalMeetingId",
    second.status === 200 && second.json.idempotent === true,
    `idempotent=${second.json.idempotent}`,
  );

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} Checks grün.`);
  if (failed.length > 0) {
    console.log("Fehlgeschlagen: " + failed.map((f) => f.name).join("; "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
