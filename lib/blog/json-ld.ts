import type { PublicBlogPost } from "@/lib/blog/types";
import { SITE_URL } from "@/lib/site";

/**
 * Structured data for the blog: BlogPosting and BreadcrumbList on a post.
 *
 * Author and publisher are the FundLok organization already described on
 * every page (components/root-document.tsx, `@id` …#organization), so Google
 * ties the article to the same entity as the site.
 */

export const BLOG_URL = `${SITE_URL}/blog`;

export function blogPostUrl(slug: string): string {
  return `${BLOG_URL}/${slug}`;
}

/**
 * JSON for a <script type="application/ld+json">. Post titles and excerpts
 * are written by admins, so "<" is escaped: a title containing "</script>"
 * must not be able to close the tag and start markup of its own.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}#organization`,
  name: "FundLok",
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.png` },
};

export function blogPostingJsonLd(post: PublicBlogPost) {
  const url = blogPostUrl(post.slug);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline: post.title,
    description: post.excerpt,
    ...(post.cover_image_url ? { image: [post.cover_image_url] } : {}),
    datePublished: post.published_at,
    dateModified: post.updated_at,
    inLanguage: post.locale,
    author: ORGANIZATION,
    publisher: ORGANIZATION,
  };
}

export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
