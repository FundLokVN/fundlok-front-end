import { dateIct, formatDateIct } from "@/lib/format-date";
import type { ServerTranslate } from "@/lib/i18n/server";
import type { PublicBlogPostSummary } from "@/lib/blog/types";
import type { SeoLocale } from "@/lib/seo";

/**
 * "Đăng ngày 21/11/2026 · Cập nhật ngày 24/11/2026 · 5 phút đọc". Dates in
 * Vietnam time (the server runs in UTC) and in <time> elements, so readers
 * and crawlers both see when the post was written. The update date shows only
 * when it falls on another day.
 */
export function PostMeta({
  post,
  t,
  locale,
  showUpdated = false,
}: {
  post: PublicBlogPostSummary;
  t: ServerTranslate;
  locale: SeoLocale;
  showUpdated?: boolean;
}) {
  const updatedLater =
    showUpdated && dateIct(post.updated_at) !== dateIct(post.published_at);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <time dateTime={post.published_at}>
        {t("blog.publishedOn", {
          date: formatDateIct(post.published_at, locale),
        })}
      </time>
      {updatedLater && (
        <>
          <span aria-hidden>·</span>
          <time dateTime={post.updated_at}>
            {t("blog.updatedOn", {
              date: formatDateIct(post.updated_at, locale),
            })}
          </time>
        </>
      )}
      <span aria-hidden>·</span>
      <span>{t("blog.readingTime", { minutes: post.reading_minutes })}</span>
    </p>
  );
}
