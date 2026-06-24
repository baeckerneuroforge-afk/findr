"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Client wrapper around NextAuth's SessionProvider so client components can read
 * the session via useSession(). Mounted in the (app) root layout. This is the
 * NextAuth replacement for the client side of Clerk's provider; server code
 * keeps reading the session with `await auth()` and never needs this.
 */
export function SessionProviderWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
