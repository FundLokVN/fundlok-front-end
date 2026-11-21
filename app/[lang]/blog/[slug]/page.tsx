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
import { createServerTranslator } from "@/lib/i18n/server";
import { OG_LOCALE } from "@/lib/seo";
import { getPublishedPost } from "@/lib/server/blog-api";
import { SITE_URL } from "@/lib/site";
import { BlogCover } from "../_components/BlogCover";
import { PostMeta } from "../_components/PostMeta";
import { TableOfContents } from "../_components/TableOfContents";

/**
 * /blog/<slug>: one published post, rendered on the server from its TipTap
 * JSON (lib/blog/render.tsx; never raw HTML).
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

async function loadPost(params: PostParams) {
  const { lang, slug } = await params;
  if (lang !== "vi") return null;
  return getPublishedPost(slug);
}

export async function generateMetadata({
  params,
}: {
  params: PostParams;
}): Promise<Metadata> {
  const post = await loadPost(params);
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
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "FundLok",
      locale: OG_LOCALE.vi,
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
  const post = await loadPost(params);
  if (!post) notFound();

  const t = createServerTranslator("vi");
  const toc = extractToc(post.content);
  const crumbs = [
    { name: t("blog.breadcrumbHome"), url: SITE_URL },
    { name: t("blog.breadcrumbBlog"), url: BLOG_URL },
    { name: post.title, url: blogPostUrl(post.slug) },
  ];

  return (
    <>
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
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-6 py-10 md:py-14">
        <nav aria-label={t("blog.breadcrumbLabel")}>
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1">
              <Link href="/" className="hover:text-foreground">
                {t("blog.breadcrumbHome")}
              </Link>
              <ChevronRight aria-hidden className="h-3.5 w-3.5" />
            </li>
            <li className="flex items-center gap-1">
              <Link href="/blog" className="hover:text-foreground">
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
          <PostMeta post={post} t={t} showUpdated />
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
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("blog.allArticles")}
          </Link>
        </footer>
      </article>
      <SiteFooter locale="vi" />
    </>
  );
}
