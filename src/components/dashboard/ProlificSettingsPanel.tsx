"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

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

const STATUS_LABEL_KEY: Record<
  ProlificCredentialView["status"] | "missing",
  "statusConnected" | "statusInvalid" | "statusUnknown" | "statusMissing"
> = {
  connected: "statusConnected",
  invalid: "statusInvalid",
  unknown: "statusUnknown",
  missing: "statusMissing",
};

function statusVariant(
  status: ProlificCredentialView["status"] | "missing",
): "success" | "critical" | "default" {
  if (status === "connected") return "success";
  if (status === "invalid") return "critical";
  return "default";
}

export function ProlificSettingsPanel({ initialCredential }: Props) {
  const router = useRouter();
  const t = useTranslations("research.panel");
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
      setFeedback({ type: "error", msg: t("errTokenRequired") });
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
        const status = data.status === "invalid" ? t("errTokenInvalid") : null;
        setFeedback({
          type: "error",
          msg: status ?? data.error ?? t("errSaveFailed"),
        });
        return;
      }
      setCredential(data.credential);
      setApiToken("");
      setFeedback({ type: "success", msg: t("savedOk") });
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
              ? t("errStoredInvalid")
              : t("errValidateFailed"),
        });
        router.refresh();
        return;
      }
      setCredential(data.credential);
      setFeedback({ type: "success", msg: t("validatedOk") });
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
        setFeedback({ type: "error", msg: t("errDisconnectFailed") });
        return;
      }
      setCredential(null);
      setApiToken("");
      setFeedback({ type: "success", msg: t("disconnectedOk") });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  const status = credential?.status ?? "missing";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-card p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-h3 text-neutral-900">{t("connectionTitle")}</h3>
            <p className="mt-1 text-small text-neutral-500">
              {t("connectionDesc")}
            </p>
          </div>
          <Badge variant={statusVariant(status)}>
            {t(STATUS_LABEL_KEY[status])}
          </Badge>
        </div>

        {credential && (
          <div className="mb-5 space-y-1 text-small text-neutral-700">
            {credential.providerUserEmail && (
              <div>{t("account", { account: credential.providerUserEmail })}</div>
            )}
            {credential.tokenHint && (
              <div>{t("tokenHint", { hint: credential.tokenHint })}</div>
            )}
            <div>
              {/* ISO-Slice statt toLocaleString — deterministisch zwischen
                  Server-Pass und Client (kein Hydration-Drift). */}
              {credential.lastValidatedAt
                ? t("lastValidation", {
                    when: credential.lastValidatedAt
                      .slice(0, 16)
                      .replace("T", " "),
                  })
                : t("lastValidationNever")}
            </div>
            {credential.validationError && (
              <div className="text-warning-700">
                {t("lastError", { error: credential.validationError })}
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-small font-medium text-neutral-700">
            {t("tokenLabel")}
          </span>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder={t("tokenPlaceholder")}
            className={`${FIELD_INPUT_CLASS} font-mono text-small`}
            autoComplete="off"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("saving") : credential ? t("saveReplace") : t("save")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleValidate}
            disabled={validating || !credential}
          >
            {validating ? t("validating") : t("validate")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleDisconnect}
            disabled={disconnecting || !credential}
          >
            {disconnecting ? t("disconnecting") : t("disconnect")}
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
