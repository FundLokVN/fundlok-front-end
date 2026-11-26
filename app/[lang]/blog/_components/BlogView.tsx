"use client";

import { useEffect, useRef } from "react";
import type { BlogLocale } from "@/lib/blog/types";
import { recordBlogView } from "@/services/public-blog.service";

export function BlogView({
  locale,
  slug,
}: {
  locale: BlogLocale;
  slug: string;
}) {
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    const post = `${locale}/${slug}`;
    function recordIfVisible() {
      if (document.visibilityState !== "visible" || recorded.current === post)
        return;
      recorded.current = post;
      void recordBlogView(locale, slug).catch(() => undefined);
    }

    recordIfVisible();
    document.addEventListener("visibilitychange", recordIfVisible);
    return () =>
      document.removeEventListener("visibilitychange", recordIfVisible);
  }, [locale, slug]);

  return null;
}
