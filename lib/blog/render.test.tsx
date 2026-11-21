import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BlogContent } from "./types";
import { extractToc, renderBlogContent } from "./render";

function html(content: unknown): string {
  return renderToStaticMarkup(<>{renderBlogContent(content)}</>);
}

function doc(...content: BlogContent[]): BlogContent {
  return { type: "doc", content };
}

function heading(level: number, text: string): BlogContent {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function paragraph(...content: BlogContent[]): BlogContent {
  return { type: "paragraph", content };
}

function linked(text: string, href: string, target?: string): BlogContent {
  return {
    type: "text",
    text,
    marks: [{ type: "link", attrs: { href, ...(target ? { target } : {}) } }],
  };
}

describe("renderBlogContent", () => {
  it("renders paragraphs, marks and lists as plain elements", () => {
    const out = html(
      doc(
        paragraph(
          { type: "text", text: "Vốn " },
          { type: "text", text: "lưu động", marks: [{ type: "bold" }] },
        ),
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [paragraph({ type: "text", text: "Một" })],
            },
          ],
        },
      ),
    );
    expect(out).toContain("<p>Vốn <strong>lưu động</strong></p>");
    expect(out).toContain("<ul><li><p>Một</p></li></ul>");
  });

  it("gives each heading an id from its text, numbering repeats", () => {
    const out = html(
      doc(
        heading(2, "Lãi suất là gì?"),
        heading(3, "Đầu tư"),
        heading(2, "Lãi suất là gì?"),
      ),
    );
    expect(out).toContain('<h2 id="lai-suat-la-gi">Lãi suất là gì?</h2>');
    expect(out).toContain('<h3 id="dau-tu">Đầu tư</h3>');
    expect(out).toContain('<h2 id="lai-suat-la-gi-2">Lãi suất là gì?</h2>');
  });

  it("never renders an H1 or deeper than H3, whatever the JSON says", () => {
    const out = html(doc(heading(1, "Một"), heading(4, "Bốn")));
    expect(out).not.toMatch(/<h1|<h4/);
    expect(out).toContain('<h2 id="mot">Một</h2>');
  });

  it("drops an unsafe href and keeps the text", () => {
    const out = html(
      doc(
        paragraph(
          linked("bấm", "javascript:alert(1)"),
          { type: "text", text: " và " },
          linked("đây", "java\tscript:alert(1)"),
          { type: "text", text: " " },
          linked("kia", "//evil.example"),
        ),
      ),
    );
    expect(out).not.toContain("<a");
    expect(out).toContain("bấm");
    expect(out).toContain("kia");
  });

  it("marks external links noopener, but not site paths", () => {
    const out = html(
      doc(
        paragraph(
          linked("ngoài", "https://example.com/x"),
          linked("lãi suất", "/rate"),
          linked("mục", "#lai-suat"),
        ),
      ),
    );
    expect(out).toContain(
      '<a href="https://example.com/x" rel="noopener noreferrer">ngoài</a>',
    );
    expect(out).toContain('<a href="/rate">lãi suất</a>');
    expect(out).toContain('<a href="#lai-suat">mục</a>');
  });

  it("opens a new tab only when the author asked for one", () => {
    const out = html(
      doc(paragraph(linked("mới", "https://example.com", "_blank"))),
    );
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("renders images lazily with their alt text, and drops a script src", () => {
    const out = html(
      doc(
        {
          type: "image",
          attrs: {
            src: "https://media.fundlok.com/blog/a.png",
            alt: "Biểu đồ",
          },
        },
        { type: "image", attrs: { src: "javascript:alert(1)", alt: "x" } },
        {
          type: "image",
          attrs: { src: "data:image/png;base64,AAAA", alt: "y" },
        },
      ),
    );
    expect(out).toContain('src="https://media.fundlok.com/blog/a.png"');
    expect(out).toContain('alt="Biểu đồ"');
    expect(out).toContain('loading="lazy"');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("data:image");
  });

  it("drops unknown node and mark types instead of throwing", () => {
    const out = html(
      doc(
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        { type: "codeBlock", content: [{ type: "text", text: "rm -rf" }] },
        paragraph({ type: "text", text: "an toàn", marks: [{ type: "evil" }] }),
      ),
    );
    expect(out).toBe("<p>an toàn</p>");
  });

  it("escapes text rather than interpreting it as HTML", () => {
    const out = html(
      doc(paragraph({ type: "text", text: "<script>x</script>" })),
    );
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script>");
  });

  it("renders nothing for content that is not a document", () => {
    expect(renderBlogContent(null)).toBeNull();
    expect(renderBlogContent({ type: "paragraph" })).toBeNull();
    expect(renderBlogContent("<p>hi</p>")).toBeNull();
  });
});

describe("extractToc", () => {
  it("lists H2 and H3 in order with the same ids the body uses", () => {
    const content = doc(
      heading(2, "Lãi suất là gì?"),
      paragraph({ type: "text", text: "…" }),
      heading(3, "Cách tính"),
      heading(2, "Lãi suất là gì?"),
    );
    const toc = extractToc(content);
    expect(toc).toEqual([
      { id: "lai-suat-la-gi", text: "Lãi suất là gì?", level: 2 },
      { id: "cach-tinh", text: "Cách tính", level: 3 },
      { id: "lai-suat-la-gi-2", text: "Lãi suất là gì?", level: 2 },
    ]);
    const body = html(content);
    for (const entry of toc) expect(body).toContain(`id="${entry.id}"`);
  });

  it("does not collide with a heading whose own text looks numbered", () => {
    const toc = extractToc(
      doc(heading(2, "Vốn"), heading(2, "Vốn"), heading(2, "Vốn 2")),
    );
    expect(toc.map((entry) => entry.id)).toEqual(["von", "von-2", "von-2-2"]);
  });

  it("skips empty headings but keeps the rest", () => {
    const toc = extractToc(
      doc({ type: "heading", attrs: { level: 2 } }, heading(2, "Có chữ")),
    );
    expect(toc).toEqual([{ id: "co-chu", text: "Có chữ", level: 2 }]);
  });
});
