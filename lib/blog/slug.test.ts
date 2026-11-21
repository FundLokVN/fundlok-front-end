import { describe, expect, it } from "vitest";

import { SLUG_MAX_LENGTH, isValidSlug, slugify } from "./slug";

describe("slugify", () => {
  it("strips Vietnamese diacritics", () => {
    expect(slugify("Lãi suất vay vốn 2026")).toBe("lai-suat-vay-von-2026");
    expect(slugify("Hướng dẫn vay vốn cho doanh nghiệp nhỏ")).toBe(
      "huong-dan-vay-von-cho-doanh-nghiep-nho",
    );
  });

  it("turns đ and Đ into d, which have no Unicode decomposition", () => {
    expect(slugify("Đầu tư đúng cách")).toBe("dau-tu-dung-cach");
  });

  it("collapses punctuation and whitespace into single hyphens", () => {
    expect(slugify("  Vốn lưu động: là gì?  (Phần 1) ")).toBe(
      "von-luu-dong-la-gi-phan-1",
    );
  });

  it("never keeps a dot, which proxy.ts would read as a file", () => {
    expect(slugify("Phiên bản 1.2")).toBe("phien-ban-1-2");
  });

  it("returns an empty string when nothing is left", () => {
    expect(slugify("🎉 !!!")).toBe("");
  });

  it("cuts at the limit on a whole word", () => {
    const title = "Doanh nghiệp vừa và nhỏ ".repeat(10);
    const slug = slugify(title);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    expect(isValidSlug(slug)).toBe(true);
    // Ends on a complete word of the title, not a fragment like "ngh".
    expect(slug).toMatch(/-(doanh|nghiep|vua|va|nho)$/);
  });

  it("honours a custom maximum", () => {
    expect(slugify("Lãi suất tham khảo", 9)).toBe("lai-suat");
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    expect(isValidSlug("lai-suat-2026")).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["Lai-suat", "uppercase"],
    ["lai--suat", "double hyphen"],
    ["-lai", "leading hyphen"],
    ["lai-", "trailing hyphen"],
    ["lai.suat", "dot"],
    ["lãi", "diacritic"],
    ["a".repeat(SLUG_MAX_LENGTH + 1), "too long"],
  ])("refuses %j (%s)", (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});
