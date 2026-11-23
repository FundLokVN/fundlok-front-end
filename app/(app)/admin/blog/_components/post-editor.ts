import { apiErrorMessage } from "@/lib/api-error-message";
import { normalizeKeyword } from "@/lib/blog/seo-checklist";
import { isValidSlug, slugify } from "@/lib/blog/slug";
import type { ApiError } from "@/lib/types";
import type {
  BlogPostDetail,
  BlogPostUpdatePayload,
} from "@/services/admin-blog.service";
import type { BlogContent } from "@/lib/blog/types";

/** What the editor holds locally until it is saved (a form draft). */
export interface PostDraft {
  title: string;
  slug: string;
  seoTitle: string;
  excerpt: string;
  coverUrl: string | null;
  coverAlt: string;
  focusKeyword: string;
  secondaryKeywords: string[];
}

export function draftFromPost(post: BlogPostDetail): PostDraft {
  return {
    title: post.title,
    slug: post.slug,
    seoTitle: post.seo_title ?? "",
    excerpt: post.excerpt,
    coverUrl: post.cover_image_url,
    coverAlt: post.cover_alt ?? "",
    focusKeyword: post.focus_keyword ?? "",
    secondaryKeywords: post.secondary_keywords ?? [],
  };
}

export function payloadFromDraft(
  draft: PostDraft,
  content: BlogContent,
  version: number,
): BlogPostUpdatePayload {
  return {
    title: draft.title.trim(),
    slug: draft.slug,
    seo_title: draft.seoTitle.trim() || null,
    excerpt: draft.excerpt.trim(),
    content,
    cover_image_url: draft.coverUrl,
    cover_alt: draft.coverUrl ? draft.coverAlt.trim() || null : null,
    focus_keyword: normalizeKeyword(draft.focusKeyword) || null,
    secondary_keywords: draft.secondaryKeywords,
    version,
  };
}

/**
 * The slug follows the title until someone edits it by hand. A new draft's
 * slug was made from its title by the backend (with "-2" when taken), so it
 * starts out following; a slug locked by a publish never does.
 */
export function slugFollowsTitle(post: BlogPostDetail): boolean {
  if (post.published_at) return false;
  const fromTitle = slugify(post.title);
  return (
    fromTitle !== "" &&
    (post.slug === fromTitle || post.slug.startsWith(`${fromTitle}-`))
  );
}

export type MissingField =
  "title" | "slug" | "excerpt" | "content" | "coverAlt";

/**
 * What still blocks a publish, in the order the form shows it. The backend
 * checks title, excerpt and body text (422 BLOG_PUBLISH_INCOMPLETE); this
 * says so before the round trip, and also asks for the cover's alt text.
 */
export function missingForPublish(
  draft: PostDraft,
  bodyText: string,
): MissingField[] {
  const missing: MissingField[] = [];
  if (!draft.title.trim()) missing.push("title");
  if (!isValidSlug(draft.slug)) missing.push("slug");
  if (!draft.excerpt.trim()) missing.push("excerpt");
  if (!bodyText.trim()) missing.push("content");
  if (draft.coverUrl && !draft.coverAlt.trim()) missing.push("coverAlt");
  return missing;
}

/** X-Error-Code values the blog endpoints answer with; each has copy. */
export const BLOG_ERROR_CODES = [
  "BLOG_VERSION_CONFLICT",
  "BLOG_SLUG_TAKEN",
  "BLOG_DELETE_PUBLISHED",
  "BLOG_SLUG_LOCKED",
  "BLOG_CONTENT_INVALID",
  "BLOG_PUBLISH_INCOMPLETE",
] as const;

export type BlogErrorCode = (typeof BLOG_ERROR_CODES)[number];

export function blogErrorCode(error: unknown): BlogErrorCode | null {
  const code = (error as ApiError | null | undefined)?.code;
  return (BLOG_ERROR_CODES as readonly string[]).includes(code ?? "")
    ? (code as BlogErrorCode)
    : null;
}

/** The toast text for a failed blog call, in the reader's language. */
export function blogErrorMessage(
  error: unknown,
  t: (key: string) => string,
  locale: string,
): string {
  const code = blogErrorCode(error);
  if (code) return t(`admin.blog.errors.${code}`);
  return apiErrorMessage(error, locale, t("admin.blog.toast.error"));
}
