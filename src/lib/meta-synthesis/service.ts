import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ResearchPlanStudyType } from "@/lib/research/db";
import {
  MetaSynthesisResultSchema,
  type MetaSynthesisResult,
} from "@/lib/schemas/meta-synthesis";
import type { Database, Json } from "@/types/database";

/**
 * Persistence for meta_synthesis (migration 20260726000000) — the read/write seam
 * between the engine and the DB. Mirrors mission-control/engine.ts's self-
 * contained admin client: until src/types/database.ts is regenerated post-
 * migration, the new table's row is declared INLINE so supabase-js narrows the
 * org-scoped reads/writes. Object-literal types, not Partial<Row> — same rationale
 * as chat-with-data.ts / mission-control.ts.
 *
 * Service-role client bypasses RLS, so EVERY read filters by org_id and EVERY
 * write sets it — the org-scoped trust boundary is enforced here, exactly like
 * loadOrgSyntheses.
 */

export class MetaSynthesisPersistenceError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "MetaSynthesisPersistenceError";
  }
}

// ── Point-in-time study snapshot (labels survive a source-study rename/delete) ─

export interface MetaSynthesisStudyRef {
  studyId: string;
  studyTitle: string;
  basedOnCount: number;
  studyType?: ResearchPlanStudyType;
}

// ── Persisted-row view + summary ─────────────────────────────────────────────

export interface MetaSynthesisRecord {
  id: string;
  orgId: string;
  title: string;
  /** plan_ids of the compared studies. */
  sourceStudyIds: string[];
  focus: string | null;
  result: MetaSynthesisResult;
  basedOn: MetaSynthesisStudyRef[];
  model: string | null;
  createdAt: string;
}

/** List-row view — no result JSONB (the list never renders the body). */
export interface MetaSynthesisSummary {
  id: string;
  title: string;
  studyCount: number;
  createdAt: string;
}

// ── Inline DB augmentation (new table, not yet in generated types) ───────────

type MetaSynthesisRow = {
  id: string;
  org_id: string;
  title: string;
  source_study_ids: Json;
  focus: string | null;
  result: Json;
  based_on: Json;
  model: string | null;
  created_at: string;
};

/** Insert shape — id + created_at are DB-defaulted, so they are omitted. */
type MetaSynthesisInsert = {
  org_id: string;
  title: string;
  source_study_ids: Json;
  focus: string | null;
  result: Json;
  based_on: Json;
  model: string | null;
};

type DatabaseWithMeta = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] & {
      meta_synthesis: {
        Row: MetaSynthesisRow;
        Insert: MetaSynthesisInsert;
        Update: Partial<MetaSynthesisInsert>;
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};

function createMetaSynthesisSupabase(): SupabaseClient<DatabaseWithMeta> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new MetaSynthesisPersistenceError(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Required for admin reads/writes.",
    );
  }
  return createClient<DatabaseWithMeta>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Defensive coercion (legacy/partial JSONB never crashes a read) ───────────

function coerceStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function coerceStudyRefs(value: unknown): MetaSynthesisStudyRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.studyId !== "string") return [];
    return [
      {
        studyId: e.studyId,
        studyTitle:
          typeof e.studyTitle === "string" ? e.studyTitle : e.studyId,
        basedOnCount:
          typeof e.basedOnCount === "number" ? e.basedOnCount : 0,
        studyType: e.studyType as ResearchPlanStudyType | undefined,
      },
    ];
  });
}

/** Never throws — a malformed/partial result JSONB renders an empty artifact
 *  rather than a 500 (same posture as normalizeEmergentThemes). */
function coerceResult(value: unknown): MetaSynthesisResult {
  const parsed = MetaSynthesisResultSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return {
    overview: "",
    convergent_themes: [],
    divergences: [],
    study_contributions: [],
    interpretation: "",
  };
}

function rowToRecord(row: MetaSynthesisRow): MetaSynthesisRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    title: row.title,
    sourceStudyIds: coerceStringArray(row.source_study_ids),
    focus: row.focus,
    result: coerceResult(row.result),
    basedOn: coerceStudyRefs(row.based_on),
    model: row.model,
    createdAt: row.created_at,
  };
}

// ── Write ────────────────────────────────────────────────────────────────────

export interface SaveMetaSynthesisInput {
  orgId: string;
  title: string;
  sourceStudyIds: string[];
  focus?: string | null;
  result: MetaSynthesisResult;
  basedOn: MetaSynthesisStudyRef[];
  model: string;
}

export async function saveMetaSynthesis(
  input: SaveMetaSynthesisInput,
): Promise<MetaSynthesisRecord> {
  const supabase = createMetaSynthesisSupabase();
  const { data, error } = await supabase
    .from("meta_synthesis")
    .insert({
      org_id: input.orgId,
      title: input.title,
      source_study_ids: input.sourceStudyIds as unknown as Json,
      focus: input.focus ?? null,
      result: input.result as unknown as Json,
      based_on: input.basedOn as unknown as Json,
      model: input.model,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new MetaSynthesisPersistenceError(
      "Failed to persist meta-synthesis",
      error,
    );
  }
  return rowToRecord(data);
}

// ── Read ───────────────────────────────────────────────────────────────────

/** Load one artifact, org-scoped. Null when not found / not in this org (never
 *  leaks existence cross-org — the caller 404s). */
export async function getMetaSynthesis(
  orgId: string,
  id: string,
): Promise<MetaSynthesisRecord | null> {
  const supabase = createMetaSynthesisSupabase();
  const { data, error } = await supabase
    .from("meta_synthesis")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToRecord(data);
}

/** List the org's artifacts, newest first — id/title/count only (no body). */
export async function listMetaSyntheses(
  orgId: string,
): Promise<MetaSynthesisSummary[]> {
  const supabase = createMetaSynthesisSupabase();
  const { data, error } = await supabase
    .from("meta_synthesis")
    .select("id, title, source_study_ids, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    studyCount: coerceStringArray(row.source_study_ids).length,
    createdAt: row.created_at,
  }));
}
