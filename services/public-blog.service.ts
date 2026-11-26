import type { BlogLocale } from "@/lib/blog/types";
import { API_URL, BLOG_ENDPOINTS } from "@/lib/endpoints";

export function recordBlogView(locale: BlogLocale, slug: string) {
  return fetch(`${API_URL}${BLOG_ENDPOINTS.views(locale, slug)}`, {
    method: "POST",
    credentials: "omit",
    mode: "same-origin",
    keepalive: true,
  });
}
