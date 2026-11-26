import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import {
  BLOG_URL,
  blogPostUrl,
  blogPostingJsonLd,
  breadcrumbJsonLd,
  serializeJsonLd,
} from "@/lib/blog/json-ld";
import { extractToc, renderBlogContent } from "@/lib/blog/render";
import type { PublicBlogPost } from "@/lib/blog/types";
import { createServerTranslator } from "@/lib/i18n/server";
import { localizedPath } from "@/lib/locale-routing";
import { OG_LOCALE, type SeoLocale } from "@/lib/seo";
import { getPublishedPost } from "@/lib/server/blog-api";
import { SITE_URL } from "@/lib/site";
import { BlogCover } from "../_components/BlogCover";
import { BlogView } from "../_components/BlogView";
import { PostMeta } from "../_components/PostMeta";
import { TableOfContents } from "../_components/TableOfContents";

/**
 * /blog/<slug> and /en/blog/<slug>: one published post, rendered on the server
 * from its TipTap JSON (lib/blog/render.tsx; never raw HTML). The page around
 * the post follows the URL's language; the post itself is the Vietnamese one
 * until posts get English fields, so the English URL names the Vietnamese one
 * as canonical and is not in the sitemap.
 *
 * No post is built ahead of time: generateStaticParams returns [] so each
 * slug renders on its first visit and is then cached like a static page,
 * regenerated at most hourly and expired at once by the admin editor. That is
 * also why app/[lang]/layout.tsx no longer sets `dynamicParams = false`.
 */

type PostParams = Promise<{ lang: string; slug: string }>;

// BLOG_REVALIDATE_SECONDS; Next needs the literal here.
export const revalidate = 3600;

export function generateStaticParams(): { slug: string }[] {
  return [];
}

async function loadPost(
  params: PostParams,
): Promise<{ lang: SeoLocale; post: PublicBlogPost | null }> {
  const { lang, slug } = await params;
  if (lang !== "vi" && lang !== "en") return { lang: "vi", post: null };
  return { lang, post: await getPublishedPost(slug) };
}

export async function generateMetadata({
  params,
}: {
  params: PostParams;
}): Promise<Metadata> {
  const { lang, post } = await loadPost(params);
  if (!post) return {};
  const title = post.seo_title || post.title;
  const description = post.excerpt;
  const url = `/blog/${post.slug}`;
  const images = post.cover_image_url
    ? [{ url: post.cover_image_url, alt: post.cover_alt ?? post.title }]
    : undefined;

  return {
    // The root template appends "| FundLok". An SEO title an admin already
    // branded ("… | FundLok") would otherwise carry the brand twice.
    title: /fundlok/i.test(title) ? { absolute: title } : title,
    description,
    // Same post at both URLs: the Vietnamese one is canonical, no hreflang.
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url: localizedPath(url, lang),
      siteName: "FundLok",
      locale: OG_LOCALE[lang],
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: [SITE_URL],
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: images?.map((image) => image.url),
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogPostPage({ params }: { params: PostParams }) {
  const { lang, post } = await loadPost(params);
  if (!post) notFound();

  const t = createServerTranslator(lang);
  const toc = extractToc(post.content);
  const crumbs = [
    { name: t("blog.breadcrumbHome"), url: SITE_URL },
    { name: t("blog.breadcrumbBlog"), url: BLOG_URL },
    { name: post.title, url: blogPostUrl(post.slug) },
  ];

  return (
    <>
      <BlogView slug={post.slug} locale={post.locale} />
      <script
        type="application/ld+json"
        id="blog-posting-jsonld"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(blogPostingJsonLd(post)),
        }}
      />
      <script
        type="application/ld+json"
        id="blog-breadcrumb-jsonld"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(breadcrumbJsonLd(crumbs)),
        }}
      />
      {/* Opaque and full height, like /blog: see the note there. */}
      <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-clip bg-background text-foreground">
        <SiteHeader />
        <article className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 md:py-14">
          <nav aria-label={t("blog.breadcrumbLabel")}>
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-1">
                <Link
                  href={localizedPath("/", lang)}
                  className="hover:text-foreground"
                >
                  {t("blog.breadcrumbHome")}
                </Link>
                <ChevronRight aria-hidden className="h-3.5 w-3.5" />
              </li>
              <li className="flex items-center gap-1">
                <Link
                  href={localizedPath("/blog", lang)}
                  className="hover:text-foreground"
                >
                  {t("blog.breadcrumbBlog")}
                </Link>
                <ChevronRight aria-hidden className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="line-clamp-1 max-w-[16rem]">
                {post.title}
              </li>
            </ol>
          </nav>

          <header className="mt-6 flex flex-col gap-4">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
              {post.title}
            </h1>
            <PostMeta post={post} t={t} locale={lang} showUpdated />
          </header>

          <BlogCover
            src={post.cover_image_url}
            alt={post.cover_alt}
            sizes="(min-width: 768px) 48rem, 100vw"
            preload
            className="mt-8 rounded-xl border"
          />

          {toc.length >= 2 && (
            <div className="mt-8">
              <TableOfContents entries={toc} title={t("blog.toc")} />
            </div>
          )}

          <div
            className="prose prose-neutral mt-8 max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-a:text-primary prose-img:rounded-lg"
            data-testid="blog-post-body"
          >
            {renderBlogContent(post.content)}
          </div>

          <footer className="mt-12 border-t pt-6">
            <Link
              href={localizedPath("/blog", lang)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("blog.allArticles")}
            </Link>
          </footer>
        </article>
        <SiteFooter locale={lang} />
      </div>
    </>
  );
}
