"use client";

import { ExternalLink, Loader2, Lock } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { blogPostUrl } from "@/lib/blog/json-ld";
import { isValidSlug } from "@/lib/blog/slug";
import { formatDateTime } from "@/lib/format-date";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  BLOG_EXCERPT_MAX,
  BLOG_EXCERPT_SHOWN,
  BLOG_SEO_TITLE_MAX,
  BLOG_SEO_TITLE_SHOWN,
} from "@/services/admin-blog.service";
import { BlogStatusBadge } from "./BlogStatusBadge";
import { CoverImageField } from "./CoverImageField";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";
import { KeywordFields } from "./KeywordFields";
import { SearchPreview } from "./SearchPreview";
import { SeoChecklist } from "./SeoChecklist";

/** "42 / 60 characters shown in search", amber past what Google shows. */
function CharacterCounter({
  id,
  count,
  shown,
}: {
  id: string;
  count: number;
  shown: number;
}) {
  const { t } = useTranslations();
  const over = count > shown;
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn(
        "text-xs tabular-nums",
        over ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      )}
    >
      {over
        ? t("admin.blog.settings.overLimit").replace("{limit}", String(shown))
        : t("admin.blog.settings.counter")
            .replace("{count}", String(count))
            .replace("{limit}", String(shown))}
    </p>
  );
}

// The side panel: status and actions, then the fields that decide how the
// post appears in search and on /blog.
export function PostSettingsPanel() {
  const editorState = useBlogPostEditorContext();
  const {
    post,
    draft,
    dirty,
    busy,
    saving,
    publishing,
    unpublishing,
    deleting,
    slugLocked,
    setSlug,
    resetSlugToTitle,
    setSeoTitle,
    setExcerpt,
    save,
    publish,
    unpublish,
    remove,
  } = editorState;
  const { t, locale } = useTranslations();
  const isPublished = post.status === "published";
  const slugInvalid = !isValidSlug(draft.slug);

  return (
    <aside
      aria-label={t("admin.blog.settings.title")}
      className="flex flex-col gap-5 rounded-lg border bg-card p-4"
    >
      {/* Status */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {t("admin.blog.settings.status")}
          </span>
          <BlogStatusBadge status={post.status} />
        </div>
        <p
          className={cn(
            "text-xs",
            dirty
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
          )}
          data-testid="blog-save-state"
        >
          {dirty
            ? t("admin.blog.editor.unsaved")
            : t("admin.blog.editor.saved")}
          {" · "}
          {t("admin.blog.editor.shortcut")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("admin.blog.settings.lastSaved").replace(
            "{time}",
            formatDateTime(post.updated_at, locale),
          )}
          {post.published_at && (
            <>
              <br />
              {t("admin.blog.settings.publishedAt").replace(
                "{time}",
                formatDateTime(post.published_at, locale),
              )}
            </>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void save()}
            disabled={busy}
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving
              ? t("admin.blog.actions.saving")
              : isPublished
                ? t("admin.blog.actions.saveLive")
                : t("admin.blog.actions.save")}
          </Button>
          {isPublished ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  className="gap-1.5"
                >
                  {unpublishing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("admin.blog.actions.unpublish")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("admin.blog.actions.unpublishTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("admin.blog.actions.unpublishBody")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void unpublish()}>
                    {t("admin.blog.actions.unpublish")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              type="button"
              onClick={() => void publish()}
              disabled={busy}
              className="gap-1.5"
            >
              {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("admin.blog.actions.publish")}
            </Button>
          )}
        </div>

        {isPublished ? (
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <a href={`/blog/${post.slug}`} target="_blank" rel="noopener">
              <ExternalLink className="h-4 w-4" />
              {t("admin.blog.actions.viewLive")}
            </a>
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("admin.blog.actions.delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("admin.blog.actions.deleteTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("admin.blog.actions.deleteBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void remove()}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {t("admin.blog.actions.deleteConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Separator />

      {/* Slug */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="blog-slug">
            {t("admin.blog.settings.slugLabel")}
          </Label>
          {!slugLocked && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={resetSlugToTitle}
            >
              {t("admin.blog.settings.slugFromTitle")}
            </Button>
          )}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            /blog/
          </span>
          <Input
            id="blog-slug"
            value={draft.slug}
            onChange={(event) => setSlug(event.target.value)}
            readOnly={slugLocked}
            maxLength={80}
            aria-invalid={slugInvalid}
            aria-describedby="blog-slug-hint"
            className={cn("pl-14", slugLocked && "bg-muted/40 pr-9")}
          />
          {slugLocked && (
            <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
        <p
          id="blog-slug-hint"
          className={cn(
            "text-xs",
            slugInvalid ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {slugInvalid
            ? t("admin.blog.settings.slugInvalid")
            : slugLocked
              ? t("admin.blog.settings.slugLocked")
              : t("admin.blog.settings.slugHint")}
        </p>
      </div>

      {/* SEO title */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="blog-seo-title">
          {t("admin.blog.settings.seoTitleLabel")}
        </Label>
        <Input
          id="blog-seo-title"
          value={draft.seoTitle}
          onChange={(event) => setSeoTitle(event.target.value)}
          maxLength={BLOG_SEO_TITLE_MAX}
          placeholder={draft.title}
          aria-describedby="blog-seo-title-hint blog-seo-title-count"
        />
        <p id="blog-seo-title-hint" className="text-xs text-muted-foreground">
          {t("admin.blog.settings.seoTitleHint")}
        </p>
        <CharacterCounter
          id="blog-seo-title-count"
          count={(draft.seoTitle.trim() || draft.title.trim()).length}
          shown={BLOG_SEO_TITLE_SHOWN}
        />
      </div>

      {/* Meta description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="blog-excerpt">
          {t("admin.blog.settings.excerptLabel")}
        </Label>
        <Textarea
          id="blog-excerpt"
          value={draft.excerpt}
          onChange={(event) => setExcerpt(event.target.value)}
          maxLength={BLOG_EXCERPT_MAX}
          rows={4}
          aria-describedby="blog-excerpt-hint blog-excerpt-count"
        />
        <p id="blog-excerpt-hint" className="text-xs text-muted-foreground">
          {t("admin.blog.settings.excerptHint")}
        </p>
        <CharacterCounter
          id="blog-excerpt-count"
          count={draft.excerpt.trim().length}
          shown={BLOG_EXCERPT_SHOWN}
        />
      </div>

      <Separator />

      <KeywordFields />
      <SeoChecklist />

      <Separator />

      <CoverImageField />

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          {t("admin.blog.settings.previewTitle")}
        </span>
        <SearchPreview
          title={draft.seoTitle.trim() || draft.title}
          slug={draft.slug}
          description={draft.excerpt}
          date={post.published_at}
        />
        {isPublished && (
          <>
            <p className="text-xs text-muted-foreground">
              {t("admin.blog.settings.indexingHint")}
            </p>
            <code className="break-all text-xs text-muted-foreground">
              {blogPostUrl(post.slug)}
            </code>
            <Button asChild variant="outline" size="sm" className="self-start">
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noopener"
              >
                <ExternalLink className="h-4 w-4" />
                {t("admin.blog.actions.searchConsole")}
              </a>
            </Button>
          </>
        )}
      </div>
    </aside>
  );
}
