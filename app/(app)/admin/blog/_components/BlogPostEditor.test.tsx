import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import type {
  BlogPostDetail,
  BlogSeoSuggestions,
} from "@/services/admin-blog.service";
import { BlogPostEditor } from "./BlogPostEditor";
import { seoSuggestionErrorKey } from "./SeoSuggestions";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  update: { mutateAsync: vi.fn(), isPending: false },
  publish: { mutateAsync: vi.fn(), isPending: false },
  unpublish: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
  seoStatus: { data: { enabled: true } as { enabled: boolean } | undefined },
  suggest: {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null as { code?: string; message: string } | null,
  },
}));

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// ProseMirror measures the selection; jsdom has no layout.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
document.elementFromPoint = () => null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({
    locale: "vi",
    setLocale: vi.fn(),
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-admin-blog", () => ({
  useUpdateBlogPost: () => mocks.update,
  usePublishBlogPost: () => mocks.publish,
  useUnpublishBlogPost: () => mocks.unpublish,
  useDeleteBlogPost: () => mocks.remove,
  useUploadBlogImage: () => ({ mutate: vi.fn(), isPending: false }),
  useBlogKeywordUsage: () => ({ data: undefined }),
  useBlogSeoAssistant: () => mocks.seoStatus,
  useSuggestBlogSeo: () => mocks.suggest,
}));

vi.mock("../actions", () => ({
  refreshPublicBlog: () => mocks.refresh(),
}));

function post(overrides: Partial<BlogPostDetail> = {}): BlogPostDetail {
  return {
    id: "post-1",
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
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Nội dung" }] },
      ],
    },
    version: 3,
    author_id: null,
    updated_by: null,
    focus_keyword: null,
    secondary_keywords: [],
    ...overrides,
  };
}

async function renderEditor(value: BlogPostDetail) {
  render(<BlogPostEditor post={value} />);
  // TipTap creates its view after mount (immediatelyRender: false).
  await screen.findByRole("toolbar");
}

const slugInput = () =>
  screen.getByLabelText("admin.blog.settings.slugLabel") as HTMLInputElement;
const titleInput = () =>
  screen.getByLabelText("admin.blog.editor.titleLabel") as HTMLTextAreaElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refresh.mockResolvedValue({ ok: true });
  mocks.seoStatus.data = { enabled: true };
  Object.assign(mocks.suggest, {
    isPending: false,
    isError: false,
    error: null,
  });
});

describe("BlogPostEditor", () => {
  it("keeps the slug in step with the title until it is edited by hand", async () => {
    await renderEditor(post());

    fireEvent.change(titleInput(), {
      target: { value: "Vốn lưu động là gì?" },
    });
    expect(slugInput().value).toBe("von-luu-dong-la-gi");

    fireEvent.change(slugInput(), { target: { value: "Von Luu Dong" } });
    expect(slugInput().value).toBe("von-luu-dong");
    fireEvent.change(titleInput(), { target: { value: "Tiêu đề khác" } });
    expect(slugInput().value).toBe("von-luu-dong");
  });

  it("locks the slug of a post that has been published, and offers unpublish and view live", async () => {
    await renderEditor(
      post({ status: "published", published_at: "2026-11-20T03:00:00Z" }),
    );

    expect(slugInput().readOnly).toBe(true);
    fireEvent.change(titleInput(), { target: { value: "Tiêu đề mới" } });
    expect(slugInput().value).toBe("lai-suat-vay-von");
    expect(
      screen.getByRole("button", { name: "admin.blog.actions.unpublish" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "admin.blog.actions.viewLive" }),
    ).toHaveAttribute("href", "/blog/lai-suat-vay-von");
    expect(
      screen.getByRole("link", { name: "admin.blog.actions.searchConsole" }),
    ).toHaveAttribute("href", "https://search.google.com/search-console");
    expect(
      screen.queryByRole("button", { name: "admin.blog.actions.delete" }),
    ).toBeNull();
  });

  it("says what is missing instead of publishing an incomplete post", async () => {
    await renderEditor(post());

    fireEvent.click(
      screen.getByRole("button", { name: "admin.blog.actions.publish" }),
    );

    expect(mocks.publish.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.update.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("saves unsaved edits first, publishes that version, then refreshes the public pages", async () => {
    mocks.update.mutateAsync.mockResolvedValue(
      post({ version: 4, excerpt: "Mô tả" }),
    );
    mocks.publish.mutateAsync.mockResolvedValue(
      post({
        version: 5,
        status: "published",
        published_at: "2026-11-21T04:00:00Z",
      }),
    );
    await renderEditor(post());

    fireEvent.change(
      screen.getByLabelText("admin.blog.settings.excerptLabel"),
      {
        target: { value: "Mô tả" },
      },
    );
    expect(screen.getByTestId("blog-save-state")).toHaveTextContent(
      "admin.blog.editor.unsaved",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "admin.blog.actions.publish" }),
    );

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.update.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "lai-suat-vay-von",
        excerpt: "Mô tả",
        version: 3,
        content: expect.objectContaining({ type: "doc" }),
      }),
    );
    expect(mocks.publish.mutateAsync).toHaveBeenCalledWith(4);
    expect(screen.getByTestId("blog-save-state")).toHaveTextContent(
      "admin.blog.editor.saved",
    );
  });

  it("saves on Ctrl+S without refreshing the public pages for a draft", async () => {
    mocks.update.mutateAsync.mockResolvedValue(post({ version: 4 }));
    await renderEditor(post());

    await act(async () => {
      fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    });

    await waitFor(() => expect(mocks.update.mutateAsync).toHaveBeenCalled());
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "admin.blog.toast.saved",
    });
  });

  it("refreshes the public pages after saving a live post", async () => {
    const live = post({
      status: "published",
      published_at: "2026-11-20T03:00:00Z",
    });
    mocks.update.mutateAsync.mockResolvedValue({ ...live, version: 4 });
    await renderEditor(live);

    fireEvent.click(
      screen.getByRole("button", { name: "admin.blog.actions.saveLive" }),
    );

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "admin.blog.toast.liveUpdated",
    });
  });

  it("explains a version conflict and offers a reload", async () => {
    mocks.update.mutateAsync.mockRejectedValue({
      message: "Version conflict",
      status: 409,
      code: "BLOG_VERSION_CONFLICT",
    });
    await renderEditor(post());

    fireEvent.click(
      screen.getByRole("button", { name: "admin.blog.actions.save" }),
    );

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "admin.blog.errors.BLOG_VERSION_CONFLICT",
          action: expect.anything(),
        }),
      ),
    );
  });

  it("warns past what search results show", async () => {
    await renderEditor(post());

    fireEvent.change(
      screen.getByLabelText("admin.blog.settings.seoTitleLabel"),
      {
        target: { value: "x".repeat(61) },
      },
    );

    expect(
      screen.getByText("admin.blog.settings.overLimit"),
    ).toBeInTheDocument();
  });

  it("checks the focus keyword live and saves the keywords with the post", async () => {
    mocks.update.mutateAsync.mockResolvedValue(post({ version: 2 }));
    await renderEditor(post());

    expect(screen.getByText("admin.blog.checklist.empty")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("admin.blog.keywords.focusLabel"), {
      target: { value: "LÃI SUẤT vay vốn" },
    });

    // Title "Lãi suất vay vốn" and slug lai-suat-vay-von have it; the body,
    // the empty description and the (absent) headings do not.
    const state = (id: string) =>
      screen.getByTestId(`blog-seo-check-${id}`).getAttribute("data-state");
    expect(state("postTitle")).toBe("pass");
    expect(state("seoTitle")).toBe("pass");
    expect(state("slug")).toBe("pass");
    expect(state("description")).toBe("fail");
    expect(state("intro")).toBe("fail");
    expect(state("heading")).toBe("fail");
    expect(state("imageAlt")).toBe("na");

    const secondary = screen.getByRole("textbox", {
      name: "admin.blog.keywords.secondaryLabel",
    });
    fireEvent.change(secondary, { target: { value: "nội dung" } });
    fireEvent.keyDown(secondary, { key: "Enter" });
    fireEvent.change(secondary, { target: { value: "NỘI  DUNG" } });
    fireEvent.keyDown(secondary, { key: "Enter" });
    expect(
      screen.getByText("admin.blog.keywords.duplicate"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("admin.blog.checklist.secondaryFound"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "admin.blog.actions.save" }),
    );
    await waitFor(() => expect(mocks.update.mutateAsync).toHaveBeenCalled());
    expect(mocks.update.mutateAsync.mock.calls[0][0]).toMatchObject({
      focus_keyword: "LÃI SUẤT vay vốn",
      secondary_keywords: ["nội dung"],
    });
  });
});

const SUGGESTIONS: BlogSeoSuggestions = {
  titles: [
    {
      title: "Lãi suất vay vốn cho doanh nghiệp nhỏ",
      intent: "Người đang tìm hiểu lãi suất.",
    },
    {
      title: "Cách so sánh lãi suất vay vốn",
      intent: "Người đang so sánh các lựa chọn.",
    },
  ],
  meta_description:
    "Lãi suất vay vốn cho doanh nghiệp nhỏ và cách đọc nội dung.",
  focus_keyword: "lãi suất vay vốn",
  related_terms: ["nội dung", "vốn lưu động"],
};

const suggestButton = () =>
  screen.getByRole("button", {
    name: /admin\.blog\.seoAssistant\.(suggest|working)/,
  });
const suggestionRow = (text: string) =>
  screen
    .getAllByText(text)
    .map((node) => node.closest("li"))
    .find((row) => row?.hasAttribute("data-applied")) as HTMLElement;
const useSuggestion = (text: string) =>
  fireEvent.click(
    within(suggestionRow(text)).getByRole("button", {
      name: "admin.blog.seoAssistant.useLabel",
    }),
  );

describe("Suggest SEO", () => {
  it("stays hidden until it is switched on for this admin", async () => {
    mocks.seoStatus.data = { enabled: false };
    await renderEditor(post());
    expect(screen.queryByTestId("blog-seo-suggestions")).toBeNull();
  });

  it("sends the draft on screen, unsaved edits included, and saves nothing", async () => {
    await renderEditor(post());

    fireEvent.change(titleInput(), {
      target: { value: "Vốn lưu động là gì?" },
    });
    fireEvent.click(suggestButton());

    expect(mocks.suggest.mutate).toHaveBeenCalledWith(
      { title: "Vốn lưu động là gì?", locale: "vi", text: "Nội dung" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mocks.update.mutateAsync).not.toHaveBeenCalled();
  });

  it("applies one field per Use this, and the checklist and preview follow", async () => {
    mocks.suggest.mutate.mockImplementation(
      (_draft, options: { onSuccess: (value: BlogSeoSuggestions) => void }) =>
        options.onSuccess(SUGGESTIONS),
    );
    await renderEditor(post());
    fireEvent.click(suggestButton());

    const seoTitle = () =>
      screen.getByLabelText(
        "admin.blog.settings.seoTitleLabel",
      ) as HTMLInputElement;
    const excerpt = () =>
      screen.getByLabelText(
        "admin.blog.settings.excerptLabel",
      ) as HTMLTextAreaElement;
    const focus = () =>
      screen.getByLabelText(
        "admin.blog.keywords.focusLabel",
      ) as HTMLInputElement;

    // The second title option: only the SEO title changes.
    const title = SUGGESTIONS.titles[1].title;
    expect(screen.getAllByText(title)).toHaveLength(1);
    useSuggestion(title);
    expect(seoTitle().value).toBe(title);
    expect(excerpt().value).toBe("");
    expect(focus().value).toBe("");
    expect(titleInput().value).toBe("Lãi suất vay vốn");
    // Suggestion row + the search preview's title.
    expect(screen.getAllByText(title)).toHaveLength(2);
    expect(suggestionRow(title)).toHaveAttribute("data-applied", "true");

    useSuggestion(SUGGESTIONS.meta_description);
    expect(excerpt().value).toBe(SUGGESTIONS.meta_description);
    expect(seoTitle().value).toBe(title);

    useSuggestion(SUGGESTIONS.focus_keyword);
    expect(focus().value).toBe("lãi suất vay vốn");
    const state = (id: string) =>
      screen.getByTestId(`blog-seo-check-${id}`).getAttribute("data-state");
    expect(state("description")).toBe("pass");
    expect(state("seoTitle")).toBe("pass");

    useSuggestion("nội dung");
    // The badges under the keyword input, then the checklist's list.
    const [badges] = screen.getAllByRole("list", {
      name: "admin.blog.keywords.secondaryLabel",
    });
    expect(badges).toHaveTextContent("nội dung");
    expect(
      screen.getByText("admin.blog.checklist.secondaryFound"),
    ).toBeInTheDocument();

    // Applied to the draft only: saving stays the admin's call.
    expect(screen.getByTestId("blog-save-state")).toHaveTextContent(
      "admin.blog.editor.unsaved",
    );
    expect(mocks.update.mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps the editor usable while Claude works", async () => {
    mocks.suggest.isPending = true;
    await renderEditor(post());

    expect(suggestButton()).toBeDisabled();
    expect(
      screen.getByText("admin.blog.seoAssistant.workingHint"),
    ).toBeInTheDocument();
    fireEvent.change(titleInput(), { target: { value: "Đang sửa tiếp" } });
    expect(titleInput().value).toBe("Đang sửa tiếp");
    expect(
      screen.getByRole("button", { name: "admin.blog.actions.save" }),
    ).toBeEnabled();
  });

  it("explains a failure, leaves the draft as it was and offers a retry", async () => {
    mocks.suggest.isError = true;
    mocks.suggest.error = { code: "BLOG_SEO_BUSY", message: "slow" };
    await renderEditor(post({ seo_title: "Tiêu đề cũ", excerpt: "Mô tả cũ" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "admin.blog.seoAssistant.errors.BLOG_SEO_BUSY",
    );
    expect(
      (
        screen.getByLabelText(
          "admin.blog.settings.seoTitleLabel",
        ) as HTMLInputElement
      ).value,
    ).toBe("Tiêu đề cũ");
    expect(screen.getByTestId("blog-save-state")).toHaveTextContent(
      "admin.blog.editor.saved",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "admin.blog.seoAssistant.retry" }),
    );
    expect(mocks.suggest.mutate).toHaveBeenCalledTimes(1);
  });

  it("names each failure the backend reports, and falls back for the rest", () => {
    expect(
      seoSuggestionErrorKey({ code: "BLOG_SEO_NO_CREDIT", message: "" }),
    ).toBe("admin.blog.seoAssistant.errors.BLOG_SEO_NO_CREDIT");
    expect(
      seoSuggestionErrorKey({ code: "BLOG_SEO_FAILED", message: "" }),
    ).toBe("admin.blog.seoAssistant.errors.BLOG_SEO_FAILED");
    expect(
      seoSuggestionErrorKey({ message: "timeout of 35000ms exceeded" }),
    ).toBe("admin.blog.seoAssistant.errors.generic");
    expect(seoSuggestionErrorKey(null)).toBe(
      "admin.blog.seoAssistant.errors.generic",
    );
  });
});
