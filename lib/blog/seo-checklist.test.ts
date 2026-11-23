import { describe, expect, it } from "vitest";

import {
  addSecondaryKeyword,
  documentParts,
  keywordKey,
  normalizeKeyword,
  seoChecklist,
  type SeoChecklistInput,
} from "./seo-checklist";
import type { BlogContent } from "./types";

const text = (value: string): BlogContent => ({ type: "text", text: value });
const paragraph = (...children: BlogContent[]): BlogContent => ({
  type: "paragraph",
  content: children,
});
const heading = (level: number, value: string): BlogContent => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});
const image = (alt: string): BlogContent => ({
  type: "image",
  attrs: { src: "https://media.fundlok.com/blog/x.png", alt },
});
const list = (...items: string[]): BlogContent => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(text(item))],
  })),
});
const doc = (...blocks: BlogContent[]): BlogContent => ({
  type: "doc",
  content: blocks,
});

const KEYWORD = "vay vốn trả góp hằng ngày";

function input(overrides: Partial<SeoChecklistInput> = {}): SeoChecklistInput {
  return {
    focusKeyword: KEYWORD,
    secondaryKeywords: [],
    postTitle: "Vay vốn trả góp hằng ngày: cách hoạt động",
    searchTitle: "Vay vốn trả góp hằng ngày cho doanh nghiệp nhỏ",
    description:
      "Vay vốn trả góp hằng ngày giúp doanh nghiệp trả nợ theo nhịp bán hàng.",
    slug: "vay-von-tra-gop-hang-ngay-cach-hoat-dong",
    coverAlt: "",
    content: doc(
      paragraph(
        text("Vay vốn "),
        text("trả góp hằng ngày"),
        text(" là cách trả nợ."),
      ),
      heading(2, "Vay vốn trả góp hằng ngày hoạt động thế nào?"),
      paragraph(text("Kỳ hạn từ 1 đến 6 tháng.")),
      image("Lịch vay vốn trả góp hằng ngày"),
    ),
    ...overrides,
  };
}

const states = (overrides: Partial<SeoChecklistInput> = {}) =>
  Object.fromEntries(
    seoChecklist(input(overrides)).checks.map((c) => [c.id, c.state]),
  );

describe("seoChecklist", () => {
  it("passes every check when the keyword is used where Google reads", () => {
    const result = seoChecklist(input());
    expect(result.checks.every((c) => c.state === "pass")).toBe(true);
    expect([result.passed, result.total]).toEqual([7, 7]);
  });

  it("matches across separate text marks and ignores case", () => {
    expect(states({ focusKeyword: "VAY VỐN Trả Góp  hằng ngày" }).intro).toBe(
      "pass",
    );
  });

  it("keeps Vietnamese diacritics: 'vay von' is a different phrase", () => {
    const result = states({ focusKeyword: "vay von tra gop hang ngay" });
    expect(result.seoTitle).toBe("fail");
    expect(result.intro).toBe("fail");
    // The slug never has diacritics, so it still matches there.
    expect(result.slug).toBe("pass");
  });

  it("checks the slug by whole words", () => {
    expect(states({ slug: "vay-von-tra-gop-hang-ngay" }).slug).toBe("pass");
    expect(states({ slug: "xvay-von-tra-gop-hang-ngay" }).slug).toBe("fail");
    expect(states({ slug: "lai-suat-vay-von" }).slug).toBe("fail");
  });

  it("only counts the first top-level paragraph as the intro", () => {
    const content = doc(
      list(`Gạch đầu dòng có ${KEYWORD}`),
      paragraph(text("Đoạn đầu không có từ khóa.")),
      paragraph(text(`Đoạn sau có ${KEYWORD}.`)),
    );
    expect(states({ content }).intro).toBe("fail");
    expect(states({ content: doc(heading(2, "Mở đầu")) }).intro).toBe("fail");
  });

  it("finds the keyword in H2 or H3, and fails with no headings", () => {
    expect(
      states({ content: doc(paragraph(text(KEYWORD)), heading(3, KEYWORD)) })
        .heading,
    ).toBe("pass");
    expect(states({ content: doc(paragraph(text(KEYWORD))) }).heading).toBe(
      "fail",
    );
  });

  it("treats image alt as not applicable until there is an image", () => {
    const noImages = seoChecklist(
      input({ content: doc(paragraph(text(KEYWORD)), heading(2, KEYWORD)) }),
    );
    expect(noImages.checks.find((c) => c.id === "imageAlt")?.state).toBe("na");
    expect(noImages.total).toBe(6);

    expect(
      states({
        content: doc(paragraph(text(KEYWORD)), image("Ảnh minh họa")),
        coverAlt: `Ảnh bìa ${KEYWORD}`,
      }).imageAlt,
    ).toBe("pass");
    expect(
      states({ content: doc(paragraph(text(KEYWORD)), image("Ảnh minh họa")) })
        .imageAlt,
    ).toBe("fail");
  });

  it("uses the search title for the SEO check and the post title for the H1 check", () => {
    const result = states({
      postTitle: "Một tiêu đề khác",
      searchTitle: `${KEYWORD} | FundLok`,
    });
    expect([result.postTitle, result.seoTitle]).toEqual(["fail", "pass"]);
  });

  it("has no checks without a focus keyword, but still reports secondary ones", () => {
    const result = seoChecklist(
      input({
        focusKeyword: "  ",
        secondaryKeywords: ["kỳ hạn", "phí kích hoạt"],
      }),
    );
    expect(result.checks).toEqual([]);
    expect(result.secondary).toEqual([
      { keyword: "kỳ hạn", found: true },
      { keyword: "phí kích hoạt", found: false },
    ]);
  });

  it("finds secondary keywords in lists and the description too", () => {
    const result = seoChecklist(
      input({
        secondaryKeywords: ["không phạt trả trước hạn", "nhịp bán hàng"],
        content: doc(list("Trả góp hằng ngày", "Không phạt trả trước hạn")),
      }),
    );
    expect(result.secondary.map((s) => s.found)).toEqual([true, true]);
  });
});

describe("documentParts", () => {
  it("keeps words in separate blocks apart", () => {
    const parts = documentParts(
      doc(paragraph(text("một")), list("hai", "ba"), heading(2, "bốn")),
    );
    expect(parts.text).toBe("một hai ba bốn");
    expect(parts.headings).toEqual(["bốn"]);
    expect(parts.firstParagraph).toBe("một");
  });
});

describe("keywords", () => {
  it("normalises spacing and Unicode, keeping the admin's casing", () => {
    expect(normalizeKeyword("  Vay   vốn\n ")).toBe("Vay vốn");
    expect(normalizeKeyword("vốn")).toBe("vốn"); // NFD in, NFC out
    expect(keywordKey("VAY VỐN")).toBe(keywordKey("vay vốn"));
  });

  const limits = { max: 4, maxLength: 100 };

  it("adds a keyword, refusing blanks, repeats and the focus keyword", () => {
    expect(addSecondaryKeyword([], "vay vốn", "  lãi  suất ", limits)).toEqual({
      list: ["lãi suất"],
      result: "added",
    });
    expect(
      addSecondaryKeyword(["lãi suất"], "", "LÃI SUẤT", limits).result,
    ).toBe("duplicate");
    expect(addSecondaryKeyword([], "Vay vốn", "vay  VỐN", limits).result).toBe(
      "duplicate",
    );
    expect(addSecondaryKeyword([], "", "   ", limits).result).toBe("empty");
  });

  it("stops at the limit and trims to the maximum length", () => {
    expect(
      addSecondaryKeyword(["a", "b", "c", "d"], "", "e", limits).result,
    ).toBe("full");
    expect(
      addSecondaryKeyword([], "", "x".repeat(120), limits).list[0],
    ).toHaveLength(100);
  });
});
