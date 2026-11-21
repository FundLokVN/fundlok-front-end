"use client";

import { useTranslations } from "@/lib/i18n";
import { BLOG_TITLE_MAX } from "@/services/admin-blog.service";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";

// The post's H1. Enter moves into the body rather than doing nothing.
export function PostTitleInput() {
  const { draft, setTitle, editor } = useBlogPostEditorContext();
  const { t } = useTranslations();

  return (
    <textarea
      value={draft.title}
      onChange={(event) => setTitle(event.target.value.replace(/\n/g, " "))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          editor?.commands.focus("start");
        }
      }}
      rows={1}
      maxLength={BLOG_TITLE_MAX}
      placeholder={t("admin.blog.editor.titlePlaceholder")}
      aria-label={t("admin.blog.editor.titleLabel")}
      className="field-sizing-content w-full resize-none border-0 bg-transparent px-4 pt-4 text-3xl font-bold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
    />
  );
}
