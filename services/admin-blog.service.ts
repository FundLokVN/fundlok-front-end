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

// Same rules as the backend (MEDIA_CONTENT_TYPE_EXTENSIONS, MEDIA_MAX_SIZE).
export const BLOG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Limits from BlogPostUpdate, so the inputs stop where the backend would 422.
export const BLOG_TITLE_MAX = 200;
export const BLOG_SEO_TITLE_MAX = 70;
export const BLOG_EXCERPT_MAX = 300;
export const BLOG_ALT_MAX = 200;
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
