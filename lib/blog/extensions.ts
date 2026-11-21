import type { Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";

import { isBlogMediaUrl, isSafeHref } from "@/lib/blog/links";

/**
 * The one TipTap schema for blog posts, shared by the admin editor and the
 * public renderer (lib/blog/render.tsx), so a post can only contain what the
 * public page knows how to draw. The backend enforces the same allowlist on
 * save (app/blog/validation.py NODE_ATTRS / MARK_ATTRS):
 *
 *   - headings H2 and H3 only: the post title is the page's H1;
 *   - paragraphs, bold, italic, underline, strike, hard breaks;
 *   - links: http, https, mailto, tel, a /path or a #anchor (lib/blog/links);
 *   - bullet and numbered lists, blockquotes, horizontal rules;
 *   - block images from the media host, with alt text.
 *
 * Off: inline code and code blocks (nothing on a finance blog needs them, and
 * the backend refuses them), base64 images.
 */

// Pasted HTML keeps an <img> only when it already lives on the media host.
// An image copied from another site would be refused by the backend on save
// ("image must be uploaded through the editor"); dropping it on paste says the
// same thing sooner. Images inserted through the dialog never come through
// here: they are set as JSON.
const BlogImage = Image.extend({
  parseHTML() {
    return [
      {
        tag: 'img[src]:not([src^="data:"])',
        getAttrs: (element) =>
          isBlogMediaUrl(element.getAttribute("src")) ? null : false,
      },
    ];
  },
});

export const blogContentExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    link: {
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto", "tel"],
      // No default target/rel/class: the stored JSON then carries only what
      // the author chose. The public renderer adds rel="noopener noreferrer"
      // to external links itself.
      HTMLAttributes: { target: null, rel: null, class: null },
      isAllowedUri: (url) => isSafeHref(url),
    },
  }),
  BlogImage.configure({ allowBase64: false, inline: false }),
];

/** The editor's list: the schema plus editor-only helpers (no nodes). */
export function blogEditorExtensions(placeholder: string): Extensions {
  return [
    ...blogContentExtensions,
    Placeholder.configure({ placeholder }),
    CharacterCount,
  ];
}
