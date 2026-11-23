"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { useTranslations } from "@/lib/i18n";
import type { BlogPostDetail } from "@/services/admin-blog.service";
import { BlogEditor } from "./BlogEditor";
import { BlogPostEditorProvider } from "./BlogPostEditorContext";
import { ImageInsertDialog } from "./ImageInsertDialog";
import { LinkDialog } from "./LinkDialog";
import { PostSettingsPanel } from "./PostSettingsPanel";

// The editor page's layout: writing on the left, settings on the right. All
// state lives in BlogPostEditorProvider; keyed by the post so another post
// never inherits this one's draft.
export function BlogPostEditor({ post }: { post: BlogPostDetail }) {
  const { t } = useTranslations();
  return (
    <BlogPostEditorProvider key={post.id} post={post}>
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/blog"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("admin.blog.editor.back")}
        </Link>
        {/* grid-cols-1 is minmax(0, 1fr): without it the phone layout's one
            column is `auto` and grows to the search preview's unwrapped URL,
            pushing the settings panel past the screen's right edge. */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <BlogEditor />
          <div className="lg:sticky lg:top-4">
            <PostSettingsPanel />
          </div>
        </div>
      </div>
      <LinkDialog />
      <ImageInsertDialog />
    </BlogPostEditorProvider>
  );
}
