import { describe, expect, it } from "vitest";

import type { BlogPostDetail } from "@/services/admin-blog.service";
import { normalizeHref } from "./LinkDialog";
import {
  blogErrorCode,
  blogErrorMessage,
  draftFromPost,
  missingForPublish,
  payloadFromDraft,
  slugFollowsTitle,
  type PostDraft,
} from "./post-editor";

function post(overrides: Partial<BlogPostDetail> = {}): BlogPostDetail {
  return {
    id: "p1",
    slug: "lai-suat-vay-von",
    title: "Lãi suất vay vốn",
    excerpt: "",
    status: "draft",
    cover_image_url: null,
    cover_alt: null,
    published_at: null,
    updated_at: "2026-11-21T03:00:00Z",
    created_at: "2026-11-21T03:00:00Z",
    reading_minutes: 1,
    locale: "vi",
    seo_title: null,
    content: { type: "doc", content: [{ type: "paragraph" }] },
    version: 1,
    author_id: null,
    updated_by: null,
    ...overrides,
  };
}

const complete: PostDraft = {
  title: "Lãi suất",
  slug: "lai-suat",
  seoTitle: "",
  excerpt: "Tóm tắt",
  coverUrl: null,
  coverAlt: "",
};

describe("slugFollowsTitle", () => {
  it("follows on a new draft whose slug came from its title", () => {
    expect(slugFollowsTitle(post())).toBe(true);
    // The backend adds "-2" when the slug is taken.
    expect(slugFollowsTitle(post({ slug: "lai-suat-vay-von-2" }))).toBe(true);
  });

  it("stops once someone chose their own slug", () => {
    expect(slugFollowsTitle(post({ slug: "bai-viet-khac" }))).toBe(false);
  });

  it("never follows after the first publish, even when unpublished again", () => {
    expect(
      slugFollowsTitle(post({ published_at: "2026-11-20T03:00:00Z" })),
    ).toBe(false);
  });
});

describe("missingForPublish", () => {
  it("lets a complete post through", () => {
    expect(missingForPublish(complete, "Nội dung")).toEqual([]);
  });

  it("names everything the backend would refuse, plus the cover's alt", () => {
    expect(
      missingForPublish(
        {
          title: "  ",
          slug: "Bad Slug",
          seoTitle: "",
          excerpt: "",
          coverUrl: "https://media.fundlok.com/blog/a.png",
          coverAlt: " ",
        },
        "   ",
      ),
    ).toEqual(["title", "slug", "excerpt", "content", "coverAlt"]);
  });

  it("does not count an image-only body as content, like the backend", () => {
    expect(missingForPublish(complete, "")).toEqual(["content"]);
  });
});

describe("payloadFromDraft", () => {
  it("trims, turns empty optional fields into null and drops a stray alt", () => {
    const payload = payloadFromDraft(
      {
        ...complete,
        title: "  Lãi suất  ",
        seoTitle: "   ",
        excerpt: " Tóm tắt ",
        coverAlt: "left over",
      },
      { type: "doc" },
      7,
    );
    expect(payload).toEqual({
      title: "Lãi suất",
      slug: "lai-suat",
      seo_title: null,
      excerpt: "Tóm tắt",
      content: { type: "doc" },
      cover_image_url: null,
      cover_alt: null,
      version: 7,
    });
  });

  it("round-trips a loaded post", () => {
    const loaded = post({ seo_title: "SEO", excerpt: "Mô tả", version: 3 });
    const payload = payloadFromDraft(draftFromPost(loaded), loaded.content, 3);
    expect(payload.seo_title).toBe("SEO");
    expect(payload.excerpt).toBe("Mô tả");
    expect(payload.version).toBe(3);
  });
});

describe("blog error copy", () => {
  const t = (key: string) => `t:${key}`;

  it("translates the blog's own error codes", () => {
    const conflict = {
      message: "Version conflict",
      code: "BLOG_VERSION_CONFLICT",
    };
    expect(blogErrorCode(conflict)).toBe("BLOG_VERSION_CONFLICT");
    expect(blogErrorMessage(conflict, t, "vi")).toBe(
      "t:admin.blog.errors.BLOG_VERSION_CONFLICT",
    );
  });

  it("falls back to the generic message, never English prose, in Vietnamese", () => {
    const other = { message: "Internal Server Error", code: "SOMETHING_ELSE" };
    expect(blogErrorCode(other)).toBeNull();
    expect(blogErrorMessage(other, t, "vi")).toBe("t:admin.blog.toast.error");
    expect(blogErrorMessage(other, t, "en")).toBe("Internal Server Error");
  });
});

describe("normalizeHref", () => {
  it("adds https:// to a bare host and leaves everything else as typed", () => {
    expect(normalizeHref("fundlok.com/rate")).toBe("https://fundlok.com/rate");
    expect(normalizeHref(" /rate ")).toBe("/rate");
    expect(normalizeHref("#lai-suat")).toBe("#lai-suat");
    expect(normalizeHref("mailto:hello@fundlok.com")).toBe(
      "mailto:hello@fundlok.com",
    );
    // Left as typed, so the safety check can refuse it.
    expect(normalizeHref("javascript:alert(1)")).toBe("javascript:alert(1)");
  });
});
