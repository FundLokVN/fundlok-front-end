"use server";

import { updateTag } from "next/cache";

import { USER_ENDPOINTS } from "@/lib/endpoints";
import { backendGet } from "@/lib/server/backend-get";
import { BLOG_CACHE_TAG } from "@/lib/server/blog-api";

/**
 * Expire the public blog's cache, so the next visitor to /blog, a post or the
 * sitemap gets what the admin just did instead of a page up to an hour old.
 * Called by the editor after a publish, an unpublish, a save of a live post
 * and a delete.
 *
 * WHY IT CHECKS THE ROLE ITSELF
 * A Server Action is a POST endpoint that can be invoked from any page, not
 * only from /admin, so the proxy's /admin gate does not cover it. Without this
 * check anyone could keep the blog's cache cold. It asks the backend who the
 * caller is with the caller's own cookies (backendGet forwards them).
 *
 * `updateTag`, not `revalidateTag`: the next request waits for fresh data
 * rather than being served the stale page once more (read-your-own-writes),
 * and it may only be called from a Server Action.
 */
export async function refreshPublicBlog(): Promise<{ ok: boolean }> {
  const me = await backendGet<{ role?: string | null }>(USER_ENDPOINTS.me);
  if (!me.ok) return { ok: false };
  const role = me.data.role;
  if (role !== "ADMIN" && role !== "SYSTEM_ADMIN") return { ok: false };
  updateTag(BLOG_CACHE_TAG);
  return { ok: true };
}
