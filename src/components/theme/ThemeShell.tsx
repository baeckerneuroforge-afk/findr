"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "findr-theme";

/**
 * Läuft synchron beim Parsen als ERSTES Kind des Shell-Wrappers — vor First
 * Paint und vor der Hydration —, damit ein dunkel eingestelltes Dashboard
 * nie hell aufblitzt. Muss dieselbe Auflösung rechnen wie der Effect in
 * ThemeShell (gespeicherte Präferenz, sonst System).
 */
const NO_FLASH_SCRIPT = `(function(){try{var p=document.currentScript.parentElement;var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches)){p.classList.add("dark")}}catch(e){}})()`;

type ThemeContextValue = {
  /** Gespeicherte Präferenz (Steuerung des Toggles). */
  theme: ThemePreference;
  /** Effektiver Modus — bis zur Mount-Auflösung konservativ "light". */
  resolvedDark: boolean;
  setTheme: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeShell");
  return ctx;
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

/**
 * Dashboard-Shell mit Hell/Dunkel-Umschaltung. Rendert den Wrapper, der
 * bisher direkt im (dashboard)-Layout lag, und trägt die .dark-Klasse —
 * bewusst auf dieser Ebene statt auf <html>, damit Teilnehmer-, Shared-
 * und Auth-Flächen außerhalb des Wrappers konstruktiv hell bleiben.
 * suppressHydrationWarning, weil das No-Flash-Script die Klasse vor der
 * Hydration setzen darf; danach ist der Effect die einzige Schreibquelle.
 */
export function ThemeShell({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedDark, setResolvedDark] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  // Mount: gespeicherte Präferenz in den React-State holen (SSR kennt sie
  // nicht). Löst über den Apply-Effect unten auch resolvedDark auf.
  useEffect(() => {
    setThemeState(readStoredPreference());
  }, []);

  // Präferenz anwenden + bei "system" Live-Wechseln des OS folgen.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      shellRef.current?.classList.toggle("dark", dark);
      setResolvedDark(dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // Cross-Tab-Sync: Umschalten in einem Tab zieht offene Tabs nach.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(readStoredPreference());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ohne Storage gilt die Wahl nur für diesen Tab — bewusst still.
    }
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
