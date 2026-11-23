"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddKeywordResult } from "@/lib/blog/seo-checklist";
import { useTranslations } from "@/lib/i18n";
import {
  BLOG_KEYWORD_MAX,
  BLOG_SECONDARY_KEYWORDS_MAX,
} from "@/services/admin-blog.service";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";

// The focus keyword and up to four secondary ones. Editor-only: they drive
// the SEO checklist below and are never written into the page.
export function KeywordFields() {
  const { draft, setFocusKeyword, addKeyword, removeKeyword } =
    useBlogPostEditorContext();
  const { t } = useTranslations();
  const [pending, setPending] = useState("");
  const [refused, setRefused] = useState<AddKeywordResult | null>(null);
  const full = draft.secondaryKeywords.length >= BLOG_SECONDARY_KEYWORDS_MAX;

  const commit = () => {
    if (!pending.trim()) return;
    const result = addKeyword(pending);
    setRefused(result === "added" ? null : result);
    if (result === "added") setPending("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      // Enter must not submit anything else on the page.
      event.preventDefault();
      commit();
    } else if (
      event.key === "Backspace" &&
      pending === "" &&
      draft.secondaryKeywords.length > 0
    ) {
      removeKeyword(draft.secondaryKeywords.at(-1)!);
    }
  };

  const limit = String(BLOG_SECONDARY_KEYWORDS_MAX);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          {t("admin.blog.keywords.title")}
        </span>
        <p className="text-xs text-muted-foreground">
          {t("admin.blog.keywords.hint")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="blog-focus-keyword">
          {t("admin.blog.keywords.focusLabel")}
        </Label>
        <Input
          id="blog-focus-keyword"
          value={draft.focusKeyword}
          onChange={(event) => setFocusKeyword(event.target.value)}
          maxLength={BLOG_KEYWORD_MAX}
          placeholder={t("admin.blog.keywords.focusPlaceholder")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="blog-secondary-keyword">
            {t("admin.blog.keywords.secondaryLabel")}
          </Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("admin.blog.keywords.secondaryCount")
              .replace("{count}", String(draft.secondaryKeywords.length))
              .replace("{limit}", limit)}
          </span>
        </div>
        {draft.secondaryKeywords.length > 0 && (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={t("admin.blog.keywords.secondaryLabel")}
          >
            {draft.secondaryKeywords.map((keyword) => (
              <li key={keyword} className="min-w-0 max-w-full">
                <Badge
                  variant="secondary"
                  className="max-w-full gap-1 py-0.5 pr-1 text-xs font-normal"
                >
                  <span className="truncate">{keyword}</span>
                  <button
                    type="button"
                    onClick={() => removeKeyword(keyword)}
                    aria-label={t("admin.blog.keywords.remove").replace(
                      "{keyword}",
                      keyword,
                    )}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <Input
          id="blog-secondary-keyword"
          value={pending}
          onChange={(event) => {
            setPending(event.target.value);
            setRefused(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={commit}
          disabled={full}
          maxLength={BLOG_KEYWORD_MAX}
          placeholder={
            full
              ? t("admin.blog.keywords.secondaryFull").replace("{limit}", limit)
              : t("admin.blog.keywords.secondaryPlaceholder")
          }
          aria-describedby="blog-secondary-keyword-hint"
        />
        <p
          id="blog-secondary-keyword-hint"
          aria-live="polite"
          className={
            refused === "duplicate"
              ? "text-xs text-amber-600 dark:text-amber-400"
              : "text-xs text-muted-foreground"
          }
        >
          {refused === "duplicate"
            ? t("admin.blog.keywords.duplicate")
            : t("admin.blog.keywords.secondaryHint")}
        </p>
      </div>
    </div>
  );
}
