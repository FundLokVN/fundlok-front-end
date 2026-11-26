import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { recordBlogView } from "@/services/public-blog.service";
import { BlogView } from "./BlogView";

vi.mock("@/services/public-blog.service", () => ({
  recordBlogView: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it("counts one view only after the post becomes visible", () => {
  const visibility = vi.spyOn(document, "visibilityState", "get");
  visibility.mockReturnValue("hidden");
  render(
    <StrictMode>
      <BlogView slug="bai-viet" locale="vi" />
    </StrictMode>,
  );
  expect(recordBlogView).not.toHaveBeenCalled();

  visibility.mockReturnValue("visible");
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(recordBlogView).toHaveBeenCalledExactlyOnceWith("vi", "bai-viet");
});
