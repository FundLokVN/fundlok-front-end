import type { Metadata } from "next";
import { TermsClient } from "./terms-client";
import { termsPrefaceFor, termsSectionsFor } from "./terms-content";
import SiteFooter from "@/components/site-footer";
import { SITE_URL } from "@/lib/site";
import { createServerTranslator } from "@/lib/i18n/server";
import {
  localeAlternates,
  OG_LOCALE,
  pageLocale,
  type LangParams,
} from "@/lib/seo";

// /fr/..., /anything/...: not a language, so a 404 rather than a third build.
// Set per page, not on app/[lang]/layout.tsx: Next applies the strictest value
// of every segment to the whole route, which would also 404 the blog's posts,
// whose slugs are only known at request time.
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: LangParams;
}): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = createServerTranslator(locale);
  // termsTitle carries the full rendered title including the brand suffix, so
  // `absolute` keeps the root template from appending a second "| FundLok".
  const title = t("seo.termsTitle");
  const description = t("seo.termsDescription");

  return {
    title: { absolute: title },
    description,
    keywords: [
      "FundLok terms",
      "FundLok terms of service",
      "điều khoản dịch vụ FundLok",
      "điều khoản và điều kiện",
      "chính sách bảo mật",
      "SME credit platform terms",
      "private credit terms Vietnam",
    ],
    alternates: localeAlternates("/terms", locale),
    openGraph: {
      title,
      description,
      url: localeAlternates("/terms", locale).canonical,
      siteName: "FundLok",
      type: "website",
      locale: OG_LOCALE[locale],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

const termsJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "FundLok Terms & Services and Data Consent",
  description:
    "Terms & Services and Data Consent (version 1.0) governing the FundLok platform.",
  url: `${SITE_URL}/terms`,
  publisher: {
    "@type": "Organization",
    name: "FundLok",
    url: SITE_URL,
    email: "support@fundlok.com",
  },
};

export default async function TermsPage({ params }: { params: LangParams }) {
  const locale = await pageLocale(params);
  return (
    <>
      <script
        type="application/ld+json"
        id="terms-jsonld"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(termsJsonLd) }}
      />
      <TermsClient
        preface={termsPrefaceFor(locale)}
        sections={termsSectionsFor(locale)}
        footer={<SiteFooter locale={locale} />}
      />
    </>
  );
}
