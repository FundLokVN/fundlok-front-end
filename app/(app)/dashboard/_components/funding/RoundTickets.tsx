"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useConfirmTransferWithReceipt,
  useDisputeConfirmedTransfer,
  useReportMissingTransfer,
} from "@/hooks/use-funding";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/api-error-message";
import { formatCurrency } from "@/lib/format-currency";
import { formatDateTimeIct } from "@/lib/format-date";
import { useTranslations } from "@/lib/i18n";
import type { ApiError } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { SmeRound, SmeTicket } from "@/services/funding.service";

const K = "dashboard.sme.funding";

// Lapsed reservations were never investments: left out.
const SHOWN = (ticket: SmeTicket) => ticket.status !== "EXPIRED";

// Money received: the investment has repayment tickets, real or projected.
const HAS_TICKETS = (ticket: SmeTicket) =>
  ticket.status === "ACTIVE" || ticket.status === "CONFIRMED";

// An investor has uploaded their transfer receipt (or staff attested it): the
// business can report if the money has not reached its bank account.
const REPORTABLE = (ticket: SmeTicket) =>
  ticket.status === "ATTESTED" ||
  (ticket.status === "SIGNED" && Boolean(ticket.receipt_submitted_at));

// What a receipt or bank statement may be (the backend checks the bytes too).
const EVIDENCE = "application/pdf,image/png,image/jpeg,image/webp";

/** The business's page for one investment: its tickets and today's payment. */
export const investmentHref = (ticketId: string) =>
  `/dashboard/repayments/${ticketId}`;

// Each investor's ticket, masked as everywhere the business looks. When an
// investor uploads their transfer receipt, the business is notified and can
// report here if the money has not arrived in its account. Once the receipt is
// checked, the business has 24 hours to confirm with its own screenshot (or
// report it); silence counts as received, and such an automatic confirmation
// can still be disputed with a bank statement for 30 days. Once confirmed, an
// investment opens its own page of repayment tickets.
export function RoundTickets({ round }: { round: SmeRound }) {
  const { t } = useTranslations();
  const tickets = round.tickets.filter(SHOWN);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(`${K}.ticketsHeading`)}
        </p>
        {tickets.some(HAS_TICKETS) && (
          <p className="text-xs text-muted-foreground">
            {t(`${K}.ticketsHint`)}
          </p>
        )}
      </div>
      {tickets.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t(`${K}.noTickets`)}</p>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="round-tickets">
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketRow({ ticket }: { ticket: SmeTicket }) {
  const { t, locale } = useTranslations();
  const { toast } = useToast();
  const report = useReportMissingTransfer();
  const confirm = useConfirmTransferWithReceipt();
  const dispute = useDisputeConfirmedTransfer();
  const receiptInput = useRef<HTMLInputElement>(null);
  const [reporting, setReporting] = useState(false);
  const [statement, setStatement] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [bankStatement, setBankStatement] = useState<File | null>(null);
  // When the page opened: enough to hide a dispute window that has closed.
  const [openedAt] = useState(() => Date.now());

  const received = HAS_TICKETS(ticket);
  const reportable = REPORTABLE(ticket);
  const reportedMissing =
    ticket.status === "UNDER_REVIEW" && ticket.review_cause === "SME_DISPUTE";
  const receiptSubmitted =
    ticket.status === "SIGNED" && Boolean(ticket.receipt_submitted_at);
  // The investor's receipt is checked: the business's 24 hours to confirm.
  const confirmable = ticket.status === "ATTESTED";
  // Confirmed by the business's silence: disputable until dispute_until.
  const disputeOpen =
    Boolean(ticket.dispute_until) &&
    new Date(ticket.dispute_until ?? "").getTime() > openedAt;
  const at = (iso: string | null | undefined) =>
    formatDateTimeIct(iso ?? "", locale);

  const statusKey = reportedMissing
    ? "REPORTED_MISSING"
    : receiptSubmitted
      ? "RECEIPT_SUBMITTED"
      : ticket.status;

  const sendReport = () =>
    report.mutate(
      { trancheId: ticket.id, statement: statement.trim() || null },
      {
        onSuccess: () => {
          toast({ title: t(`${K}.reportedToast`) });
          setReporting(false);
        },
        onError: (error) =>
          toast({
            variant: "destructive",
            title: t(`${K}.reportFailed`),
            description:
              error.code === "DISPUTE_WINDOW_CLOSED"
                ? t(`${K}.reportClosed`)
                : apiErrorMessage(error, locale, t("common.tryAgain")),
          }),
      },
    );

  const failed = (title: string, closed: string) => (error: ApiError) =>
    toast({
      variant: "destructive",
      title: t(title),
      description:
        error.code === "DISPUTE_WINDOW_CLOSED"
          ? t(closed)
          : apiErrorMessage(error, locale, t("common.tryAgain")),
    });

  const sendReceipt = (file: File) =>
    confirm.mutate(
      { trancheId: ticket.id, file },
      {
        onSuccess: (result) =>
          toast({
            title: t(
              result.status === "CONFIRMED"
                ? `${K}.confirmedToast`
                : `${K}.confirmMismatchToast`,
            ),
          }),
        onError: failed(`${K}.confirmFailed`, `${K}.reportClosed`),
      },
    );

  const sendDispute = () =>
    bankStatement &&
    dispute.mutate(
      { trancheId: ticket.id, statement: reason.trim(), file: bankStatement },
      {
        onSuccess: () => {
          toast({ title: t(`${K}.disputedToast`) });
          setDisputing(false);
        },
        onError: failed(`${K}.disputeFailed`, `${K}.disputeClosed`),
      },
    );

  const summary = (
    <>
      <span className="min-w-0 font-medium text-foreground">
        {ticket.investor_display}
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {ticket.reference_code}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular-nums text-foreground">
          {formatCurrency(ticket.amount_vnd, locale)}
        </span>
        <Badge
          variant="outline"
          className={cn(
            received &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            reportedMissing &&
              "border-destructive/40 bg-destructive/10 text-destructive",
            receiptSubmitted &&
              "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          )}
        >
          {t(`${K}.ticketStatus.${statusKey}`)}
        </Badge>
        {confirmable && !reporting && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            disabled={confirm.isPending}
            onClick={() => receiptInput.current?.click()}
          >
            {t(`${K}.confirmReceived`)}
          </Button>
        )}
        {reportable && !reporting && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setReporting(true)}
          >
            {t(`${K}.report`)}
          </Button>
        )}
        {received && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </span>
    </>
  );

  return (
    <li className="space-y-2 text-sm">
      {received ? (
        <Link
          href={investmentHref(ticket.id)}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
          title={t(`${K}.openTickets`)}
        >
          {summary}
        </Link>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          {summary}
        </div>
      )}
      {confirmable && (
        <>
          <input
            ref={receiptInput}
            type="file"
            accept={EVIDENCE}
            className="hidden"
            aria-label={t(`${K}.confirmReceived`)}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) sendReceipt(file);
            }}
          />
          {ticket.confirm_deadline && !reporting && (
            <p className="px-3 pb-2 text-xs text-muted-foreground">
              {t(`${K}.confirmHint`, { date: at(ticket.confirm_deadline) })}
            </p>
          )}
        </>
      )}
      {disputeOpen && !disputing && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2 text-xs text-muted-foreground">
          <span>
            {t(`${K}.autoConfirmed`, { date: at(ticket.dispute_until) })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setDisputing(true)}
          >
            {t(`${K}.dispute`)}
          </Button>
        </div>
      )}
      {disputing && (
        <div className="space-y-2 px-3 pb-3">
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t(`${K}.disputePlaceholder`)}
            aria-label={t(`${K}.disputePlaceholder`)}
            disabled={dispute.isPending}
          />
          <label className="block space-y-1 text-xs text-muted-foreground">
            <span>{t(`${K}.disputeFile`)}</span>
            <input
              type="file"
              accept={EVIDENCE}
              className="block w-full text-xs"
              disabled={dispute.isPending}
              onChange={(event) =>
                setBankStatement(event.target.files?.[0] ?? null)
              }
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={dispute.isPending || !reason.trim() || !bankStatement}
              onClick={sendDispute}
            >
              {t(`${K}.disputeSend`)}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={dispute.isPending}
              onClick={() => setDisputing(false)}
            >
              {t(`${K}.cancel`)}
            </Button>
          </div>
        </div>
      )}
      {reporting && (
        <div className="space-y-2 px-3 pb-3">
          <Textarea
            rows={2}
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
            placeholder={t(`${K}.reportPlaceholder`)}
            aria-label={t(`${K}.reportPlaceholder`)}
            disabled={report.isPending}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={report.isPending}
              onClick={sendReport}
            >
              {t(`${K}.reportSend`)}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={report.isPending}
              onClick={() => setReporting(false)}
            >
              {t(`${K}.cancel`)}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
