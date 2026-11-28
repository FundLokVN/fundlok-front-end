import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicBlogPostSummary } from "@/lib/blog/types";

const posts: PublicBlogPostSummary[] = [];

vi.mock("@/lib/server/blog-api", () => ({
  listAllPublishedPosts: async () => posts,
  readAtBuildOrDefer: async <T>(read: () => Promise<T>) => read(),
}));

const { default: sitemap } = await import("./sitemap");

function post(
  slug: string,
  published_at: string,
  updated_at: string,
): PublicBlogPostSummary {
  return {
    slug,
    title: slug,
    excerpt: slug,
    cover_image_url: null,
    cover_alt: null,
    published_at,
    updated_at,
    reading_minutes: 3,
  };
}

describe("sitemap", () => {
  beforeEach(() => {
    posts.length = 0;
  });

  it("gives the fixed pages no lastModified, rather than the time it ran", async () => {
    const entries = await sitemap();
    const rate = entries.find((e) => e.url.endsWith("/rate"));
    expect(rate).toBeDefined();
    expect(rate).not.toHaveProperty("lastModified");
  });

  it("lists each post at its own updated_at, and /blog at the latest one", async () => {
    // Newest first, as the API returns them; the older post was edited last.
    posts.push(
      post("moi", "2026-11-23T06:00:00Z", "2026-11-23T06:00:00Z"),
      post("cu", "2026-11-20T06:00:00Z", "2026-11-24T09:30:00.5Z"),
    );
    const entries = await sitemap();
    const byUrl = (suffix: string) =>
      entries.find((e) => e.url.endsWith(suffix));

    expect(byUrl("/blog")?.lastModified).toBe("2026-11-24T09:30:00.5Z");
    expect(byUrl("/blog/moi")?.lastModified).toBe("2026-11-23T06:00:00Z");
    expect(byUrl("/blog/cu")?.lastModified).toBe("2026-11-24T09:30:00.5Z");
  });

  it("lists /blog without a date when there are no posts", async () => {
    const blog = (await sitemap()).find((e) => e.url.endsWith("/blog"));
    expect(blog).toBeDefined();
    expect(blog).not.toHaveProperty("lastModified");
  });

  it("lists the Vietnamese and English VietQR generator pages", async () => {
    const urls = (await sitemap()).map(({ url }) => new URL(url).pathname);
    expect(urls).toContain("/tao-ma-qr");
    expect(urls).toContain("/en/tao-ma-qr");
  });

  it("lists both break-even calculator pages", async () => {
    const urls = (await sitemap()).map(({ url }) => new URL(url).pathname);
    expect(urls).toContain("/tinh-diem-hoa-von");
    expect(urls).toContain("/en/tinh-diem-hoa-von");
  });
});
