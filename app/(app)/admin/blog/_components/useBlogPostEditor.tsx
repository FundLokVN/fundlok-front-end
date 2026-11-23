"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useEditor } from "@tiptap/react";

import { ToastAction } from "@/components/ui/toast";
import {
  useDeleteBlogPost,
  usePublishBlogPost,
  useUnpublishBlogPost,
  useUpdateBlogPost,
} from "@/hooks/use-admin-blog";
import { useToast } from "@/hooks/use-toast";
import { blogEditorExtensions } from "@/lib/blog/extensions";
import {
  addSecondaryKeyword,
  type AddKeywordResult,
} from "@/lib/blog/seo-checklist";
import { isValidSlug, slugify } from "@/lib/blog/slug";
import { useTranslations } from "@/lib/i18n";
import {
  BLOG_KEYWORD_MAX,
  BLOG_SECONDARY_KEYWORDS_MAX,
  type BlogPostDetail,
} from "@/services/admin-blog.service";
import { refreshPublicBlog } from "../actions";
import {
  blogErrorCode,
  blogErrorMessage,
  draftFromPost,
  missingForPublish,
  payloadFromDraft,
  slugFollowsTitle,
  type PostDraft,
} from "./post-editor";

/**
 * Everything the post editor does, in one hook (the provider just hands it
 * to the pieces).
 *
 * The draft — title, slug, SEO fields, cover — is local form state until it
 * is saved; the TipTap editor holds the body. `post` is the server's copy
 * from React Query, updated by every write, and supplies the `version` each
 * write sends back.
 *
 * "Unsaved" is a change counter compared with the counter at the last
 * successful save, so typing while a save is in flight still counts as
 * unsaved once it lands.
 */
export function useBlogPostEditor(post: BlogPostDetail) {
  const { t, locale } = useTranslations();
  const { toast } = useToast();
  const router = useRouter();

  const update = useUpdateBlogPost(post.id);
  const publishMutation = usePublishBlogPost(post.id);
  const unpublishMutation = useUnpublishBlogPost(post.id);
  const deleteMutation = useDeleteBlogPost(post.id);

  const [draft, setDraft] = useState<PostDraft>(() => draftFromPost(post));
  const [slugAuto, setSlugAuto] = useState(() => slugFollowsTitle(post));
  const [changeSeq, setChangeSeq] = useState(0);
  const [savedSeq, setSavedSeq] = useState(0);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  // Set just before a deliberate reload, so the unsaved-changes prompt does
  // not ask a second time.
  const leavingRef = useRef(false);

  const dirty = changeSeq !== savedSeq;
  // Locked from the first publish on, even after an unpublish: live links
  // must not break (the backend answers 422 BLOG_SLUG_LOCKED otherwise).
  const slugLocked = post.published_at !== null;
  const markChanged = useCallback(() => setChangeSeq((seq) => seq + 1), []);

  const editor = useEditor({
    extensions: blogEditorExtensions(t("admin.blog.editor.bodyPlaceholder")),
    content: post.content,
    // The admin pages render on the server first; TipTap must wait for the
    // browser or hydration mismatches.
    immediatelyRender: false,
    onUpdate: markChanged,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none min-h-[24rem] px-4 py-3 focus:outline-none",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": t("admin.blog.editor.bodyLabel"),
      },
    },
  });

  const busy =
    update.isPending ||
    publishMutation.isPending ||
    unpublishMutation.isPending ||
    deleteMutation.isPending;

  // --- Draft fields --------------------------------------------------------

  const setField = useCallback(
    <K extends keyof PostDraft>(name: K, value: PostDraft[K]) => {
      setDraft((prev) => ({ ...prev, [name]: value }));
      markChanged();
    },
    [markChanged],
  );

  const setTitle = (title: string) => {
    setDraft((prev) => ({
      ...prev,
      title,
      slug: slugAuto && !slugLocked ? slugify(title) : prev.slug,
    }));
    markChanged();
  };

  const setSlug = (slug: string) => {
    setSlugAuto(false);
    // Spaces and capitals are never valid; turn them into what was meant.
    setField("slug", slug.toLowerCase().replace(/\s+/g, "-"));
  };

  const resetSlugToTitle = () => {
    setSlugAuto(true);
    setField("slug", slugify(draft.title));
  };

  // --- Server writes -------------------------------------------------------

  const reportError = (error: unknown) => {
    const conflict = blogErrorCode(error) === "BLOG_VERSION_CONFLICT";
    toast({
      variant: "destructive",
      title: t("admin.blog.toast.error"),
      description: blogErrorMessage(error, t, locale),
      action: conflict ? (
        <ToastAction
          altText={t("admin.blog.conflictReload")}
          onClick={() => {
            leavingRef.current = true;
            window.location.reload();
          }}
        >
          {t("admin.blog.conflictReload")}
        </ToastAction>
      ) : undefined,
    });
  };

  /** Expire the public pages' cache; false when that did not happen. */
  const refreshCache = async (): Promise<boolean> => {
    try {
      return (await refreshPublicBlog()).ok;
    } catch {
      return false;
    }
  };

  /** PUT the draft. Resolves with the saved post, or null after a toast. */
  const persist = async (): Promise<BlogPostDetail | null> => {
    if (!editor) return null;
    if (!draft.title.trim() || !isValidSlug(draft.slug)) {
      toast({
        variant: "destructive",
        title: t("admin.blog.toast.error"),
        description: !draft.title.trim()
          ? t("admin.blog.toast.publishMissing").replace(
              "{fields}",
              t("admin.blog.missing.title"),
            )
          : t("admin.blog.settings.slugInvalid"),
      });
      return null;
    }
    const seqAtSave = changeSeq;
    try {
      const saved = await update.mutateAsync(
        payloadFromDraft(draft, editor.getJSON(), post.version),
      );
      setSavedSeq(seqAtSave);
      return saved;
    } catch (error) {
      reportError(error);
      return null;
    }
  };

  const save = async () => {
    if (busy) return;
    const saved = await persist();
    if (!saved) return;
    if (saved.status === "published") {
      const refreshed = await refreshCache();
      toast({
        title: refreshed
          ? t("admin.blog.toast.liveUpdated")
          : t("admin.blog.toast.cacheNotRefreshed"),
      });
    } else {
      toast({ title: t("admin.blog.toast.saved") });
    }
  };

  const publish = async () => {
    if (busy || !editor) return;
    const missing = missingForPublish(draft, editor.getText());
    if (missing.length > 0) {
      toast({
        variant: "destructive",
        title: t("admin.blog.toast.publishMissing").replace(
          "{fields}",
          missing.map((field) => t(`admin.blog.missing.${field}`)).join(", "),
        ),
      });
      return;
    }
    // Publishing makes the SAVED post live, so unsaved edits go first.
    let version = post.version;
    if (dirty) {
      const saved = await persist();
      if (!saved) return;
      version = saved.version;
    }
    try {
      const published = await publishMutation.mutateAsync(version);
      const refreshed = await refreshCache();
      toast({
        title: t("admin.blog.toast.published").replace(
          "{slug}",
          published.slug,
        ),
        description: refreshed
          ? undefined
          : t("admin.blog.toast.cacheNotRefreshed"),
      });
    } catch (error) {
      reportError(error);
    }
  };

  const unpublish = async () => {
    if (busy) return;
    try {
      await unpublishMutation.mutateAsync(post.version);
      await refreshCache();
      toast({ title: t("admin.blog.toast.unpublished") });
    } catch (error) {
      reportError(error);
    }
  };

  const remove = async () => {
    if (busy) return;
    try {
      await deleteMutation.mutateAsync();
      setSavedSeq(changeSeq);
      // Off the page first: the post no longer exists to edit.
      router.push("/admin/blog");
      toast({ title: t("admin.blog.toast.deleted") });
      await refreshCache();
    } catch (error) {
      reportError(error);
    }
  };

  // --- Keyboard and leaving ------------------------------------------------

  // Cmd/Ctrl+S saves instead of opening the browser's "Save page" dialog.
  const onSaveShortcut = useEffectEvent(() => {
    void save();
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        onSaveShortcut();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Closing the tab or reloading with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
      // Older Chromium shows the prompt only when returnValue is set.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // --- Keywords (editor-only; they drive the SEO checklist) ---------------

  const setFocusKeyword = (value: string) => setField("focusKeyword", value);

  /** Add a secondary keyword; the result says why when it was not added. */
  const addKeyword = (raw: string): AddKeywordResult => {
    const { list, result } = addSecondaryKeyword(
      draft.secondaryKeywords,
      draft.focusKeyword,
      raw,
      { max: BLOG_SECONDARY_KEYWORDS_MAX, maxLength: BLOG_KEYWORD_MAX },
    );
    if (result === "added") setField("secondaryKeywords", list);
    return result;
  };

  const removeKeyword = (keyword: string) =>
    setField(
      "secondaryKeywords",
      draft.secondaryKeywords.filter((existing) => existing !== keyword),
    );

  const cover = useMemo(
    () => ({
      setCover: (url: string | null) => {
        setDraft((prev) => ({
          ...prev,
          coverUrl: url,
          coverAlt: url ? prev.coverAlt : "",
        }));
        markChanged();
      },
      setCoverAlt: (alt: string) => setField("coverAlt", alt),
    }),
    [markChanged, setField],
  );

  return {
    post,
    editor,
    draft,
    dirty,
    busy,
    saving: update.isPending,
    publishing: publishMutation.isPending,
    unpublishing: unpublishMutation.isPending,
    deleting: deleteMutation.isPending,
    slugLocked,
    slugAuto,
    setTitle,
    setSlug,
    resetSlugToTitle,
    setSeoTitle: (value: string) => setField("seoTitle", value),
    setExcerpt: (value: string) => setField("excerpt", value),
    setFocusKeyword,
    addKeyword,
    removeKeyword,
    // Bumped by every edit, body included: what the checklist recomputes on.
    revision: changeSeq,
    ...cover,
    save,
    publish,
    unpublish,
    remove,
    linkDialogOpen,
    setLinkDialogOpen,
    imageDialogOpen,
    setImageDialogOpen,
  };
}

export type BlogPostEditorState = ReturnType<typeof useBlogPostEditor>;
