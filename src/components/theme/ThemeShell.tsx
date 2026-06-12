"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "findr-theme";

/**
 * Läuft synchron beim Parsen als ERSTES Kind des Shell-Wrappers — vor First
 * Paint und vor der Hydration —, damit ein dunkel eingestelltes Dashboard
 * nie hell aufblitzt. Muss dieselbe Auflösung rechnen wie getResolvedDark.
 */
const NO_FLASH_SCRIPT = `(function(){try{var p=document.currentScript.parentElement;var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches)){p.classList.add("dark")}}catch(e){}})()`;

/* ── Externer Theme-Store ────────────────────────────────────────────────
   localStorage (Präferenz) + matchMedia (System) SIND externe Stores —
   deshalb useSyncExternalStore statt setState-in-Effect (Repo-Muster, wie
   beim reduced-motion-Hook): kein Hydration-Trap, kein Cascading-Render.
   Lokale setTheme-Aufrufe feuern `emit()`, fremde Tabs den storage-Event,
   das OS den matchMedia-change — alle drei wecken dieselben Subscriber. */

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onStorage);
  mq.addEventListener("change", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
    mq.removeEventListener("change", callback);
  };
}

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // Storage gesperrt (z. B. Safari Private Mode) → Systemverhalten.
  }
  return "system";
}

function getResolvedDark(): boolean {
  const theme = readStoredPreference();
  return (
    theme === "dark" ||
    (theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

type ThemeContextValue = {
  /** Gespeicherte Präferenz (Steuerung des Toggles). */
  theme: ThemePreference;
  /** Effektiver Modus — beim SSR konservativ false (hell). */
  resolvedDark: boolean;
  setTheme: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeShell");
  return ctx;
}

/**
 * Dashboard-Shell mit Hell/Dunkel-Umschaltung. Rendert den Wrapper, der
 * bisher direkt im (dashboard)-Layout lag, und trägt die .dark-Klasse —
 * bewusst auf dieser Ebene statt auf <html>, damit Teilnehmer-, Shared-
 * und Auth-Flächen außerhalb des Wrappers konstruktiv hell bleiben.
 * suppressHydrationWarning, weil das No-Flash-Script die Klasse vor der
 * Hydration setzen darf; danach ist der Sync-Effect die einzige
 * Schreibquelle (reine DOM-Mutation, kein State).
 */
export function ThemeShell({ children }: { children: React.ReactNode }) {
  const shellRef = useRef<HTMLDivElement>(null);

  const theme = useSyncExternalStore(
    subscribe,
    readStoredPreference,
    () => "system" as const,
  );
  const resolvedDark = useSyncExternalStore(
    subscribe,
    getResolvedDark,
    () => false,
  );

  useEffect(() => {
    shellRef.current?.classList.toggle("dark", resolvedDark);
  }, [resolvedDark]);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ohne Storage keine Persistenz — der emit() unten schaltet trotzdem
      // den laufenden Tab nicht um (Snapshot liest localStorage); bewusst
      // still, Systemmodus bleibt dann maßgeblich.
    }
    emit();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedDark, setTheme }}>
      <div
        ref={shellRef}
        id="findr-theme-shell"
        suppressHydrationWarning
        className="font-body min-h-screen scheme-light bg-surface text-neutral-700"
      >
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
