"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUploadBlogImage } from "@/hooks/use-admin-blog";
import { useObjectUrl } from "@/hooks/use-object-url";
import { apiErrorMessage } from "@/lib/api-error-message";
import { useTranslations } from "@/lib/i18n";
import {
  BLOG_ALT_MAX,
  BLOG_IMAGE_TYPES,
  validateBlogImage,
} from "@/services/admin-blog.service";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";

// Pick a file, upload it (presign → PUT to R2 → confirm), give it alt text,
// insert it. The alt text is required here as it is by the backend: images
// without it fail accessibility and tell search engines nothing.
export function ImageInsertDialog() {
  const { editor, imageDialogOpen, setImageDialogOpen } =
    useBlogPostEditorContext();

  return (
    <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        {imageDialogOpen && editor && (
          <ImageInsertForm
            onInsert={(src, alt) => {
              editor.chain().focus().setImage({ src, alt }).run();
              setImageDialogOpen(false);
            }}
            onCancel={() => setImageDialogOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImageInsertForm({
  onInsert,
  onCancel,
}: {
  onInsert: (src: string, alt: string) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useTranslations();
  const upload = useUploadBlogImage();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const preview = useObjectUrl(file);
  const altMissing = !alt.trim();

  const chooseFile = (next: File | null) => {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    const problem = validateBlogImage(next);
    if (problem) {
      setFile(null);
      setError(
        problem === "too_large"
          ? t("admin.blog.image.tooLarge")
          : t("admin.blog.image.invalidType"),
      );
      return;
    }
    setFile(next);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (!file || altMissing || upload.isPending) return;
        setProgress(0);
        upload.mutate(
          { file, onProgress: setProgress },
          {
            onSuccess: (media) => onInsert(media.public_url, alt.trim()),
            onError: (err) =>
              setError(
                apiErrorMessage(err, locale, t("admin.blog.image.uploadError")),
              ),
          },
        );
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{t("admin.blog.image.title")}</DialogTitle>
        <DialogDescription>
          {t("admin.blog.image.description")}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="blog-image-file">
          {t("admin.blog.image.fileLabel")}
        </Label>
        <Input
          id="blog-image-file"
          type="file"
          accept={BLOG_IMAGE_TYPES.join(",")}
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          aria-describedby="blog-image-file-hint"
          disabled={upload.isPending}
        />
        <p id="blog-image-file-hint" className="text-xs text-muted-foreground">
          {t("admin.blog.image.fileHint")}
        </p>
      </div>

      {preview && (
        // A local blob: preview of the file before it is uploaded.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="max-h-56 w-full rounded-md border object-contain bg-muted/30"
        />
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="blog-image-alt">{t("admin.blog.image.altLabel")}</Label>
        <Input
          id="blog-image-alt"
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          maxLength={BLOG_ALT_MAX}
          aria-invalid={submitted && altMissing}
          aria-describedby="blog-image-alt-hint"
          disabled={upload.isPending}
        />
        <p
          id="blog-image-alt-hint"
          className={
            submitted && altMissing
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {submitted && altMissing
            ? t("admin.blog.image.altRequired")
            : t("admin.blog.image.altHint")}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={upload.isPending}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={!file || upload.isPending}
          className="gap-2"
        >
          {upload.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {upload.isPending
            ? `${t("admin.blog.image.uploading")} ${progress}%`
            : t("admin.blog.image.insert")}
        </Button>
      </DialogFooter>
    </form>
  );
}
