"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Loader2,
  QrCode,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNewQr, usePaymentInstructions } from "@/hooks/use-funding";
import { formatCurrency } from "@/lib/format-currency";
import { formatDateTimeIct, formatTimeIct } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const K = "investConfirm.transfer";

/**
 * How long one QR stays valid (Day-14 transfer rule, 18 Nov). The investor
 * can ask for a new QR, which starts a fresh window, for as long as the
 * reservation hold lasts, and never after 14:45 on disbursement day.
 *
 * The backend gives each QR its own code and expiry (`qr_code`,
 * `qr_expires_at`; backend day14-transfer-rule.md 4.1) and the screen follows
 * them. An older backend sends neither: the window is then kept here, in the
 * browser, and a new QR carries the same memo.
 */
export const QR_VALIDITY_MS = 15 * 60 * 1000;

interface TransferDetailsProps {
  trancheId: string;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Once the hold lapses: set this ticket aside and reserve a new one. */
  onReserveAgain?: () => void;
}

export function CopyRow({
  label,
  value,
  display,
  mono = false,
  t,
}: {
  label: string;
  value: string;
  display?: string;
  mono?: boolean;
  t: TransferDetailsProps["t"];
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "break-all text-sm font-semibold text-foreground",
            mono && "font-mono",
          )}
        >
          {display ?? value}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-muted"
        aria-label={t(`${K}.copyLabel`, { field: label })}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            {t(`${K}.copied`)}
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            {t(`${K}.copy`)}
          </>
        )}
      </button>
    </div>
  );
}

/** "1:05:09" style: what is left of the hold. */
function remaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/**
 * Where the investor sends the money: the business's own account, the exact
 * amount and the payment memo, each copyable, and a VietQR (from the backend's
 * payload) that carries all of them into the investor's bank app. The money
 * goes from the investor's bank straight to the business (ADR-009).
 */
export function TransferDetails({
  trancheId,
  locale,
  t,
  onReserveAgain,
}: TransferDetailsProps) {
  const payment = usePaymentInstructions(trancheId);
  const newQr = useNewQr(trancheId);
  const [deviceNow, setDeviceNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setDeviceNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // When the current QR was shown (only used without the server's expiry).
  // The parent keys this component by ticket, so another ticket starts fresh.
  const [shownAt, setShownAt] = useState(() => Date.now());
  // A "new QR" refused for a cut-off the clock had not reached yet.
  const [closedByServer, setClosedByServer] = useState(false);
  // "Try again in N seconds" goes away once the N seconds are up.
  const tooSoonFor =
    newQr.error?.code === "QR_TOO_SOON"
      ? (newQr.error.retryAfterSeconds ?? 60)
      : null;
  const { reset: resetNewQr } = newQr;
  useEffect(() => {
    if (tooSoonFor === null) return;
    const id = setTimeout(resetNewQr, tooSoonFor * 1000);
    return () => clearTimeout(id);
  }, [tooSoonFor, resetNewQr]);

  // The server decides whether a transfer was inside its QR's 15 minutes, so
  // count down on the server's clock: a phone running a few minutes slow must
  // not show time left on a code the server already treats as expired.
  const serverTime = payment.data?.server_time;
  const clockOffset =
    serverTime && payment.dataUpdatedAt
      ? new Date(serverTime).getTime() - payment.dataUpdatedAt
      : 0;
  const now = deviceNow + clockOffset;

  if (payment.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const payDeadlinePassed =
    payment.error?.code === "PAY_DEADLINE_PASSED" ||
    closedByServer ||
    (payment.data?.pay_deadline_at != null &&
      now >= new Date(payment.data.pay_deadline_at).getTime());
  if (payDeadlinePassed) {
    // 14:45 on disbursement day: no QR any more (Loc, 18 Nov). The receipt
    // upload beside this stays open until 15:30; whoever has not paid is
    // locked at 15:00 and joins the top-up after unlocking.
    return (
      <div
        className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
        data-testid="transfer-closed"
        role="status"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            {t(`${K}.closedTitle`)}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(`${K}.closedBody`, {
              time: formatTimeIct(payment.data?.pay_deadline_at) || "14:45",
              receiptTime:
                formatTimeIct(payment.data?.receipt_deadline_at) || "15:30",
            })}
          </p>
        </div>
      </div>
    );
  }
  if (!payment.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t(`${K}.loadFailed`)}
      </p>
    );
  }

  const details = payment.data;
  const serverQr = Boolean(details.qr_expires_at);
  const holdEndsAt = new Date(details.hold_expires_at).getTime();
  const expired = holdEndsAt - now <= 0;
  const payDeadline = details.pay_deadline_at
    ? new Date(details.pay_deadline_at).getTime()
    : Infinity;
  const qrEndsAt = serverQr
    ? new Date(details.qr_expires_at as string).getTime()
    : Math.min(shownAt + QR_VALIDITY_MS, holdEndsAt, payDeadline);
  const qrLeft = qrEndsAt - now;
  const qrExpired = !expired && qrLeft <= 0;
  const amount = formatCurrency(details.amount_vnd, locale);
  const memo = details.qr_code ?? details.reference_code;
  const retryIn = tooSoonFor;

  const getNewQr = () => {
    if (!serverQr) {
      setShownAt(Date.now());
      return;
    }
    newQr.mutate(undefined, {
      onError: (error) => {
        if (error.code === "PAY_DEADLINE_PASSED") setClosedByServer(true);
      },
    });
  };

  return (
    <section
      className="space-y-5"
      aria-labelledby="transfer-title"
      data-testid="transfer-details"
    >
      <div className="space-y-1">
        <h2 id="transfer-title" className="text-lg font-bold text-foreground">
          {t(`${K}.title`)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(`${K}.subtitle`, { name: details.account_name })}
        </p>
      </div>

      {expired ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {t(`${K}.expiredTitle`)}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(`${K}.expiredBody`)}
            </p>
            {onReserveAgain && (
              <Button
                type="button"
                size="sm"
                className="mt-2 gap-2"
                onClick={onReserveAgain}
              >
                <RotateCcw className="h-4 w-4" />
                {t(`${K}.reserveAgain`)}
              </Button>
            )}
          </div>
        </div>
      ) : qrExpired ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
          data-testid="transfer-qr-expired"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {t(`${K}.qrExpiredTitle`)}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(`${K}.qrExpiredBody`, { minutes: QR_VALIDITY_MS / 60_000 })}
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2 gap-2"
              onClick={getNewQr}
              disabled={newQr.isPending}
            >
              {newQr.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {t(`${K}.newQr`)}
            </Button>
            {retryIn !== null && (
              <p role="alert" className="text-xs text-destructive">
                {t(`${K}.newQrTooSoon`, { seconds: retryIn })}
              </p>
            )}
            {newQr.error && retryIn === null && (
              <p role="alert" className="text-xs text-destructive">
                {t(`${K}.newQrFailed`)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm"
          data-testid="transfer-deadline"
        >
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-foreground">
            {t(`${K}.deadline`, {
              time: formatDateTimeIct(new Date(qrEndsAt), locale),
            })}
          </span>
          <span className="ml-auto font-mono font-semibold tabular-nums text-foreground">
            {t(`${K}.timeLeft`, { time: remaining(qrLeft) })}
          </span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
        <div className="mx-auto space-y-2 text-center">
          {/* A QR needs a light background to stay scannable in dark mode.
              An expired QR is blurred so it can no longer be scanned. */}
          <div
            className={cn(
              "rounded-2xl border border-border/40 bg-white p-4 shadow-sm",
              expired && "opacity-40",
              qrExpired && "opacity-40 blur-sm",
            )}
            data-testid="transfer-qr"
            data-qr-value={details.vietqr_payload}
          >
            <QRCode value={details.vietqr_payload} size={184} />
          </div>
          <p className="max-w-56 text-xs text-muted-foreground">
            {t(`${K}.qrHint`)}
          </p>
        </div>

        <div className="divide-y rounded-xl border px-4">
          <div className="py-2.5">
            <p className="text-xs text-muted-foreground">{t(`${K}.bank`)}</p>
            <p className="text-sm font-semibold text-foreground">
              {details.bank_name}
            </p>
          </div>
          <CopyRow
            label={t(`${K}.accountNumber`)}
            value={details.account_number}
            mono
            t={t}
          />
          <CopyRow
            label={t(`${K}.accountName`)}
            value={details.account_name}
            t={t}
          />
          <CopyRow
            label={t(`${K}.amount`)}
            value={String(details.amount_vnd)}
            display={amount}
            t={t}
          />
          <CopyRow label={t(`${K}.memo`)} value={memo} mono t={t} />
        </div>
      </div>

      <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
        <li>{t(`${K}.rules.ownAccount`)}</li>
        <li>{t(`${K}.rules.exact`)}</li>
        <li>{t(`${K}.rules.direct`, { name: details.account_name })}</li>
        <li>{t(`${K}.rules.receipt`)}</li>
      </ul>
    </section>
  );
}
