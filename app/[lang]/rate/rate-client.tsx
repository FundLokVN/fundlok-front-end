"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { m } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";
import SiteHeader from "@/components/site-header";
import { BackgroundBlobs } from "@/components/background-blobs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The public rate page.
 *
 * SME TAB
 * A five-question quiz that shows an ILLUSTRATIVE rate, computed in the
 * browser from a short published formula (lib/rate-quiz.ts). It is not the
 * underwriting engine and is never carried into an application. Name and
 * phone are asked on the same screen as the result and saved to the admin
 * "Rate inquiries" list. Spec: backend repo docs/specs/rates/sme-rate-quiz.md.
 *
 * INVESTOR TAB
 * Unchanged: the target-yield estimate computed on the server
 * (investor-panel.tsx).
 *
 * WHAT IT MAY SAY
 * An illustration with a not-an-offer line. Anything here that reads as a
 * quote is a compliance defect, not a copy preference.
 */

function ResultSkeleton() {
  const bar = "bg-muted";
  return (
    <div aria-hidden className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className={cn("h-6 w-40", bar)} />
        <Skeleton className={cn("h-5 w-24", bar)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className={cn("h-3 w-24", bar)} />
            <Skeleton className={cn("h-8 w-32", bar)} />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Skeleton className={cn("h-3 w-full", bar)} />
        <Skeleton className={cn("h-3 w-4/5", bar)} />
      </div>

      <div className="space-y-2 border-t border-border/60 pt-3">
        <Skeleton className={cn("h-3 w-36", bar)} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={cn("h-3 w-full", bar)} />
        ))}
      </div>
    </div>
  );
}

const InvestorPanel = dynamic(
  () => import("./investor-panel").then((mod) => mod.InvestorPanel),
  {
    ssr: false,
    loading: () => <ResultSkeleton />,
  },
);

// Client-only, like the investor panel: the quiz restores its answers from
// sessionStorage on first render, which must not run on the server.
const SmeQuiz = dynamic(
  () => import("./_components/sme-quiz/SmeQuiz").then((mod) => mod.SmeQuiz),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-card p-8">
        <ResultSkeleton />
      </div>
    ),
  },
);

function getClientSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.sessionStorage.getItem("fundlok_rate_session");
    if (!id) {
      id =
        "sess_" +
        Math.random().toString(36).substring(2, 10) +
        "_" +
        Date.now().toString(36);
      window.sessionStorage.setItem("fundlok_rate_session", id);
    }
    return id;
  } catch {
    return "";
  }
}

type Audience = "sme" | "investor";

// /rate?for=investor opens the investor tab. The page is prerendered, so the
// query is unknown on the server: hydrate as "sme", then read it from the URL.
// Not useSearchParams(): in a static page that bails the whole calculator out
// of the prerendered HTML.
const noSubscribe = () => () => {};
const linkedToInvestor = () =>
  new URLSearchParams(window.location.search).get("for") === "investor";

export default function RateClient({ footer }: { footer: React.ReactNode }) {
  const linkedInvestor = useSyncExternalStore(
    noSubscribe,
    linkedToInvestor,
    () => false,
  );
  // The tab the visitor picked; until they pick one, the link decides.
  const [chosen, setAudience] = useState<Audience | null>(null);
  const audience: Audience = chosen ?? (linkedInvestor ? "investor" : "sme");
  // Mounted on first visit, then kept (hidden) so switching back and forth
  // keeps what the visitor typed, the lead, and the live estimate.
  const [investorVisited, setInvestorMounted] = useState(false);
  const investorMounted = investorVisited || audience === "investor";
  const switchAudience = (next: Audience) => {
    setAudience(next);
    // Also when leaving it: a tab opened by the link was never "chosen", and
    // must stay mounted like one that was.
    if (next === "investor" || audience === "investor") {
      setInvestorMounted(true);
    }
    // Shareable and back-button friendly without a navigation: the tab is
    // presentation state, so replaceState rather than a router push.
    const url = new URL(window.location.href);
    if (next === "investor") url.searchParams.set("for", "investor");
    else url.searchParams.delete("for");
    window.history.replaceState(null, "", url);
  };

  const { t } = useTranslations();

  return (
    <div className="relative min-h-[100dvh] w-full bg-background text-foreground overflow-x-clip">
      <SiteHeader />
      <BackgroundBlobs variant="compact" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        {/* Entrance motion matches the other public pages (see faq-client):
            the hero drops in, then the two panels rise with a short cascade so
            the eye lands on the form first. The panels animate individually
            rather than under a shared parent — a transformed ancestor would
            become the containing block for the result card's `lg:sticky` and
            silently kill it. */}
        <m.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          className="mb-10 space-y-3 text-center"
        >
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
            {t("ratePage.title")}
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            {audience === "investor"
              ? t("ratePage.investor.subtitle")
              : t("ratePage.subtitle")}
          </p>
        </m.div>

        {/* Who is this for. Large and first on purpose: the two panels answer
            different questions, and a visitor on the wrong one reads a
            borrowing form as an investment page. */}
        <m.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT }}
          className="mx-auto mb-10 max-w-md space-y-2"
        >
          <p
            id="rate-audience-label"
            className="text-center text-xs font-medium text-muted-foreground"
          >
            {t("ratePage.audience.label")}
          </p>
          <div
            role="tablist"
            aria-labelledby="rate-audience-label"
            className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-xs"
          >
            {(["sme", "investor"] as const).map((option) => {
              const active = audience === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  id={`rate-tab-${option}`}
                  aria-selected={active}
                  aria-controls={`rate-panel-${option}`}
                  onClick={() => switchAudience(option)}
                  className={cn(
                    "rounded-lg px-4 py-3 text-left transition-colors active:scale-[0.98]",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <span className="block text-sm font-bold">
                    {t(`ratePage.audience.${option}`)}
                  </span>
                  <span
                    className={cn(
                      "block text-xs",
                      active
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {t(`ratePage.audience.${option}Hint`)}
                  </span>
                </button>
              );
            })}
          </div>
        </m.div>

        {investorMounted && (
          <div
            id="rate-panel-investor"
            role="tabpanel"
            aria-labelledby="rate-tab-investor"
            hidden={audience !== "investor"}
          >
            <InvestorPanel getSessionId={getClientSessionId} />
          </div>
        )}

        {/* Hidden rather than unmounted: its Turnstile widget renders once, on
            mount, and the visitor's figures should survive a tab switch. A
            plain wrapper, not a motion one, so `lg:sticky` inside still works. */}
        <div
          id="rate-panel-sme"
          role="tabpanel"
          aria-labelledby="rate-tab-sme"
          hidden={audience !== "sme"}
        >
          <SmeQuiz getSessionId={getClientSessionId} />
        </div>

        {/* FAQ for both audiences — common SME questions around the rate and
            funding, rendered from the same strings the FAQPage JSON-LD on this
            page carries (see app/rate/page.tsx). */}
        <m.section
          aria-labelledby="rate-faq-heading"
          className="mx-auto mt-16 w-full max-w-3xl scroll-mt-28"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: EASE_OUT }}
        >
          <h2
            id="rate-faq-heading"
            className="mb-2 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl"
          >
            {t("seo.rateFaqTitle")}
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {[1, 2, 3].map((n) => (
              <AccordionItem
                key={n}
                value={`rate-faq-${n}`}
                className="border-foreground/15"
              >
                <AccordionTrigger className="text-left text-sm font-semibold md:text-base">
                  {t(`seo.rateFaqQ${n}`)}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {t(`seo.rateFaqA${n}`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </m.section>
      </div>

      {/* Server-rendered by page.tsx: see components/site-footer.tsx. */}
      {footer}
    </div>
  );
}
