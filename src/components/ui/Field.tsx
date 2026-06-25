import type { ReactNode } from "react";

/**
 * Form field wrapper: label (with optional required-asterisk and optional
 * hint) above the input. Extracted from ManualDealForm so the Research-
 * Plan editor + future forms can share the exact same visual rhythm
 * without inlining the markup.
 *
 * The hint slot is for short helper text that lives below the label and
 * above the control — useful for editor forms where the field name alone
 * doesn't tell you what to type ("Topics — what we want to learn about").
 */
interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  /** id passed through to the inner control via aria-describedby for the
   *  hint and via the rendered <label htmlFor=…> when set on the input. */
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  required,
  hint,
  children,
  className = "",
}: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-body-strong text-neutral-900">
        {label}
        {required && <span className="text-danger-700"> *</span>}
      </span>
      {hint && (
        <span className="mb-1.5 block text-caption text-neutral-500">
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

/**
 * Shared input classes — same tokens as ManualDealForm. Exported as a const
 * so editor forms don't drift visually. Use on `<input>`, `<select>`, etc.
 */
export const FIELD_INPUT_CLASS =
  "h-9 w-full rounded-md border border-neutral-200 bg-card px-3 text-body text-neutral-900 outline-none transition-colors duration-150 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25 disabled:opacity-50";

/** Multi-line variant — same border/focus tokens, taller. */
export const FIELD_TEXTAREA_CLASS =
  "w-full rounded-md border border-neutral-200 bg-card px-3 py-2 text-body text-neutral-900 outline-none transition-colors duration-150 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25 disabled:opacity-50";

export default Field;
