"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <div className="mx-auto max-w-3xl p-8">
        <ErrorState
          title="Dashboard couldn't load"
          message={
            error.message ||
            "An unexpected error occurred while loading the dashboard. Try refreshing — if it keeps happening, check the server logs."
          }
          onRetry={reset}
        />
      </div>
    </div>
  );
}
