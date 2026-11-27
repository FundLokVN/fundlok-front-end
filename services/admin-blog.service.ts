import { apiClient } from "@/lib/api-client";
import type { BlogContent, BlogLocale } from "@/lib/blog/types";
import { ADMIN_BLOG_ENDPOINTS } from "@/lib/endpoints";
import { uploadsService } from "@/services/uploads.service";

// Admin > Blog: drafting, publishing and image upload for the public blog.
// Mirrors app/blog/schemas.py in the backend.

export type BlogPostStatus = "draft" | "published";

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  // The meta description. "" until written; required to publish.
  excerpt: string;
  status: BlogPostStatus;
  cover_image_url: string | null;
  cover_alt: string | null;
  // Set on the FIRST publish and kept through an unpublish: the slug is locked
  // from then on (422 BLOG_SLUG_LOCKED).
  published_at: string | null;
  updated_at: string;
  created_at: string;
  reading_minutes: number;
  /** Aggregate views since counting began. Absent on older API versions. */
  view_count?: number;
  /**
   * Google Search figures over the list's window (see BlogSearchConsoleStatus).
   * null when Google has not reported the post; absent outside the list and on
   * older API versions.
   */
  search?: BlogSearchStats | null;
}

/** A post's Google Search figures, from Search Console's daily sync. */
export interface BlogSearchStats {
  clicks: number;
  impressions: number;
  /** Average position, weighted by impressions. null with no impressions. */
  position: number | null;
}

/** Where the list's Google figures come from: the `window_days` ending on `data_through`. */
export interface BlogSearchConsoleStatus {
  configured: boolean;
  last_synced_at: string | null;
  data_through: string | null;
  window_days: number;
}

export interface BlogPostDetail extends BlogPostSummary {
  locale: BlogLocale;
  seo_title: string | null;
  content: BlogContent;
  // Optimistic lock: sent back on every write, bumped by each one. A write
  // with an older value answers 409 BLOG_VERSION_CONFLICT.
  version: number;
  author_id: string | null;
  updated_by: string | null;
  // Editor-only SEO targets: they drive the checklist and never reach the
  // public page (search engines ignore <meta name="keywords">).
  focus_keyword: string | null;
  secondary_keywords: string[];
}

/** Other posts whose focus keyword is the same (case-insensitive). */
export interface BlogKeywordUsage {
  keyword: string;
  posts: { id: string; slug: string; title: string; status: BlogPostStatus }[];
}

export interface BlogPostListParams {
  status?: BlogPostStatus;
  search?: string;
  page: number;
  page_size: number;
}

export interface BlogPostList {
  total: number;
  page: number;
  page_size: number;
  items: BlogPostSummary[];
  /** Absent on older API versions. */
  search_console?: BlogSearchConsoleStatus;
}

// The whole editable post. The backend refuses anything outside the
// allowlist in `content` (422 BLOG_CONTENT_INVALID) and a slug change after
// the first publish (422 BLOG_SLUG_LOCKED).
export interface BlogPostUpdatePayload {
  title: string;
  slug: string;
  seo_title: string | null;
  excerpt: string;
  content: BlogContent;
  cover_image_url: string | null;
  cover_alt: string | null;
  focus_keyword: string | null;
  secondary_keywords: string[];
  version: number;
}

export interface BlogMediaPresign {
  media_id: string;
  upload_url: string;
  public_url: string;
}

export interface BlogMediaConfirm {
  media_id: string;
  public_url: string;
}

/** Whether the editor shows "Suggest SEO" to the signed-in admin. */
export interface BlogSeoAssistantStatus {
  enabled: boolean;
}

/** The draft on screen, unsaved edits included, body as plain text. */
export interface BlogSeoSuggestionRequest {
  title: string;
  locale: BlogLocale;
  text: string;
}

// Claude's suggestions, already checked by the backend against the limits
// below and FundLok's copy rules (docs/specs/blog/seo-assistant.md).
export interface BlogSeoSuggestions {
  titles: { title: string; intent: string }[];
  meta_description: string;
  focus_keyword: string;
  related_terms: string[];
}

// The backend answers within 25 s (the /api rewrite gives up at 30 s).
const SEO_SUGGESTIONS_TIMEOUT_MS = 35_000;

// Same rules as the backend (MEDIA_CONTENT_TYPE_EXTENSIONS, MEDIA_MAX_SIZE).
export const BLOG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Limits from BlogPostUpdate, so the inputs stop where the backend would 422.
export const BLOG_TITLE_MAX = 200;
export const BLOG_SEO_TITLE_MAX = 70;
export const BLOG_EXCERPT_MAX = 300;
export const BLOG_ALT_MAX = 200;
export const BLOG_KEYWORD_MAX = 100;
export const BLOG_SECONDARY_KEYWORDS_MAX = 4;
// What Google shows before cutting off; the editor's counters warn past these.
export const BLOG_SEO_TITLE_SHOWN = 60;
export const BLOG_EXCERPT_SHOWN = 160;

export type BlogImageError = "invalid_type" | "too_large";

export function validateBlogImage(file: File): BlogImageError | null {
  if (!BLOG_IMAGE_TYPES.includes(file.type)) return "invalid_type";
  if (file.size > BLOG_IMAGE_MAX_BYTES) return "too_large";
  return null;
}

export const adminBlogService = {
  list(params: BlogPostListParams) {
    return apiClient.get<BlogPostList>(ADMIN_BLOG_ENDPOINTS.posts, {
      params: {
        status: params.status,
        search: params.search?.trim() || undefined,
        page: params.page,
        page_size: params.page_size,
      },
    });
  },

  create(title: string) {
    return apiClient.post<BlogPostDetail>(ADMIN_BLOG_ENDPOINTS.posts, {
      title,
    });
  },

  get(id: string) {
    return apiClient.get<BlogPostDetail>(ADMIN_BLOG_ENDPOINTS.post(id));
  },

  update(id: string, payload: BlogPostUpdatePayload) {
    return apiClient.put<BlogPostDetail>(
      ADMIN_BLOG_ENDPOINTS.post(id),
      payload,
    );
  },

  // Publishes what is SAVED, not what is on screen: save first.
  publish(id: string, version: number) {
    return apiClient.post<BlogPostDetail>(ADMIN_BLOG_ENDPOINTS.publish(id), {
      version,
    });
  },

  unpublish(id: string, version: number) {
    return apiClient.post<BlogPostDetail>(ADMIN_BLOG_ENDPOINTS.unpublish(id), {
      version,
    });
  },

  remove(id: string) {
    return apiClient.delete<void>(ADMIN_BLOG_ENDPOINTS.post(id));
  },

  keywordUsage(keyword: string, excludeId?: string) {
    return apiClient.get<BlogKeywordUsage>(ADMIN_BLOG_ENDPOINTS.keywordUsage, {
      params: { keyword, exclude_id: excludeId },
    });
  },

  seoAssistantStatus() {
    return apiClient.get<BlogSeoAssistantStatus>(
      ADMIN_BLOG_ENDPOINTS.seoAssistant,
    );
  },

  suggestSeo(payload: BlogSeoSuggestionRequest) {
    return apiClient.post<BlogSeoSuggestions>(
      ADMIN_BLOG_ENDPOINTS.seoSuggestions,
      payload,
      { timeout: SEO_SUGGESTIONS_TIMEOUT_MS },
    );
  },

  // Presign → PUT the bytes straight to R2 → confirm (the backend checks the
  // object is there at the declared size). The PUT must carry the same
  // Content-Type and exact size the presign was made for, or R2 refuses it.
  async uploadImage(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<BlogMediaConfirm> {
    const presign = await apiClient.post<BlogMediaPresign>(
      ADMIN_BLOG_ENDPOINTS.presignMedia,
      { content_type: file.type, size_bytes: file.size },
    );
    await uploadsService.uploadToStorage(
      presign.upload_url,
      file,
      file.type,
      onProgress,
    );
    return apiClient.post<BlogMediaConfirm>(
      ADMIN_BLOG_ENDPOINTS.confirmMedia(presign.media_id),
    );
  },
};
