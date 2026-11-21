import type { JSONContent } from "@tiptap/core";

/**
 * Shapes the public blog API returns (GET /api/v1/blog/...). Mirrors
 * PublicBlogPostSummary and PublicBlogPost in the backend's
 * app/blog/schemas.py. The admin shapes live in services/admin-blog.service.ts.
 */

/** A TipTap document: `{ type: "doc", content: [...] }`. */
export type BlogContent = JSONContent;

export type BlogLocale = "vi" | "en";

export interface PublicBlogPostSummary {
  slug: string;
  title: string;
  /** The meta description, also the card text on /blog. */
  excerpt: string;
  cover_image_url: string | null;
  cover_alt: string | null;
  published_at: string;
  updated_at: string;
  reading_minutes: number;
}

export interface PublicBlogPost extends PublicBlogPostSummary {
  locale: BlogLocale;
  /** The <title>, when it should differ from the on-page H1. */
  seo_title: string | null;
  content: BlogContent;
}

export interface PublicBlogPostList {
  items: PublicBlogPostSummary[];
}

/** A new post's content: ProseMirror's doc needs at least one block. */
export const EMPTY_BLOG_DOCUMENT: BlogContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
