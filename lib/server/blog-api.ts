import { cache } from "react";
import { connection } from "next/server";

import { backendSecretHeaders } from "@/lib/backend-secret";
import { isValidSlug } from "@/lib/blog/slug";
import type {
  BlogLocale,
  PublicBlogPost,
  PublicBlogPostList,
  PublicBlogPostSummary,
} from "@/lib/blog/types";

/**
 * The public blog API, read by the /blog pages and the sitemap on the server.
 *
 * NO headers() OR cookies() HERE
 * These pages are statically rendered and regenerated in the background
 * (ISR). Touching the incoming request would make every one of them render
 * per request instead. That is also why this calls FastAPI directly with the
 * shared secret instead of going through the /api proxy: there is no visitor
 * request to forward, and the endpoints need no session.
 *
 * CACHE
 * Every response is cached under the `blog` tag for at most an hour. The admin
 * editor expires the tag the moment a post is published, unpublished, edited
 * while live or deleted (app/(app)/admin/blog/actions.ts), so the hour is only
 * a backstop for changes made some other way.
 *
 * FAILURES THROW
 * A 5xx or a timeout throws rather than returning an empty list: during a
 * background regeneration Next then keeps serving the last good page instead
 * of replacing it with "no posts". Only a 404 for one post means "gone".
 *
 * Vercel needs API_URL and BACKEND_SECRET_KEY at build time as well as at
 * runtime: /blog and the sitemap are first rendered during the build.
 */

// Same default as proxy.ts, next.config.ts and lib/server/backend-get.ts.
const API_BASE_URL = process.env.API_URL || "http://127.0.0.1:8000";

export const BLOG_CACHE_TAG = "blog";

/** Seconds. Matches `revalidate` on the /blog pages. */
export const BLOG_REVALIDATE_SECONDS = 3600;

/** The page size for public blog reads. */
export const BLOG_LIST_LIMIT = 50;

const TIMEOUT_MS = 10_000;

// Vietnamese only for now. The column and the URL segment exist so English
// posts can be added without a migration or a new route.
const LOCALE: BlogLocale = "vi";

async function blogFetch<T>(path: string): Promise<T | null> {
  const response = await fetch(new URL(path, API_BASE_URL), {
    headers: { Accept: "application/json", ...backendSecretHeaders() },
    next: { tags: [BLOG_CACHE_TAG], revalidate: BLOG_REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Blog API ${path} answered ${response.status}`);
  }
  return (await response.json()) as T;
}

async function readPostPage(offset = 0): Promise<PublicBlogPostList> {
  const path = `/api/v1/blog/posts?locale=${LOCALE}&limit=${BLOG_LIST_LIMIT}&offset=${offset}`;
  const page = await blogFetch<PublicBlogPostList>(path);
  if (!page) throw new Error(`Blog API ${path} answered 404`);
  return page;
}

/** Published posts, newest first, for the blog landing page. */
export const listPublishedPosts = cache(
  async () => (await readPostPage()).items,
);

/** Crawl discovery includes older posts beyond the blog landing page. */
export async function listAllPublishedPosts(): Promise<
  PublicBlogPostSummary[]
> {
  const posts: PublicBlogPostSummary[] = [];
  let offset: number | null | undefined = 0;
  while (offset != null) {
    const page = await readPostPage(offset);
    posts.push(...page.items);
    offset = page.next_offset;
  }
  return posts;
}

/**
 * One published post, or null when there is none at that slug (a draft, an
 * unpublished post, a typo). Throws when the API cannot be read.
 */
export const getPublishedPost = cache(
  async (slug: string): Promise<PublicBlogPost | null> => {
    // Never sends a malformed slug to the backend: it could not match a post
    // anyway, and the value goes into a URL path.
    if (!isValidSlug(slug)) return null;
    return blogFetch<PublicBlogPost>(
      `/api/v1/blog/posts/${LOCALE}/${encodeURIComponent(slug)}`,
    );
  },
);

/** True while `next build` prerenders pages. */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Run a blog read for a page or route that is prerendered at BUILD time
 * (/blog, the sitemap), without the build depending on the backend.
 *
 * The CI builds and `bun run ci:check` run with no backend at all. Failing the
 * build would block every deploy on the API being up; catching the error and
 * rendering "no posts" would cache an empty blog for an hour. Instead, when
 * the read fails during the build, `connection()` takes the route out of the
 * static build: it then renders per request, with its fetches still cached
 * under the `blog` tag, so the backend sees no more traffic than before. A
 * build that can reach the API prerenders the route as usual.
 *
 * At runtime a failure throws (see FAILURES THROW above).
 */
export async function readAtBuildOrDefer<T>(
  read: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!isBuildPhase()) throw error;
    console.warn(
      "[blog] API unreachable during the build; this route will render per request instead.",
      error instanceof Error ? error.message : error,
    );
  }
  // During the build this throws Next's own "dynamic usage" signal, which
  // must not be caught; the read below only runs at request time.
  await connection();
  return read();
}
