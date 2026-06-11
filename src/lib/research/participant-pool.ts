import "server-only";

import {
  createResearchSupabase,
  type ParticipantPoolRow,
  type ResearchPlanQuotaRow,
} from "./db";
import { createResearchInvite } from "./research-orchestration";

/**
 * Service für den org-weiten Teilnehmer-Pool + deterministisches Screening.
 *
 * Spiegelt das Read/Write-Muster von plans-service.ts / scheduling.ts: typed
 * service-role-Client, IMMER org-scoped (der orgId-Parameter ist die
 * Vertrauensgrenze — die Route authentifiziert vorher via requireOrgIdOrError).
 *
 * KERNPRINZIP — kein paralleler Invite-Datenpfad: `inviteFromPool` legt KEINE
 * research_invites-Zeile selbst an, sondern ruft den bestehenden kanonischen
 * Pfad `createResearchInvite` auf (derselbe, den die manuelle + die CSV-Bulk-
 * Route nutzen) und schreibt danach nur die Verknüpfungszeile in
 * participant_pool_invites. Token-Generierung, Spalten-Defaults und Plan-
 * Ownership-Check leben damit weiterhin an genau einer Stelle.
 *
 * Dedup auf zwei Ebenen, beide deterministisch:
 *   - Pool-Stamm: Email case-insensitive unique pro Org (DB-Index, 23505).
 *   - Einladen aus Pool: pro Plan höchstens einmal je Pool-Person
 *     (participant_pool_invites unique(plan_id, pool_member_id)) UND die
 *     bestehende Email-Dedup-Regel des Invite-Pfads (gleiche Email auf
 *     demselben Plan wird übersprungen).
 */

const UNIQUE_VIOLATION = "23505";

// ── Pool-Record-Shape ─────────────────────────────────────────────────────────

export interface PoolMemberRecord {
  id: string;
  contactLabel: string;
  contactEmail: string | null;
  role: string | null;
  segment: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
}

function toMember(row: ParticipantPoolRow): PoolMemberRecord {
  return {
    id: row.id,
    contactLabel: row.contact_label,
    contactEmail: row.contact_email,
    role: row.role,
    segment: row.segment,
    tags: row.tags ?? [],
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export interface PoolFilter {
  role?: string | null;
  segment?: string | null;
  /** Tag-Filter: Treffer, wenn die Person MINDESTENS einen dieser Tags hat
   *  (Array-Überlappung). Leeres Array = kein Tag-Filter. */
  tags?: string[];
}

/**
 * Pool dieser Org, neueste zuerst, optional gefiltert nach role/segment/tags.
 * Gibt [] bei Fehler zurück (liest in der UI als "Pool leer" — sicheres
 * Degradieren, der Nutzer kann neu laden).
 */
export async function listPoolMembers(
  orgId: string,
  filter: PoolFilter = {},
): Promise<PoolMemberRecord[]> {
  const supabase = createResearchSupabase();
  let query = supabase
    .from("participant_pool")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (filter.role) query = query.eq("role", filter.role);
  if (filter.segment) query = query.eq("segment", filter.segment);
  if (filter.tags && filter.tags.length > 0) {
    query = query.overlaps("tags", filter.tags);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(toMember);
}

/**
 * Anzahl der Pool-Personen dieser Org (optional gefiltert) — head-count, OHNE
 * die Rows zu laden. Für reine Zähler-Anzeigen (z.B. das alle 30s
 * auto-refreshende Dashboard) statt listPoolMembers(...).length. 0 bei Fehler.
 */
export async function countPoolMembers(
  orgId: string,
  filter: PoolFilter = {},
): Promise<number> {
  const supabase = createResearchSupabase();
  let query = supabase
    .from("participant_pool")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if (filter.role) query = query.eq("role", filter.role);
  if (filter.segment) query = query.eq("segment", filter.segment);
  if (filter.tags && filter.tags.length > 0) {
    query = query.overlaps("tags", filter.tags);
  }

  const { count, error } = await query;
  if (error || count === null) return 0;
  return count;
}

export async function getPoolMember(
  orgId: string,
  memberId: string,
): Promise<PoolMemberRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("participant_pool")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", memberId)
    .maybeSingle();
  if (error || !data) return null;
  return toMember(data);
}

/**
 * Pool-Personen-IDs, die bereits aus dem Pool in DIESEN Plan eingeladen
 * wurden. Powert das "schon eingeladen"-Disabling in der Invite-Surface.
 */
export async function listInvitedPoolMemberIds(
  orgId: string,
  planId: string,
): Promise<string[]> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("participant_pool_invites")
    .select("pool_member_id")
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  if (error || !data) return [];
  return data.map((r) => r.pool_member_id);
}

// ── Writes (CRUD) ───────────────────────────────────────────────────────────

export interface PoolMemberInput {
  contactLabel: string;
  contactEmail?: string | null;
  role?: string | null;
  segment?: string | null;
  tags?: string[];
  notes?: string | null;
}

export type CreatePoolMemberResult =
  | { status: "created"; member: PoolMemberRecord }
  | { status: "duplicate_email"; member: null }
  | { status: "error"; member: null; message: string };

export async function createPoolMember(
  orgId: string,
  input: PoolMemberInput,
): Promise<CreatePoolMemberResult> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("participant_pool")
    .insert({
      org_id: orgId,
      contact_label: input.contactLabel,
      contact_email: input.contactEmail ?? null,
      role: input.role ?? null,
      segment: input.segment ?? null,
      tags: input.tags ?? [],
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { status: "duplicate_email", member: null };
    }
    console.error(`[createPoolMember] insert failed for org ${orgId}:`, error.message);
    return { status: "error", member: null, message: "Pool-Eintrag konnte nicht angelegt werden." };
  }
  return { status: "created", member: toMember(data) };
}

export type UpdatePoolMemberResult =
  | { status: "updated"; member: PoolMemberRecord }
  | { status: "not_found"; member: null }
  | { status: "duplicate_email"; member: null }
  | { status: "error"; member: null; message: string };

/**
 * Partial-Update — nur Schlüssel, die in `input` gesetzt sind, werden
 * geschrieben (omitting contactLabel darf es NICHT leeren). `null` ist ein
 * legitimer Wert (Feld leeren). Leeres Input degradiert zum Re-Read.
 */
export async function updatePoolMember(
  orgId: string,
  memberId: string,
  input: Partial<PoolMemberInput>,
): Promise<UpdatePoolMemberResult> {
  const update: {
    contact_label?: string;
    contact_email?: string | null;
    role?: string | null;
    segment?: string | null;
    tags?: string[];
    notes?: string | null;
  } = {};
  if (input.contactLabel !== undefined) update.contact_label = input.contactLabel;
  if (input.contactEmail !== undefined) update.contact_email = input.contactEmail;
  if (input.role !== undefined) update.role = input.role;
  if (input.segment !== undefined) update.segment = input.segment;
  if (input.tags !== undefined) update.tags = input.tags;
  if (input.notes !== undefined) update.notes = input.notes;

  if (Object.keys(update).length === 0) {
    const existing = await getPoolMember(orgId, memberId);
    return existing
      ? { status: "updated", member: existing }
      : { status: "not_found", member: null };
  }

  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("participant_pool")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", memberId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { status: "duplicate_email", member: null };
    }
    console.error(`[updatePoolMember] update failed for ${memberId}:`, error.message);
    return { status: "error", member: null, message: "Pool-Eintrag konnte nicht aktualisiert werden." };
  }
  if (!data) return { status: "not_found", member: null };
  return { status: "updated", member: toMember(data) };
}

/** Hard-delete einer Pool-Person. CASCADE entfernt participant_pool_invites-
 *  Verknüpfungen automatisch; die research_invites-Zeilen selbst bleiben
 *  erhalten (sie sind unabhängige Studien-Artefakte). Returns true, wenn eine
 *  Zeile gelöscht wurde. */
export async function deletePoolMember(
  orgId: string,
  memberId: string,
): Promise<boolean> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("participant_pool")
    .delete()
    .eq("org_id", orgId)
    .eq("id", memberId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`[deletePoolMember] delete failed for ${memberId}:`, error.message);
    return false;
  }
  return !!data;
}

// ── CSV-Import ────────────────────────────────────────────────────────────────

export type ImportPoolMemberStatus =
  | "created"
  | "duplicate_in_file"
  | "duplicate_in_pool"
  | "error";

export interface ImportPoolMemberResult {
  contactLabel: string;
  contactEmail: string | null;
  status: ImportPoolMemberStatus;
  member?: PoolMemberRecord;
  message?: string;
}

export interface ImportPoolResult {
  results: ImportPoolMemberResult[];
  summary: { created: number; skipped: number; errors: number; total: number };
}

/**
 * Bulk-Anlage für den CSV-Import. Bewusst ein Per-Row-Loop über das
 * bestehende `createPoolMember` statt eines Batch-Inserts: der Email-Dedup
 * ist ein PARTIELLER FUNKTIONALER Unique-Index ((org_id, lower(contact_email))
 * WHERE contact_email IS NOT NULL), den PostgREST-`onConflict` nicht
 * adressieren kann — und ein nacktes Batch-`.insert([...])` bräche beim
 * ersten 23505 komplett ab. Der Loop hält außerdem genau EINEN Schreibpfad
 * (dieselbe 23505→duplicate_email-Übersetzung wie die Einzel-Anlage).
 *
 * Dedup-Semantik:
 *   - DB-Index bleibt autoritativ (Races eingeschlossen) → duplicate_in_pool.
 *   - seenEmails unterscheidet nur die MELDUNG: eine Email, die in dieser
 *     Datei bereits erfolgreich angelegt wurde → duplicate_in_file (ohne
 *     DB-Roundtrip). Mehrfach-Zeilen einer Email, die schon im Pool war,
 *     melden konsistent duplicate_in_pool (aktionabler für den Nutzer).
 *   - Zeilen ohne Email werden nie dedupliziert (Pool-Semantik, wie überall).
 *
 * Ergebnisse in Eingabe-Reihenfolge; created-Einträge tragen den vollen
 * PoolMemberRecord, damit der Client sie ohne Refresh in seinen State mergen
 * kann (das Manager-State-Modell ist nach Mount autoritativ).
 */
export async function importPoolMembers(
  orgId: string,
  inputs: PoolMemberInput[],
): Promise<ImportPoolResult> {
  const results: ImportPoolMemberResult[] = [];
  const seenEmails = new Set<string>();
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const input of inputs) {
    const normalizedEmail = input.contactEmail?.trim().toLowerCase() ?? null;

    if (normalizedEmail && seenEmails.has(normalizedEmail)) {
      results.push({
        contactLabel: input.contactLabel,
        contactEmail: input.contactEmail ?? null,
        status: "duplicate_in_file",
      });
      skipped++;
      continue;
    }

    const result = await createPoolMember(orgId, input);
    switch (result.status) {
      case "created":
        if (normalizedEmail) seenEmails.add(normalizedEmail);
        results.push({
          contactLabel: input.contactLabel,
          contactEmail: input.contactEmail ?? null,
          status: "created",
          member: result.member,
        });
        created++;
        break;
      case "duplicate_email":
        results.push({
          contactLabel: input.contactLabel,
          contactEmail: input.contactEmail ?? null,
          status: "duplicate_in_pool",
        });
        skipped++;
        break;
      default:
        results.push({
          contactLabel: input.contactLabel,
          contactEmail: input.contactEmail ?? null,
          status: "error",
          message: result.message,
        });
        errors++;
        break;
    }
  }

  return {
    results,
    summary: { created, skipped, errors, total: results.length },
  };
}

// ── Aus Pool einladen ─────────────────────────────────────────────────────────

export type InviteFromPoolItemStatus =
  | "invited"
  | "already_invited"
  | "skipped_duplicate"
  | "not_found"
  | "error";

export interface InviteFromPoolItemResult {
  poolMemberId: string;
  contactLabel: string;
  status: InviteFromPoolItemStatus;
  inviteId?: string;
  message?: string;
}

export interface InviteFromPoolResult {
  results: InviteFromPoolItemResult[];
  summary: { invited: number; skipped: number; errors: number; total: number };
}

/**
 * Lädt ausgewählte Pool-Personen in einen Plan ein. Erzeugt jede Einladung
 * über `createResearchInvite` (bestehender Pfad — kein paralleler Schreibweg)
 * und verknüpft sie via participant_pool_invites. Reihenfolge der Ergebnisse
 * folgt der Eingabe-Reihenfolge.
 *
 * Dedup: bereits aus dem Pool in diesen Plan eingeladene Personen
 * (participant_pool_invites) → already_invited; Personen, deren Email schon
 * als Invite auf dem Plan existiert (case-insensitive, auch innerhalb dieses
 * Batches) → skipped_duplicate. Damit verhält sich der Pool-Pfad exakt wie
 * der bestehende Bulk-Invite-Pfad.
 */
export async function inviteFromPool(
  orgId: string,
  planId: string,
  poolMemberIds: string[],
): Promise<InviteFromPoolResult> {
  const empty: InviteFromPoolResult = {
    results: [],
    summary: { invited: 0, skipped: 0, errors: 0, total: 0 },
  };
  // De-dupe die Eingabe-IDs unter Beibehaltung der Reihenfolge.
  const ids = [...new Set(poolMemberIds)];
  if (ids.length === 0) return empty;

  const supabase = createResearchSupabase();

  // Pool-Personen laden (org-scoped).
  const { data: memberRows } = await supabase
    .from("participant_pool")
    .select("*")
    .eq("org_id", orgId)
    .in("id", ids);
  const memberById = new Map<string, ParticipantPoolRow>(
    (memberRows ?? []).map((m) => [m.id, m]),
  );

  // Bereits aus dem Pool in diesen Plan eingeladene Personen.
  const alreadyInvited = new Set(await listInvitedPoolMemberIds(orgId, planId));

  // Bestehende Invite-Emails auf diesem Plan (gleiche Dedup wie Bulk-Route).
  const { data: existingInviteRows } = await supabase
    .from("research_invites")
    .select("contact_email")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .not("contact_email", "is", null);
  const existingEmails = new Set(
    (existingInviteRows ?? [])
      .map((r) => r.contact_email?.trim().toLowerCase())
      .filter((e): e is string => !!e),
  );
  const seenEmails = new Set<string>();

  const results: InviteFromPoolItemResult[] = [];
  let invited = 0;
  let skipped = 0;
  let errors = 0;

  for (const id of ids) {
    const member = memberById.get(id);
    if (!member) {
      results.push({ poolMemberId: id, contactLabel: id, status: "not_found" });
      errors++;
      continue;
    }
    if (alreadyInvited.has(id)) {
      results.push({
        poolMemberId: id,
        contactLabel: member.contact_label,
        status: "already_invited",
        message: "Bereits aus dem Pool in diese Studie eingeladen.",
      });
      skipped++;
      continue;
    }
    const normalizedEmail = member.contact_email?.trim().toLowerCase() ?? null;
    if (normalizedEmail && (existingEmails.has(normalizedEmail) || seenEmails.has(normalizedEmail))) {
      results.push({
        poolMemberId: id,
        contactLabel: member.contact_label,
        status: "skipped_duplicate",
        message: "Diese E-Mail existiert bereits als Teilnehmer in dieser Studie.",
      });
      skipped++;
      continue;
    }

    // Bestehender kanonischer Invite-Pfad — KEINE direkte research_invites-
    // Schreiboperation hier.
    const invite = await createResearchInvite({
      orgId,
      planId,
      contactLabel: member.contact_label,
      contactEmail: member.contact_email,
      modePreference: "text",
    });

    if (invite.status !== "created" || !invite.inviteId) {
      results.push({
        poolMemberId: id,
        contactLabel: member.contact_label,
        status: "error",
        message: invite.message ?? "Einladung konnte nicht erstellt werden.",
      });
      errors++;
      continue;
    }

    // Verknüpfung schreiben. Schlägt nur in einem echten Race fehl (das
    // unique(plan_id, pool_member_id) griff zwischen Vorab-Check und Insert).
    const { error: linkError } = await supabase
      .from("participant_pool_invites")
      .insert({
        org_id: orgId,
        pool_member_id: id,
        plan_id: planId,
        invite_id: invite.inviteId,
      });
    if (linkError) {
      console.error(
        `[inviteFromPool] link insert failed for member ${id} on plan ${planId}:`,
        linkError.message,
      );
      results.push({
        poolMemberId: id,
        contactLabel: member.contact_label,
        status: "error",
        message: "Einladung erstellt, aber Pool-Verknüpfung fehlgeschlagen.",
      });
      errors++;
      continue;
    }

    alreadyInvited.add(id);
    if (normalizedEmail) {
      existingEmails.add(normalizedEmail);
      seenEmails.add(normalizedEmail);
    }
    results.push({
      poolMemberId: id,
      contactLabel: member.contact_label,
      status: "invited",
      inviteId: invite.inviteId,
    });
    invited++;
  }

  return {
    results,
    summary: { invited, skipped, errors, total: results.length },
  };
}

// ── Quoten (Screening) ────────────────────────────────────────────────────────

export interface QuotaProgressRecord {
  id: string;
  role: string;
  target: number;
  /** Anzahl aus dem Pool in diese Studie eingeladener Personen mit dieser
   *  Rolle. Manuell/CSV angelegte (ungescreente) Invites zählen NICHT mit. */
  invited: number;
}

function toQuotaBase(row: ResearchPlanQuotaRow): Omit<QuotaProgressRecord, "invited"> {
  return { id: row.id, role: row.role, target: row.target };
}

/**
 * Quoten einer Studie inkl. Fortschritt. Fortschritt = Anzahl Pool-
 * Einladungen je Rolle, deterministisch aus participant_pool_invites ⋈
 * participant_pool.role berechnet (zwei kleine Queries statt PostgREST-Embed,
 * weil die augmented-Types keine Relationship deklarieren). [] bei Fehler.
 */
export async function listQuotaProgress(
  orgId: string,
  planId: string,
): Promise<QuotaProgressRecord[]> {
  const supabase = createResearchSupabase();
  const { data: quotaRows, error } = await supabase
    .from("research_plan_quotas")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .order("role", { ascending: true });
  if (error || !quotaRows || quotaRows.length === 0) return [];

  // Rollen der aus dem Pool in diesen Plan eingeladenen Personen zählen.
  const roleCount = new Map<string, number>();
  const { data: linkRows } = await supabase
    .from("participant_pool_invites")
    .select("pool_member_id")
    .eq("org_id", orgId)
    .eq("plan_id", planId);
  const memberIds = (linkRows ?? []).map((r) => r.pool_member_id);
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from("participant_pool")
      .select("id, role")
      .eq("org_id", orgId)
      .in("id", memberIds);
    for (const m of members ?? []) {
      if (m.role) roleCount.set(m.role, (roleCount.get(m.role) ?? 0) + 1);
    }
  }

  return quotaRows.map((row) => ({
    ...toQuotaBase(row),
    invited: roleCount.get(row.role) ?? 0,
  }));
}

export type UpsertQuotaResult =
  | { status: "ok"; quota: QuotaProgressRecord }
  | { status: "error"; quota: null; message: string };

/**
 * Setzt (oder aktualisiert) die Quote für eine Rolle in einer Studie. Upsert
 * auf (plan_id, role) — eine Quote pro Rolle, keine Historie.
 */
export async function upsertQuota(
  orgId: string,
  planId: string,
  role: string,
  target: number,
): Promise<UpsertQuotaResult> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plan_quotas")
    .upsert(
      { org_id: orgId, plan_id: planId, role, target },
      { onConflict: "plan_id,role" },
    )
    .select("*")
    .single();
  if (error || !data) {
    console.error(`[upsertQuota] failed for plan ${planId} role ${role}:`, error?.message);
    return { status: "error", quota: null, message: "Quote konnte nicht gespeichert werden." };
  }
  // Fortschritt nicht erneut aggregieren — der Aufrufer (Route) liest die
  // Liste mit Fortschritt frisch, wenn er ihn braucht. Hier invited=0-neutral
  // zurückzugeben wäre irreführend; daher den frischen Fortschritt nachladen.
  const progress = await listQuotaProgress(orgId, planId);
  const match = progress.find((q) => q.id === data.id);
  return {
    status: "ok",
    quota: match ?? { id: data.id, role: data.role, target: data.target, invited: 0 },
  };
}

/** Löscht eine Quote (org+plan-scoped). Returns true, wenn eine Zeile getroffen. */
export async function deleteQuota(
  orgId: string,
  planId: string,
  quotaId: string,
): Promise<boolean> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plan_quotas")
    .delete()
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .eq("id", quotaId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`[deleteQuota] failed for ${quotaId}:`, error.message);
    return false;
  }
  return !!data;
}
