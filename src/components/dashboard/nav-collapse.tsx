"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "klymeo-nav-collapsed";

/**
 * Sidebar-Collapse-Zustand des Dashboards.
 *
 * Zwei Dinge in einer Datei:
 *  1. Ein localStorage-gestützter EXTERNER Store (useSyncExternalStore) als
 *     Source of Truth für „eingeklappt". localStorage ist ein externer Store —
 *     deshalb lesen wir ihn wie ThemeShell über useSyncExternalStore statt über
 *     useState + Effect. Das ist (a) hydration-sicher (Server-Snapshot = false →
 *     SSR und erster Client-Render stimmen überein; React synchronisiert nach
 *     der Hydration ohne Mismatch-Warnung auf den gespeicherten Wert) und
 *     (b) frei von „setState synchron im Effect" (Repo-Lint-Regel).
 *  2. Ein winziger Context, der denselben Wert an Geschwister der Sidebar
 *     weiterreicht (z. B. StickyStudyBar mit `left-60`), die viewport-fixiert
 *     sind und das pl-60⇄pl-16 der Spalte nicht erben können.
 *
 * In-Memory-Spiegel (`memoryValue`): hält den Zustand auch dann im laufenden
 * Tab, wenn localStorage gesperrt ist (Safari Private Mode wirft bei setItem) —
 * sonst bliebe der Toggle dort wirkungslos.
 */

let memoryValue: boolean | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  if (memoryValue !== null) return memoryValue;
  try {
    memoryValue = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    memoryValue = false;
  }
  return memoryValue;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      memoryValue = e.newValue === "1";
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Persistiert den neuen Wert + weckt alle Subscriber (auch fremde Tabs via
 *  storage-Event). Bei gesperrtem Storage bleibt der In-Memory-Wert gültig. */
export function setNavCollapsed(next: boolean): void {
  memoryValue = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Ohne Storage keine Persistenz — der laufende Tab schaltet trotzdem um.
  }
  listeners.forEach((listener) => listener());
}

/** Kippt den Zustand auf Basis des aktuellen Snapshots (stabile Referenz,
 *  daher in ShellFrame ohne useCallback verwendbar). */
export function toggleNavCollapsed(): void {
  setNavCollapsed(!getSnapshot());
}

/** Hydration-sicheres Lesen des Collapse-Flags aus dem externen Store. */
export function useNavCollapsedStore(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ── Context (für viewport-fixierte Geschwister wie StickyStudyBar) ────────
   Default false (ausgeklappt) — matcht den Server-Snapshot, also kein
   Hydration-Mismatch; ein Consumer ohne Provider verhält sich wie volle
   Breite und crasht nie. */
const NavCollapseContext = createContext<boolean>(false);

export function NavCollapseProvider({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <NavCollapseContext.Provider value={collapsed}>
      {children}
    </NavCollapseContext.Provider>
  );
}

/**
 * Liest das aktuelle Collapse-Flag aus dem Context. Default `false` (ausgeklappt),
 * wenn kein Provider darüber sitzt — der Hook ist immer sicher aufrufbar.
 */
export function useNavCollapsed(): boolean {
  return useContext(NavCollapseContext);
}

export { NavCollapseContext };
