import type { Metadata } from "next";

import {
  localeAlternates,
  OG_LOCALE,
  pageLocale,
  seoStringsFor,
  type LangParams,
} from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { achievementsData } from "./achievements-data";
import WhyUsClient from "./why-us-client";
import SiteFooter from "@/components/site-footer";

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
  const { locale, seo } = seoStringsFor(await pageLocale(params));
  const title = seo.whyUsTitle;
  const description = seo.whyUsDescription;

  return {
    // absolute: whyUsTitle already carries the brand; the root template would
    // otherwise append a second "| FundLok".
    title: { absolute: title },
    description,
    keywords: [
      "FundLok vision",
      "FundLok achievements",
      "FundLok awards",
      "FundLok recognitions",
      "SME story",
      "flexible capital solutions",
      "investor transparency",
      "daily repayment",
      "progressive repayment",
      "revenue-based financing",
      "reference business score",
      "verified data financing",
      "Sustainability in Action 2024",
      "Australian Government",
      "SIHUB 2025",
      "Startup and Innovation Hub Ho Chi Minh City",
      "International Blockchain Olympiad 2023",
      "IBCOL 2023",
      "LENDMI",
    ],
    alternates: localeAlternates("/why-us", locale),
    openGraph: {
      title,
      description,
      url: localeAlternates("/why-us", locale).canonical,
      siteName: "FundLok",
      type: "website",
      locale: OG_LOCALE[locale],
    },
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
  };
}

// Structured data for FundLok's recognitions. Uses ItemList (each award as a
// CreativeWork) plus an Organization node whose `award` list links back to the
// main entity via the shared @id declared in the root layout, so Google can
// attribute these recognitions to FundLok.
export default async function WhyUsPage({ params }: { params: LangParams }) {
  const locale = await pageLocale(params);
  const achievements = achievementsData[locale];
  const achievementsJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}#organization`,
        name: "FundLok",
        url: SITE_URL,
        award: achievements.map((a) => `${a.title} — ${a.subtitle}`),
      },
      {
        "@type": "ItemList",
        name:
          locale === "vi" ? "Thành tựu của FundLok" : "FundLok’s Achievements",
        itemListElement: achievements.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "CreativeWork",
            name: a.title,
            description: a.description,
            award: `${a.title} — ${a.subtitle}`,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        id="achievements-schema"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(achievementsJsonLd) }}
      />
      <WhyUsClient footer={<SiteFooter locale={locale} />} />
    </>
  );
}
