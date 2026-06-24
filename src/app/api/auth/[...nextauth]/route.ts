import { handlers } from "@/auth";

/**
 * NextAuth v5 catch-all route. Exposes the Auth.js GET/POST handlers, which
 * create every /api/auth/* endpoint — including the Zitadel OIDC callback at
 * /api/auth/callback/zitadel (the redirect URI registered in the Zitadel app).
 */
export const { GET, POST } = handlers;
