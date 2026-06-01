import { jsonLdHtml } from "@/lib/marketing/seo";

/**
 * Inline JSON-LD for a Server Component. Uses a native <script> (NOT next/script
 * — that's for executable JS, not metadata) with the `<` escaped via
 * `jsonLdHtml` so a malicious string can't break out of the script tag. Render
 * inside a page's server tree. (§8 / Befund 3.)
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }}
    />
  );
}
