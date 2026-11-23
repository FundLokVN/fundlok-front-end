"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, MinusCircle } from "lucide-react";

import { useBlogKeywordUsage } from "@/hooks/use-admin-blog";
import { seoChecklist, type SeoCheckState } from "@/lib/blog/seo-checklist";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";

/** The value, once it has stopped changing for `delay` ms. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function StateIcon({ state }: { state: SeoCheckState }) {
  if (state === "pass") {
    return (
      <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
    );
  }
  if (state === "na") {
    return (
      <MinusCircle className="mt-px h-4 w-4 shrink-0 text-muted-foreground" />
    );
  }
  return (
    <Circle className="mt-px h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
  );
}

// Live as the admin types: checks the focus keyword against the title, SEO
// title, description, slug, opening paragraph, headings and image alt text,
// lists which secondary keywords the article mentions, and warns when another
// post already targets the same focus keyword.
export function SeoChecklist() {
  const { post, draft, editor, revision } = useBlogPostEditorContext();
  const { t } = useTranslations();

  // `revision` changes with every edit, body included, so the document is
  // re-read whenever anything the checklist looks at may have changed.
  const result = useMemo(
    () =>
      seoChecklist({
        focusKeyword: draft.focusKeyword,
        secondaryKeywords: draft.secondaryKeywords,
        postTitle: draft.title,
        searchTitle: draft.seoTitle.trim() || draft.title,
        description: draft.excerpt,
        slug: draft.slug,
        coverAlt: draft.coverUrl ? draft.coverAlt : "",
        content: editor && revision >= 0 ? editor.getJSON() : post.content,
      }),
    [draft, editor, revision, post.content],
  );

  const focus = useDebouncedValue(draft.focusKeyword.trim(), 500);
  const usage = useBlogKeywordUsage(focus, post.id);
  const conflicts = usage.data?.posts ?? [];

  const hasFocus = draft.focusKeyword.trim() !== "";

  return (
    <section
      aria-labelledby="blog-seo-checklist-title"
      className="flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          id="blog-seo-checklist-title"
          className="text-sm font-medium text-foreground"
        >
          {t("admin.blog.checklist.title")}
        </span>
        {hasFocus && (
          <span
            className="text-xs tabular-nums text-muted-foreground"
            data-testid="blog-seo-score"
          >
            {t("admin.blog.checklist.summary")
              .replace("{passed}", String(result.passed))
              .replace("{total}", String(result.total))}
          </span>
        )}
      </div>

      {!hasFocus ? (
        <p className="text-xs text-muted-foreground">
          {t("admin.blog.checklist.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {result.checks.map((check) => (
            <li
              key={check.id}
              className="flex items-start gap-2 text-xs text-foreground"
              data-state={check.state}
              data-testid={`blog-seo-check-${check.id}`}
            >
              <StateIcon state={check.state} />
              <span className="min-w-0 break-words">
                {t(`admin.blog.checklist.${check.id}.${check.state}`)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.secondary.length > 0 && (
        <ul
          className="flex flex-col gap-1.5"
          aria-label={t("admin.blog.keywords.secondaryLabel")}
        >
          {result.secondary.map(({ keyword, found }) => (
            <li
              key={keyword}
              className="flex items-start gap-2 text-xs text-foreground"
              data-state={found ? "pass" : "fail"}
            >
              <StateIcon state={found ? "pass" : "fail"} />
              <span className="min-w-0 break-words">
                {t(
                  found
                    ? "admin.blog.checklist.secondaryFound"
                    : "admin.blog.checklist.secondaryMissing",
                ).replace("{keyword}", keyword)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasFocus && conflicts.length > 0 && (
        <div
          role="status"
          className={cn(
            "flex flex-col gap-1.5 rounded-md border p-3 text-xs",
            "border-amber-500/40 bg-amber-500/10 text-foreground",
          )}
        >
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {t("admin.blog.checklist.conflictTitle")}
          </p>
          <ul className="flex flex-col gap-1 pl-6">
            {conflicts.map((other) => (
              <li key={other.id} className="min-w-0 break-words">
                <Link
                  href={`/admin/blog/${other.id}`}
                  className="underline underline-offset-2 hover:text-primary"
                >
                  {other.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="pl-6 text-muted-foreground">
            {t("admin.blog.checklist.conflictHint")}
          </p>
        </div>
      )}
    </section>
  );
}
