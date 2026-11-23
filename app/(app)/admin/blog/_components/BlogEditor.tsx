"use client";

import { EditorContent } from "@tiptap/react";
import { Loader2 } from "lucide-react";

import { useTranslations } from "@/lib/i18n";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";
import { EditorToolbar } from "./EditorToolbar";
import { PostTitleInput } from "./PostTitleInput";

// The writing surface: title, toolbar, body and a word count. Styled with the
// same `prose` classes as the public post, so what the admin sees is close to
// what readers get.
export function BlogEditor() {
  // The context changes with every edit, so this re-renders and recounts.
  // (useEditorState took its first value while hydrating, before the editor
  // existed, and kept it until the first edit: "0 từ" on a full post.)
  const { editor } = useBlogPostEditorContext();
  const { t } = useTranslations();
  const words = editor?.storage.characterCount?.words() ?? 0;

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <PostTitleInput />
      {editor ? (
        <>
          <div className="sticky top-0 z-10">
            <EditorToolbar />
          </div>
          <EditorContent editor={editor} />
          <p className="border-t px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
            {t("admin.blog.editor.words").replace(
              "{count}",
              String(words ?? 0),
            )}
          </p>
        </>
      ) : (
        <div className="flex min-h-[24rem] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
