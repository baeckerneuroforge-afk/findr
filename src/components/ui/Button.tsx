import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-hover active:bg-primary-700",
  secondary:
    "bg-card text-neutral-900 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 hover:-translate-y-px motion-reduce:hover:translate-none",
  ghost:
    "text-neutral-700 hover:bg-neutral-100 hover:-translate-y-px motion-reduce:hover:translate-none",
  danger:
    "bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-700",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-small",
  md: "h-8 px-3 text-body-strong",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px active:scale-[.99] motion-reduce:transition-none motion-reduce:translate-none motion-reduce:scale-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-none disabled:active:scale-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/50 focus-visible:ring-offset-1 ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
