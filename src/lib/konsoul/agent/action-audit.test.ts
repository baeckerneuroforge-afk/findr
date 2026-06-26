import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Konsoul P3.0 — ACTION-AUDIT writer tests (Design-Doc §3, Review-AUFLAGE 1:
 * „Audit-No-Freetext").
 *
 * Die harte Leitplanke: `export_organization_data` dumpt JEDE Spalte von
 * `konsoul_action_log` an Org-Admins. Darum darf NIE ungerahmter Modell-Output /
 * Freitext / rationale / answer / Affekt-Label in eine Audit-Zeile driften — die
 * Tabelle hat keine solche Spalte, und `counts` ist hart auf eine Zahlen-Key-
 * Whitelist gefiltert (sanitizeCounts).
 *
 * Geprüft (zwei Linsen):
 *  1. `sanitizeCounts` (pure) — nur whitelisted Keys mit endlich-numerischem Wert
 *     überleben; Prosa/Strings/Objekte/NaN/fremde Keys fallen weg.
 *  2. das tatsächliche INSERT-Objekt von `logProposed` (über einen Fake-Supabase
 *     abgefangen) gegen eine FREITEXT-HEURISTIK: jeder String-Wert muss aus einer
 *     engen Allowlist stammen (org_id, action_type, model, model_version, status —
 *     keine Sätze/Prosa); `counts` trägt NUR erlaubte Zahlen-Keys.
 *
 * Der Anthropic-Client wird hier NICHT gebraucht (kein Modell-Pfad); nur der
 * research-Supabase wird gefaket, damit kein echter DB-Write passiert.
 */

// ── Fake research-Supabase (fängt das insert-Objekt ab) ──────────────────────

/** Das zuletzt an `.insert()` übergebene Objekt — der Prüfgegenstand. */
let lastInsert: Record<string, unknown> | null = null;
/** Erzwingt einen Insert-Fehler (für den fail-open-Test). */
let insertShouldError = false;

vi.mock("@/lib/research/db", () => ({
  createResearchSupabase: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        lastInsert = row;
        return {
          select: () => ({
            single: () =>
              Promise.resolve(
                insertShouldError
                  ? { data: null, error: { message: "boom" } }
                  : { data: { id: "audit_1" }, error: null },
              ),
          }),
        };
      },
    }),
  }),
}));

import {
  sanitizeCounts,
  logProposed,
  COUNTS_KEY_WHITELIST,
  type KonsoulCountsKey,
} from "./action-audit";

beforeEach(() => {
  lastInsert = null;
  insertShouldError = false;
});

// ── sanitizeCounts (pure) — die counts-Whitelist ─────────────────────────────

describe("sanitizeCounts — only whitelisted numeric keys survive", () => {
  it("keeps exactly the whitelisted numeric keys, drops everything else", () => {
    const out = sanitizeCounts({
      based_on_count: 12,
      completed_sessions: 5,
      affected_studies: 3,
      pool_size: 7,
      // forbidden / non-numeric — all must be dropped:
      rationale: "Das Onboarding frustriert viele Teilnehmer.",
      answer: "Du solltest die Synthese neu starten.",
      affect: "frustrated",
      sentiment: "negative",
      participant_quote: "Ich finde das schwierig",
      foreign_key: 99,
    });
    expect(out).toEqual({
      based_on_count: 12,
      completed_sessions: 5,
      affected_studies: 3,
      pool_size: 7,
    });
    // No prose/affect key leaked through.
    const keys = Object.keys(out);
    for (const k of keys) {
      expect(COUNTS_KEY_WHITELIST as readonly string[]).toContain(k);
    }
  });

  it("drops non-finite + non-number values even on whitelisted keys", () => {
    const out = sanitizeCounts({
      based_on_count: Number.NaN,
      completed_sessions: Number.POSITIVE_INFINITY,
      affected_studies: "3" as unknown as number, // string on a good key
      pool_size: { n: 7 } as unknown as number, // object on a good key
    });
    expect(out).toEqual({});
  });

  it("null / undefined / non-object input → empty object (never throws)", () => {
    expect(sanitizeCounts(null)).toEqual({});
    expect(sanitizeCounts(undefined)).toEqual({});
    expect(sanitizeCounts("oops" as unknown as Record<string, unknown>)).toEqual(
      {},
    );
  });

  it("the whitelist itself carries ONLY count-shaped numeric keys (no prose names)", () => {
    // Defense: even the constant must never grow a free-text-named key. The
    // forbidden names are matched as whole snake_case tokens (so 'affect' does
    // not collide with the legitimate 'affected_studies' count).
    const forbiddenTokens = new Set([
      "rationale",
      "answer",
      "prose",
      "text",
      "quote",
      "affect",
      "emotion",
      "sentiment",
      "label",
      "note",
      "comment",
      "summary",
    ]);
    for (const key of COUNTS_KEY_WHITELIST) {
      // count keys are short snake_case identifiers, never sentences.
      expect(key).toMatch(/^[a-z][a-z_]*$/);
      expect(key.length).toBeLessThanOrEqual(24);
      // No snake_case segment is a prose-named field.
      for (const token of key.split("_")) {
        expect(forbiddenTokens.has(token)).toBe(false);
      }
    }
  });
});

// ── logProposed — the INSERT object is metadata-only (free-text heuristic) ────

/**
 * Freitext-Heuristik: ein String-Wert gilt als „Prosa/Freitext", wenn er ein
 * Leerzeichen oder satztypische Interpunktion enthält ODER auffällig lang ist.
 * Org-Metadaten (uuid, enum-token wie 'create_study_draft'/'proposed', Modell-
 * Bezeichner wie 'claude-opus-4-8'/'konsoul-p3.1') sind kurze tokens OHNE
 * Leerzeichen → sie passieren; jede Modell-Prosa würde hier auffliegen.
 */
function looksLikeFreeText(value: string): boolean {
  if (value.length > 64) return true;
  if (/\s/.test(value)) return true; // any whitespace ⇒ a phrase, not a token
  // Sentence punctuation marks a phrase. A lone '.' is allowed because version
  // tokens (e.g. 'konsoul-p3.1') and timestamps carry dots without being prose;
  // real prose always also trips the whitespace check above.
  if (/[!?,;:„""]/.test(value)) return true;
  return false;
}

/** Welche String-Spalten die Audit-Zeile überhaupt tragen darf. */
const ALLOWED_STRING_COLUMNS = new Set([
  "id",
  "org_id",
  "plan_id",
  "action_type",
  "model",
  "model_version",
  "status",
  "proposed_at",
  "decided_at",
]);

describe("logProposed — INSERT object is metadata-only, never free text", () => {
  it("writes only whitelisted columns; every string value is a token, not prose", async () => {
    const result = await logProposed({
      orgId: "org_42",
      actionType: "run_synthesis",
      planId: "plan_7",
      model: "claude-opus-4-8",
      modelVersion: "konsoul-p3.1",
      // The caller might pass a mixed bag — sanitizeCounts must scrub it.
      counts: {
        based_on_count: 12,
        completed_sessions: 5,
        rationale: "Die Teilnehmer sind frustriert über das Onboarding.",
      },
    });
    expect(result.auditId).toBe("audit_1");
    expect(lastInsert).not.toBeNull();
    const row = lastInsert!;

    // No column outside the allowed metadata set.
    for (const key of Object.keys(row)) {
      if (key === "counts") continue;
      expect(ALLOWED_STRING_COLUMNS.has(key)).toBe(true);
    }

    // Every string value is a short token — no model prose / rationale / quote.
    for (const [key, value] of Object.entries(row)) {
      if (key === "counts") continue;
      if (typeof value === "string") {
        expect(
          looksLikeFreeText(value),
          `column '${key}' carried free text: ${value}`,
        ).toBe(false);
      }
    }

    // counts is an object carrying ONLY whitelisted numeric keys — the dropped
    // 'rationale' prose never reaches the row.
    const counts = row.counts as Record<string, unknown>;
    expect(counts).toEqual({ based_on_count: 12, completed_sessions: 5 });
    for (const k of Object.keys(counts)) {
      expect(COUNTS_KEY_WHITELIST as readonly string[]).toContain(k);
      expect(typeof counts[k]).toBe("number");
    }
    // status is the proposal marker, server-side; not from the model.
    expect(row.status).toBe("proposed");
    expect(row.action_type).toBe("run_synthesis");
    expect(row.org_id).toBe("org_42");
  });

  it("a free-text-laden counts payload is fully scrubbed to allowed keys only", async () => {
    await logProposed({
      orgId: "org_1",
      actionType: "create_study_draft",
      // entirely forbidden keys → counts must end up empty.
      counts: {
        answer: "Leg eine Studie zu Onboarding an.",
        affect_label: "negative",
        free_note: "irgendein Modell-Output",
      } as Record<string, unknown>,
    });
    const row = lastInsert!;
    expect(row.counts).toEqual({});
    // create_study_draft has no target plan → plan_id is null, not a guessed id.
    expect(row.plan_id).toBeNull();
  });

  it("fail-open: an insert error returns auditId:null and never throws (no audit gap is silent — it logs)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    insertShouldError = true;
    const result = await logProposed({
      orgId: "org_1",
      actionType: "run_personas",
      planId: "plan_9",
      model: "claude-opus-4-8",
      modelVersion: "konsoul-p3.1",
      counts: { based_on_count: 15 },
    });
    // Main path is never kipped: a null id, no throw.
    expect(result.auditId).toBeNull();
    // But the failure is loud (Sentry-or-console), never a silent audit gap.
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("the counts whitelist type is the single source — keys match the constant", () => {
    // A compile-time + runtime nail: the exported key type equals the constant.
    const keys: KonsoulCountsKey[] = [...COUNTS_KEY_WHITELIST];
    expect(keys).toEqual([
      "based_on_count",
      "completed_sessions",
      "affected_studies",
      "pool_size",
    ]);
  });
});
