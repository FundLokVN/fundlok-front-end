"use client";

import { useState } from "react";
import { CalendarClock, HandCoins, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  useCommit,
  useMyCommitments,
  useWithdrawCommitment,
} from "@/hooks/use-funding";
import { usePaymentAccounts } from "@/hooks/use-payment-accounts";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format-currency";
import { formatDateTime } from "@/lib/format-date";
import {
  INVESTOR_TERMS_VERSION,
  type Commitment,
  type FundingWindow,
} from "@/services/funding.service";

const K = "investConfirm.pledge";

// Refusals with their own sentence, by X-Error-Code.
const KNOWN_ERRORS = new Set([
  "WINDOW_FULL",
  "WINDOW_NOT_OPEN",
  "BELOW_MIN_TICKET",
  "CAPACITY_EXCEEDED",
  "LENDER_LOCKED",
  "LENDER_CLOSED",
  "INVESTOR_FEE_UNPAID",
  "TERMS_OUTDATED",
  "ACCOUNT_NOT_APPROVED",
  "WITHDRAW_CLOSED",
  "COMMITMENT_NOT_PLEDGED",
]);

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

/** Days 0 to 14 of a commit-then-accept round, in the investor's words. */
export function RoundTimeline({
  fundingWindow,
  locale,
  t,
}: {
  fundingWindow: FundingWindow;
  locale: string;
  t: Translate;
}) {
  const at = (iso?: string | null) => (iso ? formatDateTime(iso, locale) : "—");
  return (
    <section
      className="space-y-2 rounded-xl border bg-muted/20 p-4 text-sm"
      aria-labelledby="round-timeline-title"
      data-testid="round-timeline"
    >
      <h3
        id="round-timeline-title"
        className="flex items-center gap-2 font-bold text-foreground"
      >
        <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t(`${K}.timelineTitle`)}
      </h3>
      <ol className="space-y-1 text-xs leading-relaxed text-muted-foreground">
        <li>
          {t(`${K}.timeline.pledges`, {
            time: at(fundingWindow.commit_closes_at),
          })}
        </li>
        <li>
          {t(`${K}.timeline.decision`, {
            time: at(fundingWindow.sme_deadline_at),
          })}
        </li>
        <li>
          {t(`${K}.timeline.sign`, { time: at(fundingWindow.pay_deadline_at) })}
        </li>
      </ol>
    </section>
  );
}

/**
 * Investing in a commit-then-accept round (Money flow FINAL v1.0). Days 0 to
 * 12: the investor pledges by pressing Confirm; nothing is signed and no money
 * moves, and a pledge can be withdrawn until the end of Day 12. Day 13: the
 * business accepts or declines. Day 14: the investor signs one loan contract
 * for their total with a Zalo code and pays (the `day14` slot).
 */
export function CommitThenAccept({
  fundingWindow,
  amount,
  businessName,
  day14,
  locale,
  t,
}: {
  fundingWindow: FundingWindow;
  /** Chosen on the project page (?amount=). */
  amount: number;
  businessName: string;
  /** What Day 14 shows once the business accepted (the signing step). */
  day14?: React.ReactNode;
  locale: string;
  t: Translate;
}) {
  const { toast } = useToast();
  const pledges = useMyCommitments(fundingWindow.id);
  const commit = useCommit();
  const withdraw = useWithdrawCommitment();
  const accounts = usePaymentAccounts();
  const account = (accounts.data ?? []).find((a) => a.status === "APPROVED");
  const [agreed, setAgreed] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const committed = fundingWindow.committed_total_vnd ?? 0;
  const left = Math.max(0, fundingWindow.target_vnd - committed);
  const full = left === 0;
  const inBounds =
    amount > 0 &&
    amount <= left &&
    (amount >= fundingWindow.min_ticket_vnd || amount === left);
  const mine = pledges.data ?? [];
  const myTotal = mine.find((c) => c.status === "PLEDGED")
    ? mine[0].my_committed_total_vnd
    : 0;

  const fail = (code: string | undefined, title: string) => {
    const message = t(
      `${K}.errors.${KNOWN_ERRORS.has(code ?? "") ? code : "generic"}`,
    );
    setError(message);
    toast({ variant: "destructive", title, description: message });
  };

  const pledge = () => {
    if (!account) return;
    setError(null);
    commit.mutate(
      {
        windowId: fundingWindow.id,
        idempotencyKey: key,
        body: {
          amount_vnd: amount,
          ack_risk_disclosure: true,
          terms_version: INVESTOR_TERMS_VERSION,
          payment_account_id: account.id,
        },
      },
      {
        onSuccess: () => {
          setAgreed(false);
          setKey(crypto.randomUUID()); // the next pledge is a new one
          toast({ title: t(`${K}.pledged`) });
        },
        onError: (failure) => fail(failure.code, t(`${K}.pledgeFailed`)),
      },
    );
  };

  const status = fundingWindow.status;
  let phase: React.ReactNode = null;
  if (status === "OPEN") {
    phase = full ? (
      <Info title={t(`${K}.fullTitle`)} body={t(`${K}.fullBody`)} />
    ) : !inBounds ? (
      <Info
        title={t(`${K}.amountTitle`)}
        body={t(`${K}.amountBody`, {
          min: formatCurrency(fundingWindow.min_ticket_vnd, locale),
          left: formatCurrency(left, locale),
        })}
      />
    ) : (
      <section
        className="space-y-4 rounded-xl border p-4"
        aria-labelledby="pledge-title"
        data-testid="pledge-form"
      >
        <h3
          id="pledge-title"
          className="flex items-center gap-2 text-base font-bold text-foreground"
        >
          <HandCoins className="h-5 w-5 text-muted-foreground" aria-hidden />
          {t(`${K}.title`)}
        </h3>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            {t(`${K}.rules.noMoney`, {
              amount: formatCurrency(amount, locale),
              business: businessName,
            })}
          </li>
          <li>{t(`${K}.rules.withdraw`)}</li>
          <li>{t(`${K}.rules.decision`)}</li>
          <li>{t(`${K}.rules.day14`)}</li>
          <li>{t(`${K}.rules.risk`)}</li>
        </ul>
        <div className="flex items-start gap-3">
          <Checkbox
            id="pledge-agree"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            disabled={commit.isPending}
            className="mt-0.5"
          />
          <Label
            htmlFor="pledge-agree"
            className="text-sm font-medium leading-relaxed text-foreground"
          >
            {t(`${K}.agree`)}
          </Label>
        </div>
        <Button
          type="button"
          className="h-11 w-full gap-2 font-semibold"
          disabled={!agreed || !account || commit.isPending}
          onClick={pledge}
          data-testid="pledge-confirm"
        >
          {commit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t(`${K}.confirm`, { amount: formatCurrency(amount, locale) })}
        </Button>
        {!account && !accounts.isLoading && (
          <p className="text-xs text-destructive">{t(`${K}.noAccount`)}</p>
        )}
      </section>
    );
  } else if (status === "AWAITING_SME") {
    phase = (
      <Info
        title={t(`${K}.awaitingSmeTitle`)}
        body={t(`${K}.awaitingSmeBody`, {
          business: businessName,
          time: fundingWindow.sme_deadline_at
            ? formatDateTime(fundingWindow.sme_deadline_at, locale)
            : "—",
        })}
      />
    );
  } else if (status === "AWAITING_PAYMENT") {
    phase = day14 ?? (
      <Info
        title={t(`${K}.acceptedTitle`)}
        body={t(`${K}.acceptedBody`, {
          time: fundingWindow.pay_deadline_at
            ? formatDateTime(fundingWindow.pay_deadline_at, locale)
            : "—",
        })}
      />
    );
  } else if (status === "FAILED" || status === "CANCELLED") {
    phase = (
      <Info title={t(`${K}.declinedTitle`)} body={t(`${K}.declinedBody`)} />
    );
  }

  return (
    <div className="space-y-5" data-testid="commit-then-accept">
      <RoundTimeline fundingWindow={fundingWindow} locale={locale} t={t} />
      {phase}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {mine.length > 0 && (
        <PledgeList
          pledges={mine}
          total={myTotal}
          canWithdraw={status === "OPEN"}
          withdrawing={withdraw.isPending ? withdraw.variables : undefined}
          onWithdraw={(id) => {
            setError(null);
            withdraw.mutate(id, {
              onSuccess: () => toast({ title: t(`${K}.withdrawn`) }),
              onError: (failure) =>
                fail(failure.code, t(`${K}.withdrawFailed`)),
            });
          }}
          locale={locale}
          t={t}
        />
      )}
    </div>
  );
}

function PledgeList({
  pledges,
  total,
  canWithdraw,
  withdrawing,
  onWithdraw,
  locale,
  t,
}: {
  pledges: Commitment[];
  total: number;
  canWithdraw: boolean;
  withdrawing?: string;
  onWithdraw: (id: string) => void;
  locale: string;
  t: Translate;
}) {
  return (
    <section
      className="space-y-2 rounded-xl border p-4"
      aria-labelledby="my-pledges-title"
      data-testid="my-pledges"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="my-pledges-title" className="text-sm font-bold text-foreground">
          {t(`${K}.mineTitle`)}
        </h3>
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {t(`${K}.mineTotal`, { amount: formatCurrency(total, locale) })}
        </span>
      </div>
      <ul className="divide-y text-sm">
        {pledges.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 py-2"
            data-testid={`pledge-${c.id}`}
          >
            <div className="min-w-0">
              <p className="font-semibold tabular-nums text-foreground">
                {formatCurrency(c.amount_vnd, locale)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(c.committed_at, locale)} ·{" "}
                {t(`${K}.status.${c.status}`)}
              </p>
            </div>
            {canWithdraw && c.status === "PLEDGED" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                disabled={withdrawing === c.id}
                onClick={() => onWithdraw(c.id)}
              >
                {withdrawing === c.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Undo2 className="h-3.5 w-3.5" />
                )}
                {t(`${K}.withdraw`)}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
