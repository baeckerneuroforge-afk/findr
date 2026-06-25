import Link from "next/link";
import { CornerBrackets } from "./primitives";
import { formatDate, type InsightArticle } from "@/lib/insights/articles";
import {
  localizeHref,
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
} from "@/i18n/marketing-locale";

/**
 * Article card for the /insights index (and cross-links). The whole card is one
 * focusable link (editorial framed look via CornerBrackets). Title in Fraunces,
 * category eyebrow + locale-aware long date in the footer. (§2.2 InsightTeaser.)
 */
export function InsightTeaser({ article }: { article: InsightArticle }) {
  const locale = article.locale ?? MARKETING_DEFAULT_LOCALE;
  return (
    <Link
      href={localizeHref(locale, `/insights/${article.slug}`)}
      className="group relative flex h-full flex-col gap-3 rounded border border-neutral-200 bg-neutral-0 p-7 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
    >
      <CornerBrackets className="border-primary-200" />
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-neutral-500">
        {article.category}
      </span>
      <h3 className="font-marketing text-xl [font-weight:var(--st-display-weight)] leading-snug text-neutral-900">
        {article.title}
      </h3>
      <p className="flex-grow text-sm leading-relaxed text-neutral-500">
        {article.excerpt}
      </p>
      <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
        <time dateTime={article.date}>{formatDate(article.date, locale)}</time>
        <span
          aria-hidden
          className="font-medium text-neutral-500 transition-transform group-hover:translate-x-0.5"
        >
          {localizedContent(locale, { de: "Lesen", en: "Read" })} →
        </span>
      </div>
    </Link>
  );
}
