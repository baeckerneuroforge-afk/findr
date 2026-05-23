"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface DealContactCardProps {
  dealId: string;
  initialName: string | null;
  initialEmail: string | null;
  initialPhone: string | null;
}

interface Contact {
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 disabled:opacity-60";

export function DealContactCard({
  dealId,
  initialName,
  initialEmail,
  initialPhone,
}: DealContactCardProps) {
  const [contact, setContact] = useState<Contact>({
    contactName: initialName,
    contactEmail: initialEmail,
    contactPhone: initialPhone,
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasContact = Boolean(
    contact.contactName || contact.contactEmail || contact.contactPhone,
  );

  function startEdit() {
    setForm({
      name: contact.contactName ?? "",
      email: contact.contactEmail ?? "",
      phone: contact.contactPhone ?? "",
    });
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: form.name,
          contactEmail: form.email,
          contactPhone: form.phone,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        contact?: Contact;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save contact.");
      }
      setContact({
        contactName: data.contact?.contactName ?? null,
        contactEmail: data.contact?.contactEmail ?? null,
        contactPhone: data.contact?.contactPhone ?? null,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-h2 text-neutral-900">Contact</h2>
        {!editing && (
          <Button variant="secondary" size="sm" onClick={startEdit}>
            {hasContact ? "Edit" : "Add contact"}
          </Button>
        )}
      </CardHeader>
      <CardBody>
        {editing ? (
          <div className="space-y-4">
            <Field label="Name">
              <input
                className={INPUT_CLASS}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Anna Berg"
                disabled={saving}
              />
            </Field>
            <Field label="Email">
              <input
                className={INPUT_CLASS}
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="anna.berg@example.com"
                disabled={saving}
              />
            </Field>
            <Field label="Phone">
              <input
                className={INPUT_CLASS}
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="+49 151 23456789"
                disabled={saving}
              />
            </Field>

            {error && (
              <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : hasContact ? (
          <dl className="space-y-3">
            <ContactRow label="Name" value={contact.contactName} />
            <ContactRow label="Email" value={contact.contactEmail} kind="email" />
            <ContactRow label="Phone" value={contact.contactPhone} kind="phone" />
          </dl>
        ) : (
          <p className="text-body text-neutral-500">
            No contact details yet. Add the buyer contact (name, email, or phone)
            so a post-loss interview can be sent later.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-body-strong text-neutral-900">
        {label}
      </span>
      {children}
    </label>
  );
}

function ContactRow({
  label,
  value,
  kind,
}: {
  label: string;
  value: string | null;
  kind?: "email" | "phone";
}) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-body text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-body text-neutral-900">
        {kind === "email" ? (
          <a
            href={`mailto:${value}`}
            className="text-primary-700 hover:underline"
          >
            {value}
          </a>
        ) : kind === "phone" ? (
          <a href={`tel:${value}`} className="text-primary-700 hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
