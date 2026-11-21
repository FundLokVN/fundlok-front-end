import type { ReactNode } from "react";
import { getSchema, type JSONContent } from "@tiptap/core";
import { Node as ProseMirrorNode, type Schema } from "@tiptap/pm/model";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";

import { blogContentExtensions } from "@/lib/blog/extensions";
import { isExternalHref, isSafeHref, isSafeImageSrc } from "@/lib/blog/links";
import { slugify } from "@/lib/blog/slug";
import { SITE_URL } from "@/lib/site";

/**
 * A published post's TipTap JSON, drawn as React on the server.
 *
 * NO RAW HTML, ANYWHERE
 * Every node becomes a React element through @tiptap/static-renderer, so text
 * is escaped by React and there is no dangerouslySetInnerHTML for a stray
 * <script> to ride in on. The backend has already refused anything outside
 * the schema (app/blog/validation.py); this file checks the two attributes
 * that could still do harm, link hrefs and image sources, a second time.
 *
 * HEADING IDS
 * Each H2/H3 gets an id slugified from its text ("Lãi suất" → "lai-suat",
 * numbered on repeats), and the table of contents links to them. Ids and TOC
 * come from the same walk of the same parsed document, so they cannot drift.
 * Anchored headings plus a TOC are what Google turns into "jump to" links
 * under the result.
 */

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

// Fallback id for a heading whose text slugifies to nothing (only emoji, say).
const EMPTY_HEADING_ID = "muc";

let schemaCache: Schema | null = null;
function blogSchema(): Schema {
  schemaCache ??= getSchema(blogContentExtensions);
  return schemaCache;
}

/**
 * The JSON with every node and mark type the schema does not know dropped,
 * and empty text nodes removed (ProseMirror refuses to build those).
 */
function sanitize(
  node: unknown,
  schema: Schema,
  isRoot: boolean,
): JSONContent | null {
  if (!node || typeof node !== "object") return null;
  const json = node as JSONContent;
  if (typeof json.type !== "string" || !(json.type in schema.nodes)) {
    return null;
  }
  if ((json.type === "doc") !== isRoot) return null;

  const out: JSONContent = { type: json.type };
  if (json.attrs && typeof json.attrs === "object") out.attrs = json.attrs;
  if (json.type === "text") {
    if (typeof json.text !== "string" || !json.text) return null;
    out.text = json.text;
  }
  if (Array.isArray(json.marks)) {
    const marks = json.marks.filter(
      (mark) =>
        mark &&
        typeof mark === "object" &&
        typeof mark.type === "string" &&
        mark.type in schema.marks,
    );
    if (marks.length) out.marks = marks;
  }
  if (Array.isArray(json.content)) {
    out.content = json.content
      .map((child) => sanitize(child, schema, false))
      .filter((child): child is JSONContent => child !== null);
  }
  return out;
}

/** The post's document, or null when there is nothing renderable. */
export function parseBlogDocument(content: unknown): ProseMirrorNode | null {
  const schema = blogSchema();
  const clean = sanitize(content, schema, true);
  if (!clean) return null;
  try {
    return ProseMirrorNode.fromJSON(schema, clean);
  } catch {
    return null;
  }
}

/** Every heading in document order, with its unique id. */
function headingEntries(doc: ProseMirrorNode): Map<ProseMirrorNode, TocEntry> {
  const entries = new Map<ProseMirrorNode, TocEntry>();
  const taken = new Set<string>();
  doc.descendants((node) => {
    if (node.type.name !== "heading") return true;
    const text = node.textContent.trim();
    const base = slugify(text) || EMPTY_HEADING_ID;
    let id = base;
    for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
    taken.add(id);
    entries.set(node, { id, text, level: node.attrs.level === 3 ? 3 : 2 });
    // A heading holds only inline content: nothing below it to visit.
    return false;
  });
  return entries;
}

/** The table of contents: every H2/H3 with text, in document order. */
export function extractToc(content: unknown): TocEntry[] {
  const doc = parseBlogDocument(content);
  if (!doc) return [];
  return [...headingEntries(doc).values()].filter((entry) => entry.text);
}

export function renderBlogContent(content: unknown): ReactNode {
  const doc = parseBlogDocument(content);
  if (!doc) return null;
  const headings = headingEntries(doc);

  return renderToReactElement({
    content: doc,
    extensions: blogContentExtensions,
    options: {
      nodeMapping: {
        heading: ({ node, children }) => {
          const entry = headings.get(node);
          const Tag = entry?.level === 3 ? "h3" : "h2";
          return <Tag id={entry?.id}>{children}</Tag>;
        },
        image: ({ node }) => {
          const { src, alt, title, width, height } = node.attrs;
          if (!isSafeImageSrc(src)) return null;
          return (
            // A plain <img>: the media host serves the file as uploaded, and
            // its dimensions are not known here to give next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={typeof alt === "string" ? alt : ""}
              title={typeof title === "string" && title ? title : undefined}
              width={typeof width === "number" ? width : undefined}
              height={typeof height === "number" ? height : undefined}
              loading="lazy"
              decoding="async"
            />
          );
        },
      },
      markMapping: {
        link: ({ mark, children }) => {
          const href: unknown = mark.attrs.href;
          // A second check after the backend's: an unsafe href is dropped and
          // the text stays, unlinked.
          if (!isSafeHref(href)) return <>{children}</>;
          const newTab = mark.attrs.target === "_blank";
          const external = isExternalHref(href, SITE_URL);
          return (
            <a
              href={href}
              target={newTab ? "_blank" : undefined}
              rel={external || newTab ? "noopener noreferrer" : undefined}
            >
              {children}
            </a>
          );
        },
      },
      // Unreachable after sanitize(); here so an unknown type renders nothing
      // instead of throwing and taking the page down.
      unhandledNode: () => null,
      unhandledMark: ({ children }) => <>{children}</>,
    },
  });
}
