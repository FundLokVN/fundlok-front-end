import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { BLOG_URL, blogPostUrl } from "@/lib/blog/json-ld";
import { listPublishedPosts, readAtBuildOrDefer } from "@/lib/server/blog-api";
import {
  LOCALIZED_PATHS,
  languageAlternates,
  localizedPath,
  type RouteLocale,
} from "@/lib/locale-routing";

// Public marketing pages only — authenticated/app routes (dashboard,
// project-application) are disallowed in robots.ts and excluded here.
//
// Every page is listed once PER LANGUAGE (/rate and /en/rate), and each entry
// names all its language versions. That is Google's sitemap form of hreflang:
// without it, Google has no reliable way to pair /en/rate with /rate, and may
// treat them as two unrelated pages or show the wrong one to a searcher.

type PageMeta = Pick<
  MetadataRoute.Sitemap[number],
  "changeFrequency" | "priority"
>;

// Keyed by default-language path; must cover LOCALIZED_PATHS exactly.
const PAGES: Record<(typeof LOCALIZED_PATHS)[number], PageMeta> = {
  "/": { changeFrequency: "daily", priority: 1 },
  "/why-us": { changeFrequency: "weekly", priority: 0.8 },
  // The rate calculator: the page most likely to match what an SME actually
  // types into Google ("lãi suất vay doanh nghiệp"). The investor tab is the
  // same document at ?for=investor, so it is not listed separately.
  "/rate": { changeFrequency: "weekly", priority: 0.9 },
  "/faq": { changeFrequency: "weekly", priority: 0.7 },
  "/contact": { changeFrequency: "monthly", priority: 0.7 },
  // Legal boilerplate: crawlable, but far below the pages that match what an
  // SME actually searches for.
  "/terms": { changeFrequency: "monthly", priority: 0.3 },
  // Sign-up lives on this page too, at ?mode=register. The query variant is
  // deliberately not listed separately — it is the same document.
  "/login": { changeFrequency: "monthly", priority: 0.5 },
};

const LOCALES: RouteLocale[] = ["vi", "en"];

function absolute(path: string): string {
  // SITE_URL has no trailing slash; the home page is SITE_URL itself.
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

// The blog part changes whenever a post is published; the admin editor
// expires it at once through the `blog` cache tag, and this is the backstop.
// BLOG_REVALIDATE_SECONDS; Next needs the literal here.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [...pageEntries(), ...(await blogEntries())];
}

/**
 * The fixed pages carry no lastModified. They used to carry the time the
 * sitemap was generated, so every page claimed to have changed every hour.
 * Google only trusts <lastmod> on a site where it is "consistently and
 * verifiably accurate"; a sitemap that always says "now" teaches it to ignore
 * the field everywhere, the blog posts' real dates included. No date is better
 * than a wrong one: Google recrawls these pages on its own schedule.
 */
function pageEntries(): MetadataRoute.Sitemap {
  return LOCALIZED_PATHS.flatMap((path) => {
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(path)).map(([lang, href]) => [
        lang,
        absolute(href),
      ]),
    );
    return LOCALES.map((locale) => ({
      url: absolute(localizedPath(path, locale)),
      ...PAGES[path],
      alternates: { languages },
    }));
  });
}

/**
 * /blog and every published post, newest first, at their Vietnamese URLs only:
 * /en/blog shows the same posts and names these as canonical, so no language
 * alternates. A post's lastModified is its own updated_at, and /blog's the
 * latest of those, so Google recrawls what actually changed.
 */
async function blogEntries(): Promise<MetadataRoute.Sitemap> {
  const posts = await readAtBuildOrDefer(listPublishedPosts);
  // /blog changes when any post does, and the newest post is not necessarily
  // the last one edited.
  const latest = posts.reduce<string | undefined>(
    (max, post) =>
      !max || Date.parse(post.updated_at) > Date.parse(max)
        ? post.updated_at
        : max,
    undefined,
  );
  return [
    {
      url: BLOG_URL,
      ...(latest ? { lastModified: latest } : {}),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...posts.map((post) => ({
      url: blogPostUrl(post.slug),
      lastModified: post.updated_at,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
