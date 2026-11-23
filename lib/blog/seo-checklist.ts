import { slugify } from "./slug";
import type { BlogContent } from "./types";

/**
 * The editor's SEO checklist: does the post use its focus keyword where
 * search engines read it? Keywords themselves never reach the page (search
 * engines ignore <meta name="keywords">); they only drive these checks.
 *
 * Matching is case-insensitive and Unicode-normalised ("Vay Vốn" matches
 * "vay vốn"), but keeps Vietnamese diacritics: "vay von" is a different
 * phrase. The slug is the exception, since it never has diacritics.
 */

export type SeoCheckId =
  | "postTitle"
  | "seoTitle"
  | "description"
  | "slug"
  | "intro"
  | "heading"
  | "imageAlt";

/** "na" only when there is nothing to check yet (no image at all). */
export type SeoCheckState = "pass" | "fail" | "na";

export interface SeoCheck {
  id: SeoCheckId;
  state: SeoCheckState;
}

export interface SecondaryKeywordCheck {
  keyword: string;
  found: boolean;
}

export interface SeoChecklistResult {
  checks: SeoCheck[];
  secondary: SecondaryKeywordCheck[];
  passed: number;
  /** Checks that apply (not "na"). */
  total: number;
}

export interface SeoChecklistInput {
  focusKeyword: string;
  secondaryKeywords: string[];
  /** The big title on the page (H1). */
  postTitle: string;
  /** What Google shows: the SEO title, or the post title when it is blank. */
  searchTitle: string;
  description: string;
  slug: string;
  coverAlt: string;
  content: BlogContent;
}

/** NFC, single spaces, trimmed. Keeps the admin's casing (stored as typed). */
export function normalizeKeyword(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** What two keywords are compared by: case-insensitive, Vietnamese included. */
export function keywordKey(value: string): string {
  return normalizeKeyword(value).toLocaleLowerCase("vi");
}

function contains(haystack: string, keyword: string): boolean {
  const needle = keywordKey(keyword);
  return needle !== "" && keywordKey(haystack).includes(needle);
}

interface DocumentParts {
  firstParagraph: string | null;
  headings: string[];
  imageAlts: string[];
  text: string;
}

const BLOCKS = new Set([
  "paragraph",
  "heading",
  "listItem",
  "blockquote",
  "bulletList",
  "orderedList",
]);

function textOf(node: BlogContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return " ";
  const children = (node.content ?? []).map(textOf);
  return children.join(
    (node.content ?? []).some((child) => BLOCKS.has(child.type ?? ""))
      ? " "
      : "",
  );
}

/** The parts of a TipTap document the checklist looks at. */
export function documentParts(content: BlogContent): DocumentParts {
  const headings: string[] = [];
  const imageAlts: string[] = [];
  const walk = (node: BlogContent) => {
    if (node.type === "heading") headings.push(textOf(node));
    if (node.type === "image" && typeof node.attrs?.alt === "string") {
      imageAlts.push(node.attrs.alt);
    }
    (node.content ?? []).forEach(walk);
  };
  walk(content);

  // The opening paragraph is the first top-level one with text: a list or a
  // heading before it is not "the first paragraph" a reader sees.
  const first = (content.content ?? []).find(
    (node) => node.type === "paragraph" && textOf(node).trim() !== "",
  );

  return {
    firstParagraph: first ? textOf(first) : null,
    headings,
    imageAlts,
    text: textOf(content),
  };
}

function slugContains(slug: string, keyword: string): boolean {
  const keywordSlug = slugify(keyword);
  return keywordSlug !== "" && `-${slug}-`.includes(`-${keywordSlug}-`);
}

const state = (ok: boolean): SeoCheckState => (ok ? "pass" : "fail");

export function seoChecklist(input: SeoChecklistInput): SeoChecklistResult {
  const focus = normalizeKeyword(input.focusKeyword);
  const parts = documentParts(input.content);
  const alts = [...parts.imageAlts, input.coverAlt].filter(
    (alt) => alt.trim() !== "",
  );

  const checks: SeoCheck[] = focus
    ? [
        { id: "postTitle", state: state(contains(input.postTitle, focus)) },
        { id: "seoTitle", state: state(contains(input.searchTitle, focus)) },
        { id: "description", state: state(contains(input.description, focus)) },
        { id: "slug", state: state(slugContains(input.slug, focus)) },
        {
          id: "intro",
          state: state(
            parts.firstParagraph !== null &&
              contains(parts.firstParagraph, focus),
          ),
        },
        {
          id: "heading",
          state: state(parts.headings.some((h) => contains(h, focus))),
        },
        {
          id: "imageAlt",
          state:
            alts.length === 0
              ? "na"
              : state(alts.some((alt) => contains(alt, focus))),
        },
      ]
    : [];

  // A secondary keyword counts if it appears anywhere a reader sees it.
  const everywhere = [
    input.postTitle,
    input.searchTitle,
    input.description,
    parts.text,
  ].join(" ");
  const secondary = input.secondaryKeywords.map((keyword) => ({
    keyword,
    found: contains(everywhere, keyword),
  }));

  const applicable = checks.filter((check) => check.state !== "na");
  return {
    checks,
    secondary,
    passed: applicable.filter((check) => check.state === "pass").length,
    total: applicable.length,
  };
}

export type AddKeywordResult = "added" | "empty" | "duplicate" | "full";

/**
 * Add a secondary keyword the way the backend will store it: trimmed, single
 * spaces, no case-insensitive repeat of itself or of the focus keyword.
 */
export function addSecondaryKeyword(
  list: string[],
  focusKeyword: string,
  raw: string,
  { max, maxLength }: { max: number; maxLength: number },
): { list: string[]; result: AddKeywordResult } {
  const keyword = normalizeKeyword(raw).slice(0, maxLength).trim();
  if (!keyword) return { list, result: "empty" };
  const key = keywordKey(keyword);
  if (
    keywordKey(focusKeyword) === key ||
    list.some((existing) => keywordKey(existing) === key)
  ) {
    return { list, result: "duplicate" };
  }
  if (list.length >= max) return { list, result: "full" };
  return { list: [...list, keyword], result: "added" };
}
