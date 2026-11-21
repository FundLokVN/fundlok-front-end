"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUploadBlogImage } from "@/hooks/use-admin-blog";
import { apiErrorMessage } from "@/lib/api-error-message";
import { useTranslations } from "@/lib/i18n";
import {
  BLOG_ALT_MAX,
  BLOG_IMAGE_TYPES,
  validateBlogImage,
} from "@/services/admin-blog.service";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";

// The cover: top of the post, the card on /blog and the og:image when shared.
export function CoverImageField() {
  const { draft, setCover, setCoverAlt } = useBlogPostEditorContext();
  const { t, locale } = useTranslations();
  const upload = useUploadBlogImage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    const problem = validateBlogImage(file);
    if (problem) {
      setError(
        problem === "too_large"
          ? t("admin.blog.image.tooLarge")
          : t("admin.blog.image.invalidType"),
      );
      return;
    }
    setError(null);
    upload.mutate(
      { file },
      {
        onSuccess: (media) => setCover(media.public_url),
        onError: (err) =>
          setError(
            apiErrorMessage(err, locale, t("admin.blog.image.uploadError")),
          ),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>{t("admin.blog.settings.coverLabel")}</Label>
      <p className="text-xs text-muted-foreground">
        {t("admin.blog.settings.coverHint")}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={BLOG_IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {draft.coverUrl && (
        // The editor shows the uploaded file as is; the public pages size it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={draft.coverUrl}
          alt={draft.coverAlt}
          className="aspect-[1.91/1] w-full rounded-md border bg-muted/30 object-cover"
        />
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {draft.coverUrl
            ? t("admin.blog.settings.coverReplace")
            : t("admin.blog.settings.coverUpload")}
        </Button>
        {draft.coverUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCover(null)}
            disabled={upload.isPending}
          >
            {t("admin.blog.settings.coverRemove")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {draft.coverUrl && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="blog-cover-alt">
            {t("admin.blog.settings.coverAltLabel")}
          </Label>
          <Input
            id="blog-cover-alt"
            value={draft.coverAlt}
            onChange={(event) => setCoverAlt(event.target.value)}
            maxLength={BLOG_ALT_MAX}
          />
        </div>
      )}
    </div>
  );
}
