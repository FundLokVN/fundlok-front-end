"use client";

import { formatDate } from "@/lib/format-date";
import { useTranslations } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import {
  BLOG_EXCERPT_SHOWN,
  BLOG_SEO_TITLE_SHOWN,
} from "@/services/admin-blog.service";

function clip(text: string, limit: number): string {
  const trimmed = text.trim();
  return trimmed.length > limit
    ? `${trimmed.slice(0, limit - 1).trimEnd()}…`
    : trimmed;
}

/**
 * Roughly how the post will look as a Google result: site name, URL
 * breadcrumb, title, date and description, cut where Google tends to cut.
 * A guide for the author, not a promise of Google's rendering.
 */
export function SearchPreview({
  title,
  slug,
  description,
  date,
}: {
  title: string;
  slug: string;
  description: string;
  date: string | null;
}) {
  const { t, locale } = useTranslations();
  const host = new URL(SITE_URL).host;

  return (
    <div
      className="rounded-lg border bg-background p-4 text-left"
      aria-label={t("admin.blog.settings.previewTitle")}
      role="figure"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
        >
          F
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-sm text-foreground">FundLok</p>
          <p className="truncate text-xs text-muted-foreground">
            https://{host} › blog › {slug || "…"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-lg leading-snug text-blue-700 dark:text-blue-300">
        {clip(title, BLOG_SEO_TITLE_SHOWN) || "…"}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        <span>{formatDate(date ?? new Date(), locale)} — </span>
        {description.trim()
          ? clip(description, BLOG_EXCERPT_SHOWN)
          : t("admin.blog.settings.previewDescriptionEmpty")}
      </p>
    </div>
  );
}
