"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { GlobalSearchTrigger } from "./GlobalSearchTrigger";

// Lazy-load the cmdk palette so its chunk (cmdk + Radix DismissableLayer/
// FocusScope, ~17.6 KB gz) stays OUT of the initial dashboard bundle that
// ships on every page. It is a pure client modal that portals to <body>, so
// SSR adds nothing — `ssr: false` is correct here and sidesteps any hydration
// concern. The chunk is fetched on the FIRST open (see `activated` below).
const CommandPalette = dynamic(
  () => import("./CommandPalette").then((mod) => mod.CommandPalette),
  { ssr: false },
);

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
  // Latches `true` on the first open and stays `true`. This keeps the palette
  // mounted after it closes — preserving CommandPalette's in-memory search
  // index cache so re-opens stay instant (its own comment relies on this) —
  // while still deferring the cmdk chunk download until the user first needs
  // it. The lightweight trigger + hotkey listener below live in the static
  // shell and are always available to trigger that first mount.
  const [activated, setActivated] = useState(false);

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
        setActivated(true);
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  function openPalette() {
    setActivated(true);
    setOpen(true);
  }

  return (
    <>
      <GlobalSearchTrigger onClick={openPalette} />
      {activated && <CommandPalette open={open} onOpenChange={setOpen} />}
    </>
  );
}
