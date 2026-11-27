import { beforeEach, expect, it, vi } from "vitest";

import { refreshPublicBlog } from "./actions";

const { backendGet, revalidatePath, updateTag } = vi.hoisted(() => ({
  backendGet: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath, updateTag }));
vi.mock("@/lib/server/backend-get", () => ({ backendGet }));
vi.mock("@/lib/server/blog-api", () => ({ BLOG_CACHE_TAG: "blog" }));

beforeEach(() => {
  vi.resetAllMocks();
});

it.each(["ADMIN", "SYSTEM_ADMIN"])(
  "refreshes both the blog data and the sitemap for %s",
  async (role) => {
    backendGet.mockResolvedValue({ ok: true, data: { role } });

    await expect(refreshPublicBlog()).resolves.toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith("blog");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  },
);

it.each([{ ok: false }, { ok: true, data: { role: "INVESTOR" } }])(
  "leaves both caches alone when access is denied (%j)",
  async (result) => {
    backendGet.mockResolvedValue(result);

    await expect(refreshPublicBlog()).resolves.toEqual({ ok: false });
    expect(updateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  },
);
