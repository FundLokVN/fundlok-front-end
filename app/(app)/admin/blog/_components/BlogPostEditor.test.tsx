import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import type { BlogPostDetail } from "@/services/admin-blog.service";
import { BlogPostEditor } from "./BlogPostEditor";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  update: { mutateAsync: vi.fn(), isPending: false },
  publish: { mutateAsync: vi.fn(), isPending: false },
  unpublish: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
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
});
