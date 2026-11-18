"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStanding, useUnlockStanding } from "@/hooks/use-funding";
import { formatCurrency } from "@/lib/format-currency";
import { formatDateTimeIct } from "@/lib/format-date";
import type { TopUpPledge } from "@/services/funding.service";

const K = "investConfirm.standing";

// Unlock failures the investor can act on, by X-Error-Code.
const KNOWN_ERRORS = new Set([
  "EKYC_REQUIRED",
  "ACKNOWLEDGEMENT_MISMATCH",
  "NOT_LOCKED",
  "LENDER_CLOSED",
]);

interface LenderStandingCardProps {
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function PledgeRow({
  pledge,
  locale,
  t,
}: {
  pledge: TopUpPledge;
  locale: string;
  t: LenderStandingCardProps["t"];
}) {
  const statusKey = `${K}.pledgeStatus.${pledge.status}`;
  const status = t(statusKey);
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-xs">
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold text-foreground">
          {pledge.listing_title ?? t(`${K}.pledgeUntitled`)}
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
}

/**
 * After disbursement day (Day-14 transfer rule, Contract 4 Art. 5.4): a lender
 * who did not pay on time is locked at 15:00. Money that came late is not
 * returned; it is recorded as their top-up. To unlock they verify their
 * identity again, then type the undertaking sentence. Shown in place of the
 * reservation while the lender is locked; nothing when they are not.
 */
export function LenderStandingCard({ locale, t }: LenderStandingCardProps) {
  const standing = useStanding();
  const unlock = useUnlockStanding();
  const [typed, setTyped] = useState("");

  const view = standing.data;
  if (!view || view.status === "GOOD") return null;

  const needsEkyc = view.unlock_requires.includes("EKYC");
  const closed = view.status === "CLOSED";
  const errorCode = unlock.error?.code ?? "";
  const errorText = unlock.error
    ? KNOWN_ERRORS.has(errorCode)
      ? t(`${K}.errors.${errorCode}`)
      : t(`${K}.errors.generic`)
    : null;

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
        <ol className="space-y-3 pl-8 text-xs">
          <li className="space-y-1">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              {!needsEkyc && (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
              {t(`${K}.stepEkyc`)}
            </p>
            {needsEkyc ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/kyc">{t(`${K}.ekycAction`)}</Link>
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
            <textarea
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              rows={3}
              aria-label={t(`${K}.sentenceLabel`)}
              disabled={needsEkyc || unlock.isPending}
              className="w-full rounded-md border bg-background p-2 text-xs text-foreground disabled:opacity-50"
            />
            <Button
              type="button"
              size="sm"
              disabled={needsEkyc || !typed.trim() || unlock.isPending}
              onClick={() => unlock.mutate(typed)}
              className="gap-2"
            >
              {unlock.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t(`${K}.unlock`)}
            </Button>
            {errorText && (
              <p role="alert" className="text-destructive">
                {errorText}
              </p>
            )}
          </li>
        </ol>
      )}

      {view.top_up_pledges.length > 0 && (
        <div className="space-y-1 pl-8">
          <p className="text-xs font-semibold text-foreground">
            {t(`${K}.pledgesTitle`)}
          </p>
          <ul className="divide-y" data-testid="standing-pledges">
            {view.top_up_pledges.map((pledge) => (
              <PledgeRow
                key={pledge.id}
                pledge={pledge}
                locale={locale}
                t={t}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
