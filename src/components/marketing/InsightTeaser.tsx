import Link from "next/link";
import { CornerBrackets } from "./primitives";
import { formatDateDE, type InsightArticle } from "@/lib/insights/articles";

/**
 * Article card for the /insights index (and cross-links). The whole card is one
 * focusable link (editorial framed look via CornerBrackets). Title in Fraunces,
 * category eyebrow + German long date in the footer. (§2.2 InsightTeaser.)
 */
export function InsightTeaser({ article }: { article: InsightArticle }) {
  return (
    <Link
      href={`/insights/${article.slug}`}
      className="group relative flex h-full flex-col gap-3 rounded border border-neutral-200 bg-neutral-0 p-7 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
    >
      <CornerBrackets className="border-primary-200" />
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-primary-600">
        {article.category}
      </span>
      <h3 className="font-marketing text-xl font-semibold leading-snug text-neutral-900">
        {article.title}
      </h3>
      <p className="flex-grow text-sm leading-relaxed text-neutral-500">
        {article.excerpt}
      </p>
      <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
        <time dateTime={article.date}>{formatDateDE(article.date)}</time>
        <span
          aria-hidden
          className="font-medium text-primary-600 transition-transform group-hover:translate-x-0.5"
        >
          Lesen →
        </span>
      </div>
    </Link>
  );
}
