"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { isAdminRole } from "@/lib/settings/roles";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_ACCENT = "#4A51A8";
const MAX_BYTES = 1_048_576; // 1 MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Org-level white-label branding: brand name, accent color, and logo. Brand
 * name + accent save together via PUT /api/settings/branding; the logo uploads
 * separately to /api/settings/branding/logo. Unset = today's neutral Klymeo
 * default. Mirrors the AutoInterviewSettingForm pattern (admin-gated, GET on
 * mount, neutral card styling).
 */
export function BrandingSettingsForm() {
  const t = useTranslations("branding");
  const { orgRole } = useAuth();
  const isAdmin = isAdminRole(orgRole);

  const [brandName, setBrandName] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [accentError, setAccentError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/branding")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.branding) {
          setBrandName(data.branding.brandName ?? "");
          setAccentColor(data.branding.accentColor ?? "");
          setLogoUrl(data.branding.logoUrl ?? null);
        }
      })
      .catch(() => {
        /* keep neutral defaults on read failure */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // The native color picker only emits #RRGGBB; mirror that to the hex field.
  const colorPickerValue = HEX_COLOR.test(accentColor)
    ? accentColor
    : DEFAULT_ACCENT;

  async function save() {
    if (!isAdmin || saving) return;
    setFeedback(null);
    setAccentError(null);

    const trimmedAccent = accentColor.trim();
    if (trimmedAccent && !HEX_COLOR.test(trimmedAccent)) {
      setAccentError(t("accentColor.invalid"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName.trim() || null,
          accentColor: trimmedAccent || null,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setFeedback(t("saved"));
    } catch {
      setFeedback(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    if (file.size > MAX_BYTES) {
      setLogoError(t("logo.tooLarge"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLogoError(t("logo.invalidType"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/settings/branding/logo", {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error("upload failed");
      const data = await res.json();
      setLogoUrl(data.logoUrl ?? null);
    } catch {
      setLogoError(t("saveError"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    if (!isAdmin || uploading) return;
    setLogoError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/settings/branding/logo", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("remove failed");
      setLogoUrl(null);
    } catch {
      setLogoError(t("saveError"));
    } finally {
      setUploading(false);
    }
  }

  const disabled = !isAdmin || loading;

  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-5">
      <div className="mb-5">
        <h2 className="text-h2 text-neutral-900">{t("title")}</h2>
        <p className="mt-1 text-body text-neutral-500">{t("subtitle")}</p>
      </div>

      {!isAdmin && (
        <p className="mb-4 text-small text-neutral-500">{t("adminOnly")}</p>
      )}

      <div className="space-y-5">
        {/* Brand name */}
        <div>
          <label
            htmlFor="branding-name"
            className="block text-body-strong text-neutral-900"
          >
            {t("brandName.label")}
          </label>
          <input
            id="branding-name"
            type="text"
            value={brandName}
            disabled={disabled || saving}
            placeholder={t("brandName.placeholder")}
            onChange={(e) => setBrandName(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-body text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
          />
          <p className="mt-1 text-caption text-neutral-500">
            {t("brandName.help")}
          </p>
        </div>

        {/* Accent color */}
        <div>
          <label
            htmlFor="branding-accent"
            className="block text-body-strong text-neutral-900"
          >
            {t("accentColor.label")}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              aria-label={t("accentColor.label")}
              value={colorPickerValue}
              disabled={disabled || saving}
              onChange={(e) => {
                setAccentColor(e.target.value);
                setAccentError(null);
              }}
              className="h-9 w-12 cursor-pointer rounded-md border border-neutral-200 disabled:cursor-not-allowed"
            />
            <input
              id="branding-accent"
              type="text"
              value={accentColor}
              disabled={disabled || saving}
              placeholder={DEFAULT_ACCENT}
              onChange={(e) => {
                setAccentColor(e.target.value);
                setAccentError(null);
              }}
              className="w-32 rounded-md border border-neutral-200 px-3 py-2 font-mono text-body text-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
            />
          </div>
          <p className="mt-1 text-caption text-neutral-500">
            {t("accentColor.help")}
          </p>
          {accentError && (
            <p className="mt-1 text-small text-danger-700">{accentError}</p>
          )}
        </div>

        {/* Save (name + accent) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={disabled || saving}
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary-600 px-3 text-body-strong font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t("saving") : t("save")}
          </button>
          {feedback && (
            <span className="text-small text-neutral-500">{feedback}</span>
          )}
        </div>

        {/* Logo */}
        <div className="border-t border-neutral-100 pt-5">
          <span className="block text-body-strong text-neutral-900">
            {t("logo.label")}
          </span>
          <p className="mt-1 text-caption text-neutral-500">{t("logo.help")}</p>

          {logoUrl && (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={t("logo.current")}
                className="h-12 w-auto rounded-md border border-neutral-100 bg-neutral-50 object-contain p-1"
              />
              <span className="text-caption text-neutral-500">
                {t("logo.current")}
              </span>
              <button
                type="button"
                onClick={removeLogo}
                disabled={disabled || uploading}
                className="rounded-md border border-neutral-200 px-3 py-1.5 text-small text-neutral-700 disabled:opacity-50"
              >
                {t("logo.remove")}
              </button>
            </div>
          )}

          <div className="mt-3">
            <label
              className={`inline-flex items-center rounded-md border border-neutral-200 px-3 py-2 text-body-strong text-neutral-700 ${
                disabled || uploading
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
            >
              {uploading ? t("logo.uploading") : t("logo.upload")}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={disabled || uploading}
                onChange={handleLogoSelect}
                className="sr-only"
              />
            </label>
          </div>

          {logoError && (
            <p className="mt-2 text-small text-danger-700">{logoError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
