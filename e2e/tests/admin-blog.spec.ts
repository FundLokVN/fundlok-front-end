import { test, expect, type Page } from "@playwright/test";

import { signInAs } from "../support/auth";
import { t } from "../support/i18n";
import { toast } from "../support/ui";

// Admin > Blog: writing a post and publishing it. The stub keeps each test's
// posts apart (stub_scope) and enforces the backend's version and slug rules,
// so these exercise the editor against the same answers the API gives.

// A 1×1 PNG, for the upload and for every image the media host "serves".
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * The two places a blog image travels that are not the API: the presigned
 * PUT (an R2-shaped host, which the CSP allows) and the media host the
 * uploaded file is shown from.
 */
async function serveBlogStorage(page: Page) {
  await page.route("https://e2e-stub.r2.cloudflarestorage.com/**", (route) =>
    route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 200,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "PUT",
        "access-control-allow-headers": "content-type",
      },
      body: "",
    }),
  );
  await page.route("https://media.fundlok.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG }),
  );
}

test.describe("as an admin", () => {
  test.beforeEach(async ({ context, page }) => {
    await signInAs(context, "admin");
    await serveBlogStorage(page);
  });

  test("the sidebar leads to the posts list", async ({ page }) => {
    await page.goto("/admin");
    await page
      .getByRole("link", { name: t("admin.sidebar.blog"), exact: true })
      .first()
      .click();

    await expect(page).toHaveURL(/\/admin\/blog$/);
    await expect(
      page.getByRole("heading", { name: t("admin.blog.title"), exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Bản nháp có sẵn")).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: t("admin.blog.columns.views") }),
    ).toBeVisible();
  });

  test("refreshes view counts with the current search", async ({ page }) => {
    await page.goto("/admin/blog");
    const search = page.getByRole("textbox", {
      name: t("admin.blog.searchLabel"),
    });
    const postsUrl = (url: URL) =>
      url.pathname === "/api/admin/blog/posts" &&
      url.searchParams.get("search") === "Bản nháp";
    const firstLoad = page.waitForResponse((response) =>
      postsUrl(new URL(response.url())),
    );
    await search.fill("Bản nháp");
    await firstLoad;

    await page.route(postsUrl, async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.items[0].view_count = 42;
      await route.fulfill({ response, json: data });
    });
    await page.getByRole("button", { name: t("admin.table.refresh") }).click();
    await expect(page.getByText("42", { exact: true })).toBeVisible();
    await expect(search).toHaveValue("Bản nháp");
  });

  test("shows each post's Google Search figures and where they come from", async ({
    page,
  }) => {
    await page.route("**/api/admin/blog/posts?*", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.items[0].search = { clicks: 12, impressions: 480, position: 7.4 };
      await route.fulfill({ response, json: data });
    });
    await page.goto("/admin/blog");

    for (const column of ["clicks", "impressions", "ctr", "position"]) {
      await expect(
        page.getByRole("columnheader", {
          name: t(`admin.blog.columns.${column}`),
        }),
      ).toBeVisible();
    }
    const row = page.locator("tbody tr").filter({ hasText: "Bản nháp có sẵn" });
    await expect(row).toContainText("12");
    await expect(row).toContainText("480");
    await expect(row).toContainText(/2[.,]5\s?%/);
    await expect(row).toContainText(/7[.,]4/);
    await expect(page.getByTestId("search-console-note")).toContainText(
      t("admin.blog.searchConsole.window").split("{days}")[0].trim(),
    );
  });

  test("says when Google Search Console is not connected", async ({ page }) => {
    await page.route("**/api/admin/blog/posts?*", async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.search_console = {
        configured: false,
        last_synced_at: null,
        data_through: null,
        window_days: 28,
      };
      await route.fulfill({ response, json: data });
    });
    await page.goto("/admin/blog");

    await expect(page.getByTestId("search-console-note")).toHaveText(
      t("admin.blog.searchConsole.notConfigured"),
    );
  });

  test("writes a post with a heading and an image, and publishes it", async ({
    page,
  }) => {
    await page.goto("/admin/blog");
    await page.getByRole("button", { name: t("admin.blog.newPost") }).click();
    await expect(page).toHaveURL(/\/admin\/blog\/blog-\d+$/);

    // The slug follows the title while the post is a new draft.
    await page
      .getByLabel(t("admin.blog.editor.titleLabel"))
      .fill("Hướng dẫn vay vốn lưu động");
    const slug = page.getByLabel(t("admin.blog.settings.slugLabel"));
    await expect(slug).toHaveValue("huong-dan-vay-von-luu-dong");

    const body = page.getByRole("textbox", {
      name: t("admin.blog.editor.bodyLabel"),
    });
    await body.click();
    await page.keyboard.type("Mở đầu bài viết.");
    await page.keyboard.press("Enter");
    const toolbar = page.getByRole("toolbar");
    await toolbar
      .getByRole("button", {
        name: t("admin.blog.toolbar.heading2"),
        exact: true,
      })
      .click();
    await page.keyboard.type("Cách tính vốn lưu động");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Tài sản ngắn hạn trừ nợ ngắn hạn.");
    await expect(
      body.locator("h2", { hasText: "Cách tính vốn lưu động" }),
    ).toBeVisible();

    // Insert an image: upload, alt text, insert.
    await toolbar
      .getByRole("button", { name: t("admin.blog.toolbar.image"), exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel(t("admin.blog.image.fileLabel"))
      .setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: PNG });
    await dialog
      .getByRole("button", { name: t("admin.blog.image.insert") })
      .click();
    // Alt text is required before anything is uploaded.
    await expect(
      dialog.getByText(t("admin.blog.image.altRequired")),
    ).toBeVisible();
    await dialog
      .getByLabel(t("admin.blog.image.altLabel"))
      .fill("Biểu đồ vốn lưu động");
    await dialog
      .getByRole("button", { name: t("admin.blog.image.insert") })
      .click();
    await expect(dialog).toBeHidden();
    await expect(body.locator('img[alt="Biểu đồ vốn lưu động"]')).toBeVisible();

    await page
      .getByLabel(t("admin.blog.settings.excerptLabel"))
      .fill("Cách tính vốn lưu động cho doanh nghiệp nhỏ.");
    await expect(page.getByTestId("blog-save-state")).toContainText(
      t("admin.blog.editor.unsaved"),
    );

    // Publish saves the edits first, then publishes that version.
    const saved = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        /\/api\/admin\/blog\/posts\/blog-\d+$/.test(request.url()),
    );
    await page
      .getByRole("button", { name: t("admin.blog.actions.publish") })
      .click();
    const content = (await saved).postDataJSON().content;
    expect(JSON.stringify(content)).toContain('"level":2');
    expect(content.content).toContainEqual(
      expect.objectContaining({
        type: "image",
        attrs: expect.objectContaining({
          src: expect.stringMatching(/^https:\/\/media\.fundlok\.com\/blog\//),
          alt: "Biểu đồ vốn lưu động",
        }),
      }),
    );

    await expect(
      toast(
        page,
        t("admin.blog.toast.published", { slug: "huong-dan-vay-von-luu-dong" }),
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: t("admin.blog.actions.viewLive") }),
    ).toHaveAttribute("href", "/blog/huong-dan-vay-von-luu-dong");
    // Locked from now on, so the live link never breaks.
    await expect(slug).toHaveAttribute("readonly", "");
    await expect(page.getByTestId("blog-save-state")).toContainText(
      t("admin.blog.editor.saved"),
    );
  });

  test("says so when someone else saved the post first", async ({ page }) => {
    await page.goto("/admin/blog/blog-seeded-draft");
    await expect(
      page.getByLabel(t("admin.blog.editor.titleLabel")),
    ).toHaveValue("Bản nháp có sẵn");

    // Another admin saves version 1 while this page still holds it.
    const other = await page.request.put(
      "/api/admin/blog/posts/blog-seeded-draft",
      {
        data: {
          title: "Bản nháp có sẵn",
          slug: "ban-nhap-co-san",
          seo_title: null,
          excerpt: "Sửa bởi người khác",
          content: { type: "doc", content: [{ type: "paragraph" }] },
          cover_image_url: null,
          cover_alt: null,
          version: 1,
        },
      },
    );
    expect(other.ok()).toBe(true);

    await page
      .getByLabel(t("admin.blog.settings.excerptLabel"))
      .fill("Của tôi");
    await page
      .getByRole("button", { name: t("admin.blog.actions.save") })
      .click();

    await expect(
      toast(page, t("admin.blog.errors.BLOG_VERSION_CONFLICT")),
    ).toBeVisible();
    await expect(page.getByTestId("blog-save-state")).toContainText(
      t("admin.blog.editor.unsaved"),
    );
  });

  test("checks the focus keyword, warns about a competing post and keeps the keywords", async ({
    page,
  }) => {
    // Another post already targets the same focus keyword (different case).
    const created = await (
      await page.request.post("/api/admin/blog/posts", {
        data: { title: "Bài khác" },
      })
    ).json();
    const tagged = await page.request.put(
      `/api/admin/blog/posts/${created.id}`,
      {
        data: {
          title: "Bài khác",
          slug: created.slug,
          seo_title: null,
          excerpt: "",
          content: { type: "doc", content: [{ type: "paragraph" }] },
          cover_image_url: null,
          cover_alt: null,
          focus_keyword: "Bản Nháp",
          secondary_keywords: [],
          version: created.version,
        },
      },
    );
    expect(tagged.ok()).toBe(true);

    await page.goto("/admin/blog/blog-seeded-draft");
    await expect(
      page.getByLabel(t("admin.blog.editor.titleLabel")),
    ).toHaveValue("Bản nháp có sẵn");

    await page.getByLabel(t("admin.blog.keywords.focusLabel")).fill("bản nháp");
    // Title "Bản nháp có sẵn" and slug ban-nhap-co-san have it; the empty
    // description does not.
    await expect(page.getByTestId("blog-seo-check-postTitle")).toHaveAttribute(
      "data-state",
      "pass",
    );
    await expect(page.getByTestId("blog-seo-check-slug")).toHaveAttribute(
      "data-state",
      "pass",
    );
    await expect(
      page.getByTestId("blog-seo-check-description"),
    ).toHaveAttribute("data-state", "fail");
    await expect(
      page.getByText(t("admin.blog.checklist.conflictTitle")),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Bài khác" })).toHaveAttribute(
      "href",
      `/admin/blog/${created.id}`,
    );

    const secondary = page.getByRole("textbox", {
      name: t("admin.blog.keywords.secondaryLabel"),
    });
    await secondary.fill("có sẵn");
    await secondary.press("Enter");
    const removeChip = page.getByRole("button", {
      name: t("admin.blog.keywords.remove").replace("{keyword}", "có sẵn"),
    });
    await expect(removeChip).toBeVisible();

    await page
      .getByRole("button", { name: t("admin.blog.actions.save") })
      .click();
    await expect(toast(page, t("admin.blog.toast.saved"))).toBeVisible();

    await page.reload();
    await expect(
      page.getByLabel(t("admin.blog.keywords.focusLabel")),
    ).toHaveValue("bản nháp");
    await expect(removeChip).toBeVisible();
  });

  test("deletes a draft after confirming", async ({ page }) => {
    await page.goto("/admin/blog/blog-seeded-draft");
    await page
      .getByRole("button", { name: t("admin.blog.actions.delete") })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: t("admin.blog.actions.deleteConfirm") })
      .click();

    await expect(page).toHaveURL(/\/admin\/blog$/);
    await expect(toast(page, t("admin.blog.toast.deleted"))).toBeVisible();
    await expect(page.getByText("Bản nháp có sẵn")).toHaveCount(0);
  });
});

test("an investor is kept out of the blog admin", async ({ context, page }) => {
  await signInAs(context, "investor");
  await page.goto("/admin/blog");
  await expect(page).not.toHaveURL(/\/admin/);
});
