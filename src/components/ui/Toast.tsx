"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";

/**
 * Konsole-v5 (E1): leichtes Toast-System ohne neue Dependency.
 *
 * Globales Feedback für Aktionen (Kopieren, Exporte, Async-Erfolge) — bisher
 * gab es in der Konsole nur Inline-Fehlertexte neben den Buttons. Der
 * Provider liegt im (dashboard)-Layout AUSSERHALB von template.tsx, damit
 * der fixed-Viewport nicht im transform-Kontext der Eintritts-Animation
 * landet (ein transform-Ancestor würde position:fixed an die animierte Box
 * statt ans Fenster binden).
 *
 * Texte kommen von den Aufrufern (bestehende i18n-Keys) — das System selbst
 * braucht nur das Schließen-Label (common.dismiss).
 */

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  leaving: boolean;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}

const AUTO_DISMISS_MS = 3400;
const LEAVE_MS = 200;
const MAX_STACK = 3;

const VARIANT_DOT: Record<ToastVariant, string> = {
  success: "bg-success-500",
  error: "bg-danger-500",
  info: "bg-primary-600",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, leaving: true } : item,
        ),
      );
      const timer = timersRef.current.get(id);
      if (timer) clearTimeout(timer);
      timersRef.current.set(
        id,
        setTimeout(() => remove(id), LEAVE_MS),
      );
    },
    [remove],
  );

  const toast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = ++idRef.current;
      setToasts((prev) => [
        ...prev.slice(-(MAX_STACK - 1)),
        { id, message, variant, leaving: false },
      ]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const t = useTranslations("common");

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`animate-console-rise pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-lg border border-neutral-200 bg-card py-3 pl-4 pr-2 shadow-lg transition-[opacity,transform] duration-200 motion-reduce:transition-none ${
            item.leaving ? "translate-y-1 opacity-0" : ""
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${VARIANT_DOT[item.variant]}`}
          />
          <span className="text-small text-neutral-900">{item.message}</span>
          <button
            type="button"
            aria-label={t("dismiss")}
            onClick={() => onDismiss(item.id)}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
          >
            <svg
              aria-hidden="true"
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
