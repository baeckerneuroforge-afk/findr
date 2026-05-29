"use client";

import { useTranslations } from "next-intl";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const t = useTranslations("common");
  const resolvedTitle = title ?? t("somethingWrong");
  const resolvedMessage = message ?? t("loadError");

  return (
    <div className="flex flex-col items-center rounded-lg border border-danger-500/30 bg-danger-50 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-danger-500/30 bg-white text-danger-500">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-h1 text-neutral-900">{resolvedTitle}</h3>
      <p className="mx-auto mt-2 max-w-md text-body text-neutral-700">
        {resolvedMessage}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-8 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-body-strong font-medium text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          {t("tryAgain")}
        </button>
      )}
    </div>
  );
}

export default ErrorState;
