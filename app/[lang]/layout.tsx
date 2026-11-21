import type { Metadata } from "next";
import { notFound } from "next/navigation";

import "../globals.css";
import { RootDocument, rootMetadata } from "@/components/root-document";
import { MARKETING_LOCALES } from "@/lib/locale-routing";
import { pageLocale, seoStringsFor, type LangParams } from "@/lib/seo";

/**
 * Root layout for the marketing pages, prerendered at build time for each
 * language: /vi/... (served at the unprefixed URLs, which proxy.ts rewrites
 * here) and /en/....
 *
 * NOTHING UNDER THIS LAYOUT MAY READ cookies(), headers() or searchParams. Any
 * one of them turns every page here back into a per-request render, and the
 * CDN can no longer serve them or `next/link` prefetch them whole. Per-visitor
 * state (appearance, session, ?for=) is picked up in the browser instead.
 *
 * Because these pages are built once, they carry no CSP nonce; proxy.ts gives
 * them the fixed policy from lib/csp.ts instead.
 */

export function generateStaticParams() {
  return MARKETING_LOCALES.map((lang) => ({ lang }));
}

// /fr, /anything: not a language. Each page exports `dynamicParams = false`
// for that, rather than this layout: Next applies the strictest value of every
// segment to the whole route, and the blog's posts need request-time params.
// The check in the layout below catches what reaches a page that allows them.
function isMarketingLocale(
  lang: string,
): lang is (typeof MARKETING_LOCALES)[number] {
  return (MARKETING_LOCALES as readonly string[]).includes(lang);
}

export async function generateMetadata({
  params,
}: {
  params: LangParams;
}): Promise<Metadata> {
  const { locale, seo } = seoStringsFor(await pageLocale(params));
  return rootMetadata(locale, seo);
}

export default async function MarketingRootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: LangParams;
}>) {
  if (!isMarketingLocale((await params).lang)) notFound();
  const { locale, seo } = seoStringsFor(await pageLocale(params));
  return (
    <RootDocument locale={locale} seo={seo}>
      {children}
    </RootDocument>
  );
}
