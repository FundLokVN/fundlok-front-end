/**
 * Which hrefs and image sources a blog post may carry.
 *
 * The backend refuses anything else when the post is saved (check_href and
 * check_image_url in app/blog/validation.py); the editor uses these to refuse
 * it earlier, and the public renderer checks again so a bad value can never
 * reach a visitor's page even if one got past the backend.
 *
 * Pure, so the editor (browser), the renderer (server), next.config.ts and
 * lib/csp.ts can all import it.
 */

const LINK_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

// Whitespace and control characters let "java\tscript:" past a naive scheme
// check; a backslash makes "/\evil.com" protocol-relative in browsers.
const UNSAFE_CHARACTERS = /[\s\u0000-\u001f\u007f\\]/;

const MAX_HREF = 2000;

/**
 * http, https, mailto and tel links, a site path ("/rate") or an anchor
 * ("#lai-suat"). Never javascript:, data:, a protocol-relative "//host" or
 * anything with whitespace hidden in it.
 */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string" || !href || href.length > MAX_HREF) return false;
  if (UNSAFE_CHARACTERS.test(href)) return false;
  if (href.startsWith("#")) return true;
  if (href.startsWith("/")) return !href.startsWith("//");
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (!LINK_SCHEMES.has(url.protocol)) return false;
  if ((url.protocol === "http:" || url.protocol === "https:") && !url.host) {
    return false;
  }
  return true;
}

/** True for a link that leaves fundlok.com (or the site it is served from). */
export function isExternalHref(href: string, siteUrl: string): boolean {
  if (href.startsWith("/") || href.startsWith("#")) return false;
  try {
    return new URL(href).host !== new URL(siteUrl).host;
  } catch {
    return true;
  }
}

/**
 * Where uploaded blog images are served: the public R2 bucket's custom
 * domain. An ORIGIN (scheme + host + optional port), no path: it feeds the
 * CSP's img-src and next.config.ts's images.remotePatterns.
 *
 * Locally the backend's R2_PUBLIC_BASE_URL is MinIO
 * (http://localhost:9000/fundlok-public); set this to http://localhost:9000.
 */
export const BLOG_MEDIA_ORIGIN = mediaOrigin(
  process.env.NEXT_PUBLIC_BLOG_MEDIA_ORIGIN,
);

function mediaOrigin(raw: string | undefined): string {
  const fallback = "https://media.fundlok.com";
  if (!raw) return fallback;
  try {
    return new URL(raw).origin;
  } catch {
    return fallback;
  }
}

/** An http(s) URL, the only kind a post's <img src> may point at. */
export function isSafeImageSrc(src: unknown): src is string {
  if (typeof src !== "string" || !src || UNSAFE_CHARACTERS.test(src)) {
    return false;
  }
  try {
    const url = new URL(src);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** True when `src` is served from the blog media host. */
export function isBlogMediaUrl(src: unknown): src is string {
  if (!isSafeImageSrc(src)) return false;
  return new URL(src).origin === BLOG_MEDIA_ORIGIN;
}
