"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";

interface ProlificCredentialView {
  status: "connected" | "invalid" | "unknown";
  tokenHint: string | null;
  providerUserEmail: string | null;
  lastValidatedAt: string | null;
  validationError: string | null;
}

interface Props {
  initialCredential: ProlificCredentialView | null;
}

type Feedback = { type: "success" | "error"; msg: string };

function statusLabel(status: ProlificCredentialView["status"] | "missing") {
  if (status === "connected") return "Connected";
  if (status === "invalid") return "Invalid";
  if (status === "unknown") return "Unknown";
  return "Not connected";
}

function statusVariant(
  status: ProlificCredentialView["status"] | "missing",
): "success" | "critical" | "default" {
  if (status === "connected") return "success";
  if (status === "invalid") return "critical";
  return "default";
}

export function ProlificSettingsPanel({ initialCredential }: Props) {
  const router = useRouter();
  const [credential, setCredential] =
    useState<ProlificCredentialView | null>(initialCredential);
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handleSave() {
    const token = apiToken.trim();
    if (token.length < 10) {
      setFeedback({ type: "error", msg: "Enter a Prolific API token." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/prolific", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken: token }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        status?: string;
        credential?: ProlificCredentialView;
        error?: string;
      };
      if (!res.ok || data.success === false || !data.credential) {
        const status = data.status === "invalid" ? "Invalid token." : null;
        setFeedback({
          type: "error",
          msg: status ?? data.error ?? "Could not save the token.",
        });
        return;
      }
      setCredential(data.credential);
      setApiToken("");
      setFeedback({ type: "success", msg: "Prolific connected." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/prolific", { method: "PUT" });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        status?: string;
        credential?: ProlificCredentialView;
      };
      if (!res.ok || data.success === false || !data.credential) {
        setFeedback({
          type: "error",
          msg:
            data.status === "invalid"
              ? "Stored token is invalid."
              : "Could not validate the stored token.",
        });
        router.refresh();
        return;
      }
      setCredential(data.credential);
      setFeedback({ type: "success", msg: "Connection validated." });
      router.refresh();
    } finally {
      setValidating(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/integrations/prolific", {
        method: "DELETE",
      });
      if (!res.ok) {
        setFeedback({ type: "error", msg: "Could not disconnect Prolific." });
        return;
      }
      setCredential(null);
      setApiToken("");
      setFeedback({ type: "success", msg: "Prolific disconnected." });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  const status = credential?.status ?? "missing";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-h3 text-neutral-900">Connection</h3>
            <p className="mt-1 text-small text-neutral-500">
              Used for draft study creation only.
            </p>
          </div>
          <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
        </div>

        {credential && (
          <div className="mb-5 space-y-1 text-small text-neutral-700">
            {credential.providerUserEmail && (
              <div>Account: {credential.providerUserEmail}</div>
            )}
            {credential.tokenHint && <div>Token: {credential.tokenHint}</div>}
            <div>
              Last validation:{" "}
              {credential.lastValidatedAt
                ? new Date(credential.lastValidatedAt).toLocaleString()
                : "never"}
            </div>
            {credential.validationError && (
              <div className="text-warning-700">
                Last error: {credential.validationError}
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-small font-medium text-neutral-700">
            Prolific API token
          </span>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Token ..."
            className={`${FIELD_INPUT_CLASS} font-mono text-small`}
            autoComplete="off"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : credential ? "Replace token" : "Connect"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleValidate}
            disabled={validating || !credential}
          >
            {validating ? "Validating..." : "Validate current"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleDisconnect}
            disabled={disconnecting || !credential}
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-md px-3 py-2 text-small font-medium ${
            feedback.type === "success"
              ? "bg-success-50 text-success-700"
              : "bg-danger-50 text-danger-700"
          }`}
        >
          {feedback.msg}
        </div>
      )}
    </div>
  );
}
