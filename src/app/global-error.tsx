"use client";

/**
 * Global error boundary — catches errors in the ROOT layout itself. It replaces
 * the entire document, so it must render its own <html>/<body> AND can't rely on
 * globals.css/Tailwind (those are imported by the bypassed root layout). Hence
 * inline styles only, kept on the light marketing surface.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
          background: "#ffffff",
          color: "#18181b",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          Etwas ist schiefgelaufen.
        </h1>
        <p style={{ maxWidth: "28rem", color: "#71717a", margin: 0 }}>
          Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "8px",
            height: "44px",
            padding: "0 20px",
            borderRadius: "4px",
            border: "none",
            background: "#5b2fd4",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Erneut versuchen
        </button>
      </body>
    </html>
  );
}
