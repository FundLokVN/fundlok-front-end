import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { createServerTranslator } from "@/lib/i18n/server";
import { OG_LOCALE, type LangParams } from "@/lib/seo";
import { listPublishedPosts, readAtBuildOrDefer } from "@/lib/server/blog-api";
import { BlogCover } from "./_components/BlogCover";
import { PostMeta } from "./_components/PostMeta";

/**
 * /blog: every published post, newest first. Vietnamese only for now, so it
 * exists at /blog (rewritten here as /vi/blog) and nowhere else; /en/blog
 * redirects to it in proxy.ts.
 *
 * Built once and regenerated in the background at most hourly; the admin
 * editor expires it at once on every publish (BLOG_CACHE_TAG). Reads no
 * cookies or headers, like every page under app/[lang]/.
 */

// BLOG_REVALIDATE_SECONDS; Next needs the literal here.
export const revalidate = 3600;

// /fr/blog, /anything/blog: not a language.
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: LangParams;
}): Promise<Metadata> {
  if ((await params).lang !== "vi") return {};
  const t = createServerTranslator("vi");
  const title = t("blog.metaTitle");
  const description = t("blog.metaDescription");
  return {
    title,
    description,
    // One URL, one language: a canonical and no hreflang alternates.
    alternates: { canonical: "/blog" },
    openGraph: {
      title,
      description,
      url: "/blog",
      siteName: "FundLok",
      type: "website",
      locale: OG_LOCALE.vi,
    },
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function BlogIndexPage({
  params,
}: {
  params: LangParams;
}) {
  if ((await params).lang !== "vi") notFound();
  const t = createServerTranslator("vi");
  const posts = await readAtBuildOrDefer(listPublishedPosts);

  return (
    // Opaque and full height like every marketing page: the page-fade
    // transition (app/[lang]/template.tsx) fades this in over the old page,
    // which shows through anything transparent until the fade ends.
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-clip bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 md:py-16">
        <header className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {t("blog.heading")}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("blog.subtitle")}
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="mt-12 rounded-xl border bg-card p-8 text-center text-muted-foreground">
            {t("blog.empty")}
          </p>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <li key={post.slug}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                  <BlogCover
                    src={post.cover_image_url}
                    alt={post.cover_alt}
                    sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
                    preload={index === 0}
                  />
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <h2 className="text-lg font-semibold leading-snug text-foreground">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="after:absolute after:inset-0 group-hover:text-primary"
                      >
                        {post.title}
                      </Link>
                    </h2>
                    {post.excerpt && (
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="mt-auto">
                      <PostMeta post={post} t={t} />
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
      <SiteFooter locale="vi" />
    </div>
  );
}
