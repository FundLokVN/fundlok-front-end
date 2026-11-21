/**
 * Vietnamese-aware slugs, for post URLs (/blog/<slug>) and heading ids.
 *
 * Mirrors `slugify` in the backend's app/blog/validation.py character for
 * character, so a slug typed here and one the backend generates from the same
 * title agree: "Lãi suất vay vốn 2026" → "lai-suat-vay-von-2026".
 *
 * WHY "đ" IS REPLACED BY HAND
 * Unicode has no decomposition for đ/Đ (it is a letter of its own, not d plus
 * a mark), so stripping combining marks leaves it in place and the ASCII
 * filter would then drop it: "đầu tư" would become "au-tu".
 *
 * WHY NO DOTS
 * proxy.ts's matcher skips every path containing a "." (it treats it as a
 * file), so /blog/v1.2 would get no CSP and no rewrite to its prerendered
 * build. The pattern below has no room for one.
 */

export const SLUG_MAX_LENGTH = 80;

/** Same pattern as the backend's SLUG_PATTERN and its CHECK constraint. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(text: string, maxLength = SLUG_MAX_LENGTH): string {
  const ascii = text
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
  let slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > maxLength) {
    let cut = slug.slice(0, maxLength);
    // Prefer ending on a whole word, as the backend does.
    if (slug[maxLength] !== "-" && cut.includes("-")) {
      cut = cut.slice(0, cut.lastIndexOf("-"));
    }
    slug = cut.replace(/^-+|-+$/g, "");
  }
  return slug;
}

export function isValidSlug(slug: string): boolean {
  return slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}
