import type { Metadata } from "next";

import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { createServerTranslator } from "@/lib/i18n/server";
import { VIETQR_PATH } from "@/lib/locale-routing";
import {
  localeAlternates,
  OG_LOCALE,
  pageLocale,
  type LangParams,
} from "@/lib/seo";
import VietQrGenerator from "./generator";

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: LangParams;
}): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = createServerTranslator(locale);
  const title = t("vietqrPage.title");
  const description = t("vietqrPage.description");
  const alternates = localeAlternates(VIETQR_PATH, locale);
  return {
    title,
    description,
    keywords: [
      locale === "vi" ? title.toLocaleLowerCase("vi") : "free VietQR generator",
    ],
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      type: "website",
      siteName: "FundLok",
      locale: OG_LOCALE[locale],
    },
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function VietQrPage({ params }: { params: LangParams }) {
  const locale = await pageLocale(params);
  const t = createServerTranslator(locale);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-6 sm:py-14">
        <header className="mb-7 max-w-3xl sm:mb-9">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("vietqrPage.title")}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {t("vietqrPage.description")}
          </p>
        </header>
        <VietQrGenerator />
        <section className="mt-9 max-w-2xl space-y-2">
          <h2 className="text-lg font-semibold">{t("vietqrPage.howTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("vietqrPage.howBody")}
          </p>
        </section>
      </div>
      <SiteFooter locale={locale} />
    </div>
  );
}
