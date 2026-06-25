"use client";

import { useId, useState } from "react";

/**
 * Geteilte UI-Primitive für den Studio-Prototyp. Bewusst klein gehalten und auf
 * die bestehenden Klymeo-Design-Tokens gestützt (text-display, bg-card,
 * primary-*, neutral-*, st-rise). Keine externe UI-Lib — reiner Prototyp.
 */

/* ── Icons (Strichform wie im echten Formular) ─────────────────────────── */

type IconProps = { className?: string };
const base = "shrink-0";

export function SparkleIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ChevronIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChatIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

export function MicIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={`${base} ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5" />
    </svg>
  );
}

/* ── Buttons ───────────────────────────────────────────────────────────── */

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-body-strong text-white shadow-sm outline-none transition-all hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-small font-medium text-neutral-500 outline-none transition-colors hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-primary-500/30"
    >
      {children}
    </button>
  );
}

/* ── Felder ────────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-small font-medium text-neutral-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-caption text-neutral-400">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-200 bg-card px-3 py-2 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea {...props} className={`${inputCls} resize-none ${props.className ?? ""}`} />;
}

/* ── Auswahl-Karte (Radio-Optik) ───────────────────────────────────────── */

export function ChoiceCard({
  selected,
  onSelect,
  icon,
  title,
  desc,
  badge,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`relative w-full rounded-lg border p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
        disabled
          ? "cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-60"
          : selected
            ? "border-primary-400 bg-primary-50 shadow-sm"
            : "border-neutral-200 bg-card hover:border-neutral-300 hover:shadow-sm"
      }`}
    >
      {badge ? (
        <span className="absolute right-3 top-3 rounded-full border border-primary-200 bg-card px-2 py-0.5 text-caption font-medium leading-none text-primary-700">
          {badge}
        </span>
      ) : null}
      <span className="flex items-center gap-2 text-body-strong text-neutral-900">
        {icon}
        {title}
      </span>
      {desc ? <span className="mt-1 block text-small text-neutral-500">{desc}</span> : null}
    </button>
  );
}

/* ── Chip (kleine Pillen-Auswahl) ──────────────────────────────────────── */

export function Chip({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-full border px-3 py-1.5 text-small font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
        selected
          ? "border-primary-400 bg-primary-50 text-primary-700"
          : "border-neutral-200 bg-card text-neutral-600 hover:border-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Toggle-Switch (für optionale Analyse) ─────────────────────────────── */

export function ToggleRow({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-body-strong text-neutral-900">
          {title}
        </label>
        {desc ? <p className="mt-0.5 text-small text-neutral-500">{desc}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
          checked ? "bg-primary-600" : "bg-neutral-200"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/* ── Einklappbarer Bereich ("Erweitert", "Optionale Analyse") ──────────── */

export function Collapsible({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-neutral-200 bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
      >
        <span>
          <span className="block text-body-strong text-neutral-900">{title}</span>
          {subtitle ? <span className="block text-small text-neutral-500">{subtitle}</span> : null}
        </span>
        <ChevronIcon className={`h-4 w-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-neutral-100 px-4 py-3">{children}</div> : null}
    </div>
  );
}

/* ── Karte ─────────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-card p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/* ── "Klymeo denkt nach…"-Zustand ──────────────────────────────────────── */

export function ThinkingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="relative flex h-10 w-10 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-200 opacity-60" />
        <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white">
          <SparkleIcon className="h-4 w-4" />
        </span>
      </span>
      <p className="text-body text-neutral-500">{label}</p>
    </div>
  );
}
