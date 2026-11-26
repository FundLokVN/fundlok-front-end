"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBlogSeoAssistant, useSuggestBlogSeo } from "@/hooks/use-admin-blog";
import { keywordKey } from "@/lib/blog/seo-checklist";
import { useTranslations } from "@/lib/i18n";
import type { ApiError } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BLOG_EXCERPT_SHOWN,
  BLOG_SECONDARY_KEYWORDS_MAX,
  BLOG_SEO_TITLE_SHOWN,
  type BlogSeoSuggestions,
} from "@/services/admin-blog.service";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";

const ERROR_CODES = [
  "BLOG_SEO_BUSY",
  "BLOG_SEO_NO_CREDIT",
  "BLOG_SEO_FAILED",
  "BLOG_SEO_UNAVAILABLE",
] as const;

/** The i18n key for a failed request; timeouts and 422s get the generic one. */
export function seoSuggestionErrorKey(error: ApiError | null): string {
  const code = error?.code ?? "";
  return (ERROR_CODES as readonly string[]).includes(code)
    ? `admin.blog.seoAssistant.errors.${code}`
    : "admin.blog.seoAssistant.errors.generic";
}

function SuggestionRow({
  value,
  note,
  shown,
  applied,
  disabled = false,
  onUse,
}: {
  value: string;
  note?: string;
  /** What search shows; the count turns amber past it. */
  shown?: number;
  applied: boolean;
  disabled?: boolean;
  onUse: () => void;
}) {
  const { t } = useTranslations();
  return (
    <li
      className="flex flex-col gap-1.5 rounded-md border p-2.5"
      data-applied={applied}
    >
      <p className="break-words text-sm text-foreground">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <div className="flex items-center justify-between gap-2">
        {shown ? (
          <span
            className={cn(
              "text-xs tabular-nums",
              value.length > shown
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
            )}
          >
            {t("admin.blog.seoAssistant.characters").replace(
              "{count}",
              String(value.length),
            )}
          </span>
        ) : (
          <span />
        )}
        {applied ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            {t("admin.blog.seoAssistant.applied")}
          </span>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={onUse}
            disabled={disabled}
            aria-label={t("admin.blog.seoAssistant.useLabel").replace(
              "{value}",
              value,
            )}
          >
            {t("admin.blog.seoAssistant.use")}
          </Button>
        )}
      </div>
    </li>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <ul className="flex flex-col gap-1.5" aria-label={label}>
        {children}
      </ul>
    </div>
  );
}

// "Suggest SEO": Claude reads the draft on screen (unsaved edits included)
// and proposes SEO titles, a meta description and keywords. "Use this" sets
// one field of the draft, so the checklist and the search preview follow at
// once; Save or Publish writes it as usual. The request runs in the
// background and never touches the draft, so editing carries on and a
// failure changes nothing. See docs/specs/blog/seo-assistant.md (backend).
export function SeoSuggestions() {
  const {
    post,
    editor,
    draft,
    setSeoTitle,
    setExcerpt,
    setFocusKeyword,
    addKeyword,
  } = useBlogPostEditorContext();
  const { t } = useTranslations();
  const status = useBlogSeoAssistant();
  const suggest = useSuggestBlogSeo();
  // The last good answer, kept in the editor until it is used or hidden; a
  // later failed attempt does not wipe it.
  const [suggestions, setSuggestions] = useState<BlogSeoSuggestions | null>(
    null,
  );

  if (!status.data?.enabled) return null;

  const ready = draft.title.trim() !== "" && !!editor && !editor.isEmpty;
  const pending = suggest.isPending;

  const run = () => {
    if (!editor || pending) return;
    suggest.mutate(
      {
        title: draft.title.trim(),
        locale: post.locale,
        text: editor.getText({ blockSeparator: "\n\n" }),
      },
      { onSuccess: setSuggestions },
    );
  };

  const hide = () => {
    setSuggestions(null);
    suggest.reset();
  };

  const focusKey = keywordKey(draft.focusKeyword);
  const secondaryKeys = draft.secondaryKeywords.map(keywordKey);
  const secondaryFull =
    draft.secondaryKeywords.length >= BLOG_SECONDARY_KEYWORDS_MAX;

  return (
    <section
      aria-labelledby="blog-seo-suggestions-title"
      className="flex flex-col gap-2"
      data-testid="blog-seo-suggestions"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          id="blog-seo-suggestions-title"
          className="text-sm font-medium text-foreground"
        >
          {t("admin.blog.seoAssistant.title")}
        </span>
        {suggestions && !pending && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={hide}
          >
            {t("admin.blog.seoAssistant.clear")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("admin.blog.seoAssistant.hint")}
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={run}
        disabled={pending || !ready}
        className="gap-1.5 self-start"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {pending
          ? t("admin.blog.seoAssistant.working")
          : suggestions
            ? t("admin.blog.seoAssistant.suggestAgain")
            : t("admin.blog.seoAssistant.suggest")}
      </Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {pending
          ? t("admin.blog.seoAssistant.workingHint")
          : !ready
            ? t("admin.blog.seoAssistant.needsDraft")
            : null}
      </p>

      {suggest.isError && (
        <div
          role="alert"
          className="flex flex-col items-start gap-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground"
        >
          <p>{t(seoSuggestionErrorKey(suggest.error))}</p>
          {suggest.error?.code !== "BLOG_SEO_UNAVAILABLE" && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={run}
              disabled={!ready}
            >
              {t("admin.blog.seoAssistant.retry")}
            </Button>
          )}
        </div>
      )}

      {suggestions && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {t("admin.blog.seoAssistant.review")}
          </p>

          <Group label={t("admin.blog.seoAssistant.titles")}>
            {suggestions.titles.map((option) => (
              <SuggestionRow
                key={option.title}
                value={option.title}
                note={option.intent}
                shown={BLOG_SEO_TITLE_SHOWN}
                applied={draft.seoTitle.trim() === option.title}
                onUse={() => setSeoTitle(option.title)}
              />
            ))}
          </Group>

          <Group label={t("admin.blog.seoAssistant.description")}>
            <SuggestionRow
              value={suggestions.meta_description}
              shown={BLOG_EXCERPT_SHOWN}
              applied={draft.excerpt.trim() === suggestions.meta_description}
              onUse={() => setExcerpt(suggestions.meta_description)}
            />
          </Group>

          <Group label={t("admin.blog.seoAssistant.focus")}>
            <SuggestionRow
              value={suggestions.focus_keyword}
              applied={focusKey === keywordKey(suggestions.focus_keyword)}
              onUse={() => setFocusKeyword(suggestions.focus_keyword)}
            />
          </Group>

          {suggestions.related_terms.length > 0 && (
            <Group label={t("admin.blog.seoAssistant.related")}>
              {suggestions.related_terms.map((term) => {
                const key = keywordKey(term);
                return (
                  <SuggestionRow
                    key={term}
                    value={term}
                    applied={key === focusKey || secondaryKeys.includes(key)}
                    disabled={secondaryFull}
                    onUse={() => addKeyword(term)}
                  />
                );
              })}
              {secondaryFull && (
                <li className="text-xs text-muted-foreground">
                  {t("admin.blog.seoAssistant.relatedFull").replace(
                    "{limit}",
                    String(BLOG_SECONDARY_KEYWORDS_MAX),
                  )}
                </li>
              )}
            </Group>
          )}
        </div>
      )}
    </section>
  );
}
