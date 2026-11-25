"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStanding, useUnlockStanding } from "@/hooks/use-funding";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format-currency";
import { formatDateTimeIct } from "@/lib/format-date";
import type { TopUpPledge } from "@/services/funding.service";

const K = "investConfirm.standing";

// eKYC again, after the lock (Contract 4 Art. 5.4). `reverify` lets an already
// verified investor through /kyc (proxy.ts, GVerifyKycClient); `next` brings
// them back to this card.
export const REVERIFY_HREF = "/kyc?reverify=1&next=%2Fdashboard%2Finvest";

// Unlock failures the investor can act on, by X-Error-Code.
const KNOWN_ERRORS = new Set([
  "EKYC_REQUIRED",
  "ACKNOWLEDGEMENT_MISMATCH",
  "NOT_LOCKED",
  "LENDER_CLOSED",
]);
// Answers that mean the card shows a stale standing: read it again.
const STALE_ERRORS = new Set(["EKYC_REQUIRED", "NOT_LOCKED", "LENDER_CLOSED"]);

interface LenderStandingCardProps {
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function PledgeList({
  pledges,
  locale,
  t,
}: {
  pledges: TopUpPledge[];
  locale: string;
  t: LenderStandingCardProps["t"];
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-foreground">
        {t(`${K}.pledgesTitle`)}
      </p>
      <ul className="divide-y" data-testid="standing-pledges">
        {pledges.map((pledge) => {
          const statusKey = `${K}.pledgeStatus.${pledge.status}`;
          const status = t(statusKey);
          return (
            <li
              key={pledge.id}
              className="flex items-start justify-between gap-3 py-2.5 text-xs"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold text-foreground">
                  {pledge.listing_title || t(`${K}.pledgeUntitled`)}
                </p>
                <p className="text-muted-foreground">
                  {status === statusKey ? t(`${K}.pledgeStatus.other`) : status}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {formatCurrency(pledge.amount_vnd, locale)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * After disbursement day (Day-14 transfer rule, Contract 4 Art. 5.4): a lender
 * who did not pay on time is locked at 15:00. Pending late transfers are
 * recorded for manual follow-up. To unlock they verify their
 * identity again, then type the undertaking sentence.
 *
 * Locked or closed: the whole card, in place of reserving. In good standing
 * with top-ups on record: just the top-ups. Otherwise nothing.
 */
export function LenderStandingCard({ locale, t }: LenderStandingCardProps) {
  const standing = useStanding();
  const unlock = useUnlockStanding();
  const { toast } = useToast();
  const [typed, setTyped] = useState("");

  const view = standing.data;
  if (!view) return null;
  const pledges = view.top_up_pledges;

  if (view.status === "GOOD") {
    if (pledges.length === 0) return null;
    return (
      <section
        className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm"
        aria-label={t(`${K}.pledgesTitle`)}
        data-testid="standing-top-ups"
      >
        <div className="flex items-start gap-3">
          <ReceiptText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <PledgeList pledges={pledges} locale={locale} t={t} />
          </div>
        </div>
      </section>
    );
  }

  const needsEkyc = view.unlock_requires.includes("EKYC");
  const closed = view.status === "CLOSED";
  const errorCode = unlock.error?.code ?? "";
  const errorText = unlock.error
    ? KNOWN_ERRORS.has(errorCode)
      ? t(`${K}.errors.${errorCode}`)
      : t(`${K}.errors.generic`)
    : null;

  const submit = () =>
    unlock.mutate(typed, {
      onSuccess: () => toast({ title: t(`${K}.unlocked`) }),
      onError: (error) => {
        if (STALE_ERRORS.has(error.code ?? "")) void standing.refetch();
      },
    });

  return (
    <section
      className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
      aria-labelledby="standing-title"
      data-testid="lender-standing"
    >
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1">
          <h2 id="standing-title" className="font-semibold text-foreground">
            {t(closed ? `${K}.closedTitle` : `${K}.lockedTitle`)}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {closed
              ? t(`${K}.closedBody`)
              : t(`${K}.lockedBody`, {
                  time: view.locked_at
                    ? formatDateTimeIct(view.locked_at, locale)
                    : "",
                })}
          </p>
        </div>
      </div>

      {!closed && (
        <ol className="list-decimal space-y-3 pl-12 text-xs marker:font-semibold">
          <li className="space-y-1">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              {t(`${K}.stepEkyc`)}
              {!needsEkyc && (
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              )}
            </p>
            {needsEkyc ? (
              <Button asChild size="sm" variant="outline">
                <Link href={REVERIFY_HREF}>{t(`${K}.ekycAction`)}</Link>
              </Button>
            ) : (
              <p className="text-muted-foreground">{t(`${K}.ekycDone`)}</p>
            )}
          </li>
          <li className="space-y-2">
            <p className="font-semibold text-foreground">
              {t(`${K}.stepSentence`)}
            </p>
            {view.acknowledgement_sentence && (
              <blockquote
                className="rounded-md border bg-background/60 p-2 italic text-foreground"
                data-testid="standing-sentence"
              >
                {view.acknowledgement_sentence}
              </blockquote>
            )}
            {needsEkyc && (
              <p id="standing-ekyc-first" className="text-muted-foreground">
                {t(`${K}.ekycFirst`)}
              </p>
            )}
            <textarea
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              rows={3}
              aria-label={t(`${K}.sentenceLabel`)}
              aria-invalid={errorCode === "ACKNOWLEDGEMENT_MISMATCH"}
              aria-describedby={
                [
                  needsEkyc ? "standing-ekyc-first" : null,
                  errorText ? "standing-unlock-error" : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              disabled={needsEkyc || unlock.isPending}
              className="w-full rounded-md border bg-background p-2 text-xs text-foreground disabled:opacity-50"
            />
            <Button
              type="button"
              size="sm"
              disabled={needsEkyc || !typed.trim() || unlock.isPending}
              onClick={submit}
              className="gap-2"
            >
              {unlock.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t(`${K}.unlock`)}
            </Button>
            {errorText && (
              <p
                id="standing-unlock-error"
                role="alert"
                className="text-destructive"
              >
                {errorText}
              </p>
            )}
          </li>
        </ol>
      )}

      {pledges.length > 0 && (
        <div className="pl-8">
          <PledgeList pledges={pledges} locale={locale} t={t} />
        </div>
      )}
    </section>
  );
}
