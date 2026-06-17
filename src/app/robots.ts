import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/marketing/seo";

/**
 * Crawl policy. Public marketing is open; the authenticated/app surfaces are
 * disallowed. The disallow list mirrors CROSS_ROOT_PREFIXES (marketing-locale.ts)
 * — the non-marketing app/Clerk roots — so EN go-live doesn't raise crawl
 * exposure of /sign-in, /sign-up or /shared. Sitemap + host point at the single
 * SITE_URL value (set NEXT_PUBLIC_SITE_URL to the production domain before
 * go-live; the findr.de fallback would otherwise poison every absolute URL).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/api",
        "/onboarding",
        "/interview",
        "/shared",
        "/sign-in",
        "/sign-up",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
