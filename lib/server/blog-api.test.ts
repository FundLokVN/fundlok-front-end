import { afterEach, expect, it, vi } from "vitest";
import { listAllPublishedPosts } from "./blog-api";

afterEach(() => vi.unstubAllGlobals());

it("includes older posts by following the API's next offset", async () => {
  const fetchPosts = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ items: [{ slug: "new" }], next_offset: 50 }),
    )
    .mockResolvedValueOnce(
      Response.json({ items: [{ slug: "old" }], next_offset: null }),
    );
  vi.stubGlobal("fetch", fetchPosts);
  expect((await listAllPublishedPosts()).map((post) => post.slug)).toEqual([
    "new",
    "old",
  ]);
  expect(new URL(fetchPosts.mock.calls[1][0]).searchParams.get("offset")).toBe(
    "50",
  );
});
