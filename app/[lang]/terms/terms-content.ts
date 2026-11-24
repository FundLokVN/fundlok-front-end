import type { SeoLocale } from "@/lib/seo";
import {
  TERMS_ARTICLES,
  TERMS_PREFACE,
  TERMS_TICK_BOXES,
  TERMS_TICK_BOXES_INTRO,
  type Bilingual,
} from "@/lib/legal/terms";

/**
 * The /terms page: Contract 1, "Điều khoản Dịch vụ và Đồng ý xử lý dữ liệu /
 * Terms & Services and Data Consent". The text lives in lib/legal/terms.ts,
 * the same copy the sign-up gate (/consent) asks every user to accept, so the
 * two can never say different things.
 *
 * Read on the server only (page.tsx), which hands TermsClient the one language
 * the page is in: the full text of both is the bulk of this page, and as part
 * of the client component it was downloaded, parsed and hydrated on every
 * visit, the language nobody was reading included.
 */

/** One section of the terms in a single language, as TermsClient renders it. */
export interface TermsSection {
  id: string;
  badge: string;
  title: string;
  items: { heading?: string; content: string[] }[];
}

export function termsPrefaceFor(locale: SeoLocale): string[] {
  return TERMS_PREFACE.map((line) => line[locale === "vi" ? "vi" : "en"]);
}

export function termsSectionsFor(locale: SeoLocale): TermsSection[] {
  const pick = (text: Bilingual) => (locale === "vi" ? text.vi : text.en);
  const articles = TERMS_ARTICLES.map((article) => ({
    id: article.id,
    badge: pick(article.badge),
    title: pick(article.title),
    items: article.clauses.map((clause) => ({
      heading: clause.heading && pick(clause.heading),
      content: clause.paragraphs.map(pick),
    })),
  }));
  // The tick boxes, listed after the articles exactly as /consent shows them.
  const atSignUp: TermsSection = {
    id: "at-sign-up",
    badge: locale === "vi" ? "Khi đăng ký" : "At sign-up",
    title:
      locale === "vi"
        ? "Những điều bạn xác nhận khi đăng ký"
        : "What you confirm when you register",
    items: [
      {
        content: [
          pick(TERMS_TICK_BOXES_INTRO),
          ...Object.values(TERMS_TICK_BOXES).map(pick),
        ],
      },
    ],
  };
  return [...articles, atSignUp];
}
