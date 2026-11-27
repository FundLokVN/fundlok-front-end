"use client";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format-date";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BlogIndexStatus } from "@/services/admin-blog.service";

type IndexKey = "indexed" | "problem" | "notIndexed" | "unchecked";

/** Which of the four states a post is in, from Google's verdict. */
export function indexKey(status: BlogIndexStatus | null | undefined): IndexKey {
  if (!status) return "unchecked";
  if (status.verdict === "PASS") return "indexed";
  if (status.verdict === "PARTIAL" || status.verdict === "FAIL") {
    return "problem";
  }
  return "notIndexed";
}

// Ascending sort puts what needs attention first: not indexed, then
// problems, then indexed; never-checked last.
const RANK: Record<IndexKey, number | null> = {
  notIndexed: 0,
  problem: 1,
  indexed: 2,
  unchecked: null,
};

export function indexRank(
  status: BlogIndexStatus | null | undefined,
): number | null {
  return RANK[indexKey(status)];
}

const STYLE: Record<IndexKey, string> = {
  indexed:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  problem:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  notIndexed: "text-foreground",
  unchecked: "text-muted-foreground",
};

/**
 * Whether Google has indexed a published post, from the daily URL Inspection
 * check. The tooltip carries Google's own wording and the last crawl, which
 * say why a post is not indexed yet.
 */
export function BlogIndexBadge({ status }: { status: BlogIndexStatus | null }) {
  const { t, locale } = useTranslations();
  const key = indexKey(status);
  const details = status
    ? [
        status.coverage_state,
        status.last_crawl_at
          ? t("admin.blog.indexStatus.lastCrawl").replace(
              "{time}",
              formatDateTime(status.last_crawl_at, locale),
            )
          : t("admin.blog.indexStatus.neverCrawled"),
        t("admin.blog.indexStatus.checked").replace(
          "{time}",
          formatDateTime(status.checked_at, locale),
        ),
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap", STYLE[key])}
      title={details}
      data-testid="index-status"
    >
      {t(`admin.blog.indexStatus.${key}`)}
    </Badge>
  );
}
