import { test, expect } from "@playwright/test";

import { STUB_BLOG_POSTS } from "../stub-api/fixtures";
import { useLocale } from "../support/auth";
import { t } from "../support/i18n";

// The public blog: server-rendered from the stub's fixed published posts
// (fixtures.ts STUB_BLOG_POSTS). /blog is Vietnamese; /en/blog is the same
// posts in an English page, with /blog as canonical.

const [POST, SECOND] = STUB_BLOG_POSTS;

// A 1×1 PNG for the post's image, so the page loads nothing from the network.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.route("https://media.fundlok.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG }),
  );
});

test("/blog lists the published posts, newest first, with their dates", async ({
  page,
}) => {
  await page.goto("/blog");

  await expect(
    page.getByRole("heading", { level: 1, name: t("blog.heading") }),
  ).toBeVisible();
  const titles = page.getByRole("article").getByRole("heading", { level: 2 });
  await expect(titles).toHaveText([POST.title, SECOND.title]);
  await expect(
    page.getByText(t("blog.publishedOn", { date: "18/11/2026" })),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/blog$/,
  );

  await page.getByRole("link", { name: POST.title }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${POST.slug}$`));
});

test("a post renders on the server with its date, contents and structured data", async ({
  page,
}) => {
  const view = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/api/v1/blog/posts/vi/${POST.slug}/views`) &&
      response.request().method() === "POST",
  );
  const response = await page.goto(`/blog/${POST.slug}`);
  expect(response?.status()).toBe(200);
  expect((await view).status()).toBe(204);

  await expect(
    page.getByRole("heading", { level: 1, name: POST.title }),
  ).toBeVisible();
  // Visible dates in Vietnam time, as Google's snippet takes them.
  await expect(
    page.getByText(t("blog.publishedOn", { date: "18/11/2026" })),
  ).toBeVisible();
  await expect(
    page.getByText(t("blog.updatedOn", { date: "19/11/2026" })),
  ).toBeVisible();

  // The body: escaped text, a safe site link, the image with its alt text.
  const body = page.getByTestId("blog-post-body");
  await expect(
    body.getByRole("link", { name: "lãi suất tham khảo" }),
  ).toHaveAttribute("href", "/rate");
  await expect(
    body.getByRole("img", { name: "Biểu đồ vốn lưu động" }),
  ).toHaveAttribute("loading", "lazy");

  // The table of contents links to every heading's id, repeats numbered.
  const toc = page.getByTestId("blog-toc");
  await expect(toc.getByRole("link")).toHaveText([
    "Cách tính vốn lưu động",
    "Ví dụ",
    "Ví dụ",
  ]);
  const hrefs = await toc
    .getByRole("link")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  expect(hrefs).toEqual(["#cach-tinh-von-luu-dong", "#vi-du", "#vi-du-2"]);
  for (const href of hrefs) {
    await expect(body.locator(href!)).toHaveCount(1);
  }

  // Metadata: the SEO title, the excerpt, the canonical, an OG article.
  await expect(page).toHaveTitle(`${POST.seo_title} | FundLok`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    POST.excerpt,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`/blog/${POST.slug}$`),
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  await expect(
    page.locator('meta[property="article:published_time"]'),
  ).toHaveAttribute("content", POST.published_at);

  // JSON-LD: the article and its breadcrumb.
  const schemas = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => JSON.parse(node.textContent ?? "null")),
    );
  const article = schemas.find((s) => s?.["@type"] === "BlogPosting");
  expect(article).toMatchObject({
    headline: POST.title,
    description: POST.excerpt,
    datePublished: POST.published_at,
    dateModified: POST.updated_at,
    inLanguage: "vi",
  });
  expect(article.mainEntityOfPage["@id"]).toMatch(
    new RegExp(`/blog/${POST.slug}$`),
  );
  const breadcrumb = schemas.find((s) => s?.["@type"] === "BreadcrumbList");
  expect(
    breadcrumb.itemListElement.map((item: { name: string }) => item.name),
  ).toEqual([t("blog.breadcrumbHome"), t("blog.breadcrumbBlog"), POST.title]);
  expect(schemas.some((s) => s?.["@type"] === "WebSite")).toBe(true);
});

test("an unknown or malformed slug is a 404", async ({ page }) => {
  for (const slug of ["khong-co-bai-nay", "Not.A.Slug"]) {
    const response = await page.goto(`/blog/${slug}`);
    expect(response?.status(), slug).toBe(404);
  }
});

test("/en/blog is the blog in an English page, canonical to /blog", async ({
  page,
}) => {
  await page.goto("/en/blog");

  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/en\/blog$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: t("blog.heading", undefined, "en"),
    }),
  ).toBeVisible();
  const titles = page.getByRole("article").getByRole("heading", { level: 2 });
  await expect(titles).toHaveText([POST.title, SECOND.title]);
  await expect(
    page.getByText(t("blog.publishedOn", { date: "11/18/2026" }, "en")),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: POST.title })).toHaveAttribute(
    "href",
    `/en/blog/${POST.slug}`,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /[^n]\/blog$/,
  );
});

test("/en/blog/<slug> shows the post in English, and switches back to /blog", async ({
  page,
}) => {
  await page.goto(`/en/blog/${POST.slug}`);

  await expect(page).toHaveURL(new RegExp(`/en/blog/${POST.slug}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: POST.title }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", {
        name: t("blog.breadcrumbLabel", undefined, "en"),
      })
      .getByRole("link", { name: t("blog.breadcrumbBlog", undefined, "en") }),
  ).toHaveAttribute("href", "/en/blog");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`[^n]/blog/${POST.slug}$`),
  );
  await expect(
    page
      .getByRole("link", {
        name: t("localeSwitcher.vietnamese", undefined, "en"),
      })
      .first(),
  ).toHaveAttribute("href", `/blog/${POST.slug}`);
});

test("/vi/blog is not a URL of its own: it goes to /blog", async ({ page }) => {
  await page.goto("/vi/blog");
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/blog$/);
});

test("the language switch on a Vietnamese post goes to its English page", async ({
  page,
}) => {
  await page.goto(`/blog/${POST.slug}`);
  await expect(
    page.getByRole("link", { name: t("localeSwitcher.english") }).first(),
  ).toHaveAttribute("href", `/en/blog/${POST.slug}`);
});

test("an English reader opening a Vietnamese post is sent to its English page", async ({
  context,
  page,
}) => {
  await useLocale(context, "en");
  await page.goto(`/blog/${POST.slug}`);

  await expect(page).toHaveURL(new RegExp(`/en/blog/${POST.slug}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: POST.title }),
  ).toBeVisible();
});

test("the header links to the blog", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: t("header.blog") })
    .first()
    .click();
  await expect(page).toHaveURL(/\/blog$/);
});
