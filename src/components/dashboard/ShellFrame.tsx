"use client";

import { useEffect, useState } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import {
  NavCollapseProvider,
  toggleNavCollapsed,
  useNavCollapsedStore,
} from "@/components/dashboard/nav-collapse";

/**
 * Client shell for the dashboard. Owns the sidebar's collapsed state (E3) and
 * keeps the main column's left padding in lockstep with the sidebar width, so
 * the two never disagree. The dashboard layout (a server component) fetches the
 * Zitadel session and passes the header identity + children straight through.
 *
 * No-flash / hydration contract: `collapsed` comes from the external
 * localStorage store (nav-collapse) via useSyncExternalStore. Its server
 * snapshot is `false` (expanded), so the SSR HTML and the client's first render
 * are byte-identical — no hydration mismatch — and React then syncs to the
 * stored value after hydration without a mismatch warning. If the stored
 * preference is "collapsed", that post-hydration sync corrects the state once:
 * one frame of expanded-then-collapsed on a hard reload, acceptable for v1. The
 * MAIN column's left padding snaps on that correction (its transition class is
 * gated behind `mounted`, flipped a frame later via rAF), so the content does
 * not slide; the sidebar's own width transition may play that one correction in
 * once, which reads as a gentle rail-in and is harmless. Unlike ThemeShell,
 * collapsed state is not a pre-paint concern — a momentary wider rail is
 * harmless, whereas a wrong theme flashes the whole canvas — so no inline
 * no-flash script is needed.
 */
export function ShellFrame({
  orgName,
  userName,
  userEmail,
  children,
}: {
  orgName: string | null;
  userName: string | null;
  userEmail: string | null;
  children: React.ReactNode;
}) {
  // Collapsed-Zustand kommt aus dem externen localStorage-Store (nav-collapse).
  // useSyncExternalStore liefert beim Server-/Erst-Render `false` (matcht das
  // SSR-HTML → kein Hydration-Mismatch) und synchronisiert nach der Hydration
  // auf den gespeicherten Wert. `toggle` ist eine stabile Store-Funktion, die
  // persistiert und alle Subscriber (inkl. fremder Tabs) weckt.
  const collapsed = useNavCollapsedStore();
  const toggle = toggleNavCollapsed;

  // `mounted` gates the padding transition: false during the very first paint
  // and the post-hydration store-sync, so a reload that restores "collapsed"
  // SNAPS to the rail instead of animating from full width. setMounted runs in
  // rAF (deferred — NOT a synchronous effect-body setState), flipped on the next
  // frame; by then the corrected padding is committed, so enabling transitions
  // never retroactively animates the correction. After mount every user toggle
  // animates over 340 ms (matching the sidebar width).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    // Der Provider veröffentlicht denselben `collapsed`-Wert, der unten an die
    // Sidebar geht — additiv: die Sidebar liest ihn WEITER als Prop, aber
    // viewport-fixierte Chrome (z. B. StickyStudyBar mit left-60) hängt nicht
    // an der pl-Spalte und kann den Versatz nur über diesen Kontext im
    // Gleichschritt mitschalten.
    <NavCollapseProvider collapsed={collapsed}>
      <DashboardSidebar collapsed={collapsed} onToggle={toggle} />
      {/* Linkes Padding folgt der Sidebar-Breite (pl-60 ⇄ pl-16 = 240/64 px).
          Transition gleicht die Sidebar an (340 ms, gleiche Kurve); vor Mount
          und unter Reduced-Motion ohne Animation. */}
      <div
        className={`${collapsed ? "pl-16" : "pl-60"} ${
          mounted
            ? "transition-[padding] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            : ""
        }`}
      >
        <DashboardHeader
          orgName={orgName}
          userName={userName}
          userEmail={userEmail}
        />
        {/* 1120px-Mittelspalte (v5-Mockup .content-inner): die ruhige,
            fokussierte Lesespalte ist der größte Einzelhebel für den
            aufgeräumten Eindruck — vorher 1400px, auf denen sich die
            Karten zerdehnten. */}
        <main className="px-8 py-8 max-w-[1120px] mx-auto">{children}</main>
      </div>
    </NavCollapseProvider>
  );
}
