"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";

/**
 * Manuelle Screening-Quoten pro Studie: „Ziel N Personen mit Rolle X“. Rein
 * deterministisch — der Nutzer setzt die Ziele; der Fortschritt (eingeladen /
 * Ziel) wird server-seitig aus den Pool-Einladungen berechnet.
 *
 * Props-getrieben (kein lokaler Listen-State): Mutationen posten und rufen dann
 * router.refresh. So bleibt der eingeladen-Zähler korrekt, auch wenn nebenan
 * über „Aus Pool einladen“ neue Einladungen entstehen (dieselbe Seite).
 *
 * Fortschritt zählt NUR Pool-Einladungen — manuell/CSV angelegte (ungescreente)
 * Teilnehmer tragen keine Rolle und fließen bewusst nicht ein.
 */

export interface QuotaProgress {
  id: string;
  role: string;
  target: number;
  invited: number;
}

export function PlanQuotaPanel({
  planId,
  quotas,
  availableRoles,
  disabled = false,
}: {
  planId: string;
  quotas: QuotaProgress[];
  availableRoles: string[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [target, setTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedRole = role.trim();
    const targetNum = Number(target);
    if (trimmedRole === "") {
      setError("Rolle ist erforderlich.");
      return;
    }
    if (!Number.isInteger(targetNum) || targetNum < 0) {
      setError("Ziel muss eine ganze Zahl ≥ 0 sein.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/research/plans/${planId}/quotas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: trimmedRole, target: targetNum }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Quote konnte nicht gespeichert werden.");
      }
      setRole("");
      setTarget("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quote konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/research/plans/${planId}/quotas/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Quote konnte nicht gelöscht werden.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quote konnte nicht gelöscht werden.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {quotas.length === 0 ? (
        <p className="text-small text-neutral-500">
          Noch keine Quoten. Lege ein Ziel pro Rolle fest, z. B. „10 Personen mit
          Rolle Head of Sales“ – der Fortschritt zählt Einladungen aus dem Pool.
        </p>
      ) : (
        <ul className="space-y-3">
          {quotas.map((q) => {
            const reached = q.target > 0 && q.invited >= q.target;
            const pct =
              q.target > 0 ? Math.min(100, Math.round((q.invited / q.target) * 100)) : 0;
            return (
              <li key={q.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body-strong text-neutral-900">{q.role}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-small font-medium ${
                        reached ? "text-success-700" : "text-neutral-600"
                      }`}
                    >
                      {q.invited} von {q.target} eingeladen
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      disabled={deletingId === q.id || disabled}
                      className="text-caption text-neutral-400 transition-colors hover:text-danger-700 disabled:opacity-50"
                      aria-label={`Quote für ${q.role} löschen`}
                    >
                      {deletingId === q.id ? "…" : "Entfernen"}
                    </button>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${reached ? "bg-success-500" : "bg-primary-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!disabled && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-4">
          <label className="text-small">
            <span className="mb-1 block text-caption text-neutral-500">Rolle</span>
            <input
              list="quota-roles"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Head of Sales"
              disabled={submitting}
              className={FIELD_INPUT_CLASS}
            />
            <datalist id="quota-roles">
              {availableRoles.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
          <label className="text-small">
            <span className="mb-1 block text-caption text-neutral-500">Ziel</span>
            <input
              type="number"
              min={0}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="10"
              disabled={submitting}
              className={`${FIELD_INPUT_CLASS} w-28`}
            />
          </label>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Speichere…" : "Quote setzen"}
          </Button>
        </form>
      )}

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}
    </div>
  );
}
