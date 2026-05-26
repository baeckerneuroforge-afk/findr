"use client";

import { useEffect, useState } from "react";

import { CommandPalette } from "./CommandPalette";
import { GlobalSearchTrigger } from "./GlobalSearchTrigger";

/**
 * Self-contained palette state-owner. Hosts the open/close state for the
 * Cmd+K palette plus the global Cmd+K / Ctrl+K hotkey listener, and renders
 * BOTH the header trigger button AND the dialog as siblings — the trigger
 * is in-flow next to OrgDisplay / UserButton, the dialog portals out to
 * the body via cmdk's Radix-Dialog wrapper.
 *
 * No React context needed: the trigger and the dialog share state through
 * this component's `useState`, which is the smallest possible wiring.
 * If a future trigger needs to live outside the header (e.g. a "Search"
 * link inside the sidebar), that's the moment to lift state into a
 * provider — not before.
 */
export function SearchHeaderWidget() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      // Toggle on Cmd+K (macOS) / Ctrl+K (Windows/Linux). `key === "k"`
      // is the lowercase form; with Shift/Caps the browser still reports
      // "k" / "K" — we accept both for resilience.
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (event.key === "k" || event.key === "K")
      ) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  return (
    <>
      <GlobalSearchTrigger onClick={() => setOpen(true)} />
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
