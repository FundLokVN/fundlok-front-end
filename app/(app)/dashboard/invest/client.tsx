"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TruncatedFigure } from "@/components/truncated-figure";
import { useRequireAuth } from "@/hooks/use-authentication";
import { useHasBankAccount } from "@/hooks/use-payment-accounts";
import { usePublicProjects } from "@/hooks/use-projects";
import {
  useFundingWindow,
  useInvestmentConfirmation,
  useInvestorAgreement,
  useMyTranches,
  useReserveTicket,
  useStanding,
} from "@/hooks/use-funding";
import { useToast } from "@/hooks/use-toast";
import { BankAccountPrompt } from "../_components/BankAccountPrompt";
import { LastTicketNotice } from "../_components/LastTicketNotice";
import { CommitThenAccept } from "./_components/CommitThenAccept";
import { Day14ContractStep } from "./_components/Day14ContractStep";
import { InvestmentConfirmationTable } from "./_components/InvestmentConfirmationTable";
import { InvestorAgreementStep } from "./_components/InvestorAgreementStep";
import { InvestTerms } from "./_components/InvestTerms";
import { LenderStandingCard } from "./_components/LenderStandingCard";
import { SignedAgreementNotice } from "./_components/SignedAgreementNotice";
import { SignedLoanContractCard } from "./_components/SignedLoanContractCard";
import { SignedConfirmationCard } from "./_components/SignedConfirmationCard";
import { ReceiptUpload } from "./_components/ReceiptUpload";
import { TransferDetails } from "./_components/TransferDetails";
import { useTranslations } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { lastTicketVnd, ticketBounds } from "@/lib/listing-figures";
import { CONTROL_IDLE } from "@/lib/ui-tokens";
import { cn } from "@/lib/utils";
import {
  INVESTOR_TERMS_VERSION,
  LIVE_TRANCHE_STATUSES,
  type Tranche,
} from "@/services/funding.service";

const K = "investConfirm";

// Reservation failures the investor can act on, by X-Error-Code.
const KNOWN_ERRORS = new Set([
  "BELOW_MIN_TICKET",
  "CAPACITY_EXCEEDED",
  "WINDOW_NOT_OPEN",
  "ALREADY_HAS_LIVE_TRANCHE",
  "HOLD_EXPIRED",
  "TERMS_OUTDATED",
  "BANK_ACCOUNT_REQUIRED",
  "ACCOUNT_NOT_APPROVED",
  "INVESTOR_FEE_UNPAID",
  "INVESTOR_AGREEMENT_REQUIRED",
  "LENDER_LOCKED",
]);

type Step =
  | "amount"
  | "agreement"
  | "terms"
  | "transfer"
  | "pledge"
  | "decision"
  | "sign";
const STEPS: readonly Step[] = ["amount", "terms", "transfer"];
// A commit-then-accept round (Money flow FINAL v1.0): pledge (Days 0 to 12),
// the business decides (Day 13), sign and pay (Day 14).
const COMMIT_STEPS: readonly Step[] = [
  "pledge",
  "decision",
  "sign",
  "transfer",
];
// The investor's first commitment: agreeing makes the commitment (code, held
// amount, no money moved), then the Investor Service Agreement, filled in with
// that commitment's Annex, is signed and uploaded before the transfer.
const FIRST_STEPS: readonly Step[] = [
  "amount",
  "terms",
  "agreement",
  "transfer",
];

// Investing in one project, after the amount was chosen on its page
// (/dashboard/invest?projectId=…&amount=…): read and agree to the investing
// terms, which reserves the amount, then transfer it straight to the
// business's bank account. At the first commitment, agreeing makes the
// commitment (its code, the amount held, no money moved); the investor then
// signs the Investor Service Agreement (Contract 4) like an SME signs its own:
// download the PDF filled in with their details and this commitment's Annex,
// sign it digitally, upload it. Only then does the backend give the payment
// details. Later commitments show a reminder of the agreement signed and keep
// their own Annex, shown above the transfer details. Opened with just ?projectId=…, it shows the
// transfer details of the investor's ticket on that project. When that
// ticket's hold lapses, "Reserve again" brings the terms back for the same
// amount, and agreeing makes a new ticket (the backend expires the old one).
//
// The proxy only lets a KYC-approved INVESTOR reach this route (unverified
// ones go to /kyc?next=… first), and the backend checks again on reserve.
export default function InvestClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useTranslations();
  const { toast } = useToast();
  const { isLoading: isAuthLoading, user } = useRequireAuth();
  // Reached by URL too, so it checks for a bank account itself rather than
  // trusting the project page's button to have done so.
  const bankAccount = useHasBankAccount();
  const needsBankAccount = bankAccount.isLoaded && !bankAccount.hasAccount;

  const projectId = searchParams.get("projectId");
  const amount = Number(searchParams.get("amount") || 0);

  const projects = usePublicProjects(!isAuthLoading);
  const project = projects.data?.find((p) => p.id === projectId);
  const listingId = project?.loan_application?.listing?.id ?? null;
  const windowQuery = useFundingWindow(listingId);
  const fundingWindow = windowQuery.data ?? null;
  const tranches = useMyTranches(Boolean(fundingWindow));
  const agreement = useInvestorAgreement(Boolean(fundingWindow));
  // Locked after a Day-14 no-show or late money: no new reservation until
  // the investor unlocks (backend 409 LENDER_LOCKED).
  const standingEnabled = !isAuthLoading && user?.role === "INVESTOR";
  const standing = useStanding(standingEnabled);
  const locked =
    standing.data?.status === "LOCKED" || standing.data?.status === "CLOSED";
  // After unlocking, the late money the business kept stays listed here.
  const hasPledges = (standing.data?.top_up_pledges.length ?? 0) > 0;
  const reserve = useReserveTicket();
  // One key per reservation: a double click or a retry replays the same
  // reservation instead of making a second one. Reserving again takes a new key.
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [error, setError] = useState<string | null>(null);
  // The lapsed ticket the investor chose to reserve again in place of. The
  // backend may still list it as SIGNED until it expires it.
  const [replacedId, setReplacedId] = useState<string | null>(null);
  // The investor uploaded their signed agreement on this visit: the agreement
  // step stays in the step list, as the step they went through.
  const [signedHere, setSignedHere] = useState(false);

  // Newest first, as the backend lists them.
  const onWindow =
    tranches.data?.filter((t) => t.window_id === fundingWindow?.id) ?? [];
  // The listed copy of a ticket reserved on this visit is the fresher one: it
  // picks up the receipt and any status change.
  const ticket =
    onWindow.find((tranche) => tranche.id === reserve.data?.id) ??
    reserve.data ??
    onWindow.find(
      (tranche) =>
        tranche.id !== replacedId &&
        LIVE_TRANCHE_STATUSES.includes(tranche.status),
    );
  // Their latest ticket here lapsed before a transfer was reported.
  const lapsed =
    !ticket && onWindow[0]?.status === "EXPIRED" ? onWindow[0] : undefined;

  const bounds = fundingWindow ? ticketBounds(fundingWindow) : null;
  const amountInBounds =
    bounds !== null && amount >= bounds.min && amount <= bounds.max;
  // Less than a minimum ticket left: one last ticket of exactly that amount
  // (funding-window.md I-6), which is the only amount in bounds then.
  const lastTicket = fundingWindow
    ? lastTicketVnd(fundingWindow.capacity_vnd, fundingWindow.min_ticket_vnd)
    : null;
  const open = fundingWindow?.status === "OPEN";
  // True until the investor has signed the current agreement version.
  const needsAgreement = agreement.data?.required === true;
  // What this commitment signs, for the amount chosen on the project page.
  const confirmation = useInvestmentConfirmation(
    fundingWindow && open && amountInBounds && !ticket
      ? fundingWindow.id
      : null,
    amount,
  );

  const reserveAgain = (from: Tranche) => {
    reserve.reset();
    setError(null);
    setIdempotencyKey(crypto.randomUUID());
    setReplacedId(from.id);
    router.replace(
      `/dashboard/invest?projectId=${projectId}&amount=${from.amount_vnd}`,
    );
    // Reading the window releases the lapsed hold, so the bounds include it.
    void windowQuery.refetch();
    void tranches.refetch();
  };

  const loading =
    isAuthLoading ||
    (standingEnabled && standing.isLoading) ||
    projects.isLoading ||
    (Boolean(listingId) && windowQuery.isLoading) ||
    (Boolean(fundingWindow) && (tranches.isLoading || agreement.isLoading));

  const handleAgree = () => {
    if (!fundingWindow) return;
    setError(null);
    reserve.mutate(
      {
        windowId: fundingWindow.id,
        idempotencyKey,
        body: {
          amount_vnd: amount,
          ack_risk_disclosure: true,
          terms_version: INVESTOR_TERMS_VERSION,
        },
      },
      {
        onError: (failure) => {
          const code = failure.code ?? "";
          const message = KNOWN_ERRORS.has(code)
            ? t(`${K}.errors.${code}`)
            : t(`${K}.errors.generic`);
          setError(message);
          toast({
            variant: "destructive",
            title: t(`${K}.reserveFailed`),
            description: message,
          });
          // Their ticket from another tab: show it instead of the terms.
          if (code === "ALREADY_HAS_LIVE_TRANCHE") void tranches.refetch();
          // Locked since the page loaded: bring up the unlock card.
          if (code === "LENDER_LOCKED") void standing.refetch();
          // This key's reservation lapsed: agreeing again makes a new one.
          if (code === "HOLD_EXPIRED") setIdempotencyKey(crypto.randomUUID());
          // The backend wants a signed agreement (a new version came out):
          // the status brings the agreement step back.
          if (code === "INVESTOR_AGREEMENT_REQUIRED") void agreement.refetch();
        },
      },
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const backHref = project
    ? `/dashboard/projects/${project.id}`
    : "/dashboard/projects";
  // A held ticket of an investor who has not signed yet: sign before paying.
  const signsAgreement =
    needsAgreement &&
    !!ticket &&
    (ticket.status === "RESERVED" || ticket.status === "SIGNED") &&
    !ticket.receipt_submitted_at;
  const commitFlow = fundingWindow?.flow === "COMMIT_THEN_ACCEPT";
  const commitStep: Step =
    fundingWindow?.status === "OPEN"
      ? "pledge"
      : fundingWindow?.status === "AWAITING_SME"
        ? "decision"
        : !ticket || ticket.status === "RESERVED"
          ? "sign"
          : "transfer";
  const step: Step = commitFlow
    ? commitStep
    : !ticket
      ? "terms"
      : signsAgreement
        ? "agreement"
        : "transfer";
  const steps = commitFlow
    ? COMMIT_STEPS
    : needsAgreement || signedHere
      ? FIRST_STEPS
      : STEPS;
  const errorLine = error && (
    <p role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  );
  const shownAmount = ticket?.amount_vnd ?? (amount || lapsed?.amount_vnd || 0);

  let body: React.ReactNode;
  // Commit-then-accept: pledges, the business's decision, then Day 14. A
  // ticket already signed (paying, paid) goes on to the transfer below.
  const commitBody =
    commitFlow &&
    project &&
    fundingWindow &&
    !locked &&
    (!ticket || ticket.status === "RESERVED");
  if (commitBody) {
    body = (
      <CommitThenAccept
        fundingWindow={fundingWindow}
        amount={amount}
        businessName={project.legal_name}
        day14={
          ticket && ticket.status === "RESERVED" ? (
            <Day14ContractStep
              key={ticket.id}
              ticket={ticket}
              payDeadlineAt={fundingWindow.pay_deadline_at}
              phone={agreement.data?.phone ?? null}
              firstTime={agreement.data?.required === true}
              locale={locale}
              t={t}
            />
          ) : undefined
        }
        locale={locale}
        t={t}
      />
    );
  } else if (ticket && signsAgreement && agreement.data && !commitFlow) {
    body = (
      <InvestorAgreementStep
        key={ticket.id}
        version={agreement.data.version}
        trancheId={ticket.id}
        referenceCode={ticket.reference_code}
        holdExpiresAt={ticket.hold_expires_at}
        phone={agreement.data.phone}
        onSigned={() => {
          setSignedHere(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        locale={locale}
        t={t}
      />
    );
  } else if (ticket) {
    const awaitingTransfer =
      ticket.status === "RESERVED" || ticket.status === "SIGNED";
    // The Annex confirmed with this ticket, above everything about paying.
    const confirmationCard = (
      <SignedConfirmationCard
        key={`confirmation-${ticket.id}`}
        trancheId={ticket.id}
        locale={locale}
        t={t}
      />
    );
    const ticketBody =
      awaitingTransfer && !ticket.receipt_submitted_at ? (
        <>
          <TransferDetails
            key={ticket.id}
            trancheId={ticket.id}
            locale={locale}
            t={t}
            onReserveAgain={
              // FULL may only be this lapsed hold; reading the window frees it.
              open || fundingWindow?.status === "FULL"
                ? () => reserveAgain(ticket)
                : undefined
            }
          />
          <ReceiptUpload
            key={ticket.id}
            trancheId={ticket.id}
            submittedAt={null}
            locale={locale}
            t={t}
            receiptDeadlineAt={fundingWindow?.receipt_deadline_at}
          />
        </>
      ) : awaitingTransfer ? (
        // Receipt in: no deadline any more, FundLok is checking it.
        <ReceiptUpload
          trancheId={ticket.id}
          submittedAt={ticket.receipt_submitted_at}
          locale={locale}
          t={t}
        />
      ) : (
        // Received once staff approve it; repaid daily once the loan forms.
        <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          {ticket.status === "CONFIRMED"
            ? t(`${K}.received`)
            : ticket.status === "ACTIVE"
              ? t(`${K}.repaying`)
              : t(`${K}.confirming`)}
        </p>
      );
    body = (
      <>
        {confirmationCard}
        {ticketBody}
      </>
    );
  } else if (locked) {
    // The notifications about a lock link here (/dashboard/invest). Locked at
    // 15:00, the investor may still have a receipt to upload until 15:30 for
    // money sent before then: the lapsed ticket's upload stays beside the card.
    body = (
      <>
        <LenderStandingCard locale={locale} t={t} />
        {lapsed && (
          <ReceiptUpload
            key={lapsed.id}
            trancheId={lapsed.id}
            submittedAt={lapsed.receipt_submitted_at}
            locale={locale}
            t={t}
            receiptDeadlineAt={fundingWindow?.receipt_deadline_at}
          />
        )}
      </>
    );
  } else if (!project || !fundingWindow || !open) {
    body = (
      <Notice title={t(`${K}.notOpenTitle`)} body={t(`${K}.notOpenBody`)} />
    );
  } else if (needsBankAccount) {
    body = <BankAccountPrompt t={t} audience="investor" />;
  } else if (lapsed && !amount) {
    body = (
      <>
        <Notice
          title={t(`${K}.transfer.expiredTitle`)}
          body={t(`${K}.transfer.expiredBody`)}
          action={
            <Button
              type="button"
              size="sm"
              className="mt-2 gap-2"
              onClick={() => reserveAgain(lapsed)}
            >
              <RotateCcw className="h-4 w-4" />
              {t(`${K}.transfer.reserveAgain`)}
            </Button>
          }
        />
        {/* Already paid: a late receipt still goes to FundLok for review. */}
        <ReceiptUpload
          key={lapsed.id}
          trancheId={lapsed.id}
          submittedAt={lapsed.receipt_submitted_at}
          locale={locale}
          t={t}
          receiptDeadlineAt={fundingWindow.receipt_deadline_at}
        />
      </>
    );
  } else if (!amountInBounds && lastTicket !== null) {
    const last = formatCurrency(lastTicket, locale);
    body = (
      <Notice
        title={t("investment.lastTicket.outOfRangeTitle", { amount: last })}
        body={t("investment.lastTicket.outOfRangeBody", {
          amount: last,
          min: formatCurrency(fundingWindow.min_ticket_vnd, locale),
        })}
        action={
          <Button
            type="button"
            size="sm"
            className="mt-2"
            onClick={() => {
              setIdempotencyKey(crypto.randomUUID());
              router.replace(
                `/dashboard/invest?projectId=${projectId}&amount=${lastTicket}`,
              );
            }}
          >
            {t("investment.lastTicket.investExactly", { amount: last })}
          </Button>
        }
      />
    );
  } else if (!amountInBounds) {
    body = (
      <Notice
        title={t(`${K}.amountOutOfRangeTitle`)}
        body={t(`${K}.amountOutOfRangeBody`, {
          min: formatCurrency(bounds!.min, locale),
          max: formatCurrency(bounds!.max, locale),
        })}
      />
    );
  } else if (!agreement.data) {
    body = (
      <Notice
        title={t(`${K}.agreement.loadFailed`)}
        body={t(`${K}.errors.generic`)}
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void agreement.refetch()}
          >
            {t(`${K}.agreement.retry`)}
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        {/* Below the minimum, but the last ticket: say why it is allowed. */}
        {lastTicket !== null && amount === lastTicket && (
          <LastTicketNotice
            amountVnd={lastTicket}
            minTicketVnd={fundingWindow.min_ticket_vnd}
            completes
            locale={locale}
            t={t}
          />
        )}
        {agreement.data.signed_at ? (
          <SignedAgreementNotice
            signedAt={agreement.data.signed_at}
            version={agreement.data.signed_version ?? agreement.data.version}
            fileName={agreement.data.file_name}
            signatureCheck={agreement.data.signature_check}
            locale={locale}
            t={t}
          />
        ) : (
          // First commitment: what comes after agreeing, before any payment.
          <div
            className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-foreground"
            data-testid="agreement-sign-next"
          >
            {t(`${K}.agreement.signNext`)}
          </div>
        )}
        {/* The contract this commitment concludes, as the business signed it. */}
        <SignedLoanContractCard windowId={fundingWindow.id} t={t} />
        <InvestmentConfirmationTable
          confirmation={confirmation.data}
          isLoading={confirmation.isLoading}
          onRetry={() => void confirmation.refetch()}
          locale={locale}
          t={t}
        />
        {/* The Annex is part of what is signed: no agreeing before it shows. */}
        {confirmation.data && (
          <InvestTerms
            amount={amount}
            businessName={project.legal_name}
            fundingWindow={fundingWindow}
            isPending={reserve.isPending}
            onAgree={handleAgree}
            agreeLabel={t(`${K}.terms.agreeWithConfirmation`)}
            locale={locale}
            t={t}
          />
        )}
        {errorLine}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className={cn("-ml-2 gap-2", CONTROL_IDLE)}
      >
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" />
          {t(project ? `${K}.backToProject` : `${K}.back`)}
        </Link>
      </Button>

      <Card className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          {t(`${K}.verifiedBadge`)}
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t(`${K}.title`)}
          </h1>
          {project && (
            <p className="text-sm text-muted-foreground">
              {project.legal_name}
            </p>
          )}
        </div>

        {/* Where the investor is: the amount was chosen on the project page. */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-semibold">
          {steps.map((name, i) => {
            const current = steps.indexOf(step);
            return (
              <li
                key={name}
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap",
                  i <= current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                    i < current && "border-primary bg-primary/10 text-primary",
                    i === current &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {i + 1}
                </span>
                {t(`${K}.steps.${name}`)}
                {i < steps.length - 1 && (
                  <span
                    className="hidden h-px w-6 bg-border sm:block"
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>

        {fundingWindow && shownAmount > 0 && (
          <dl className="grid gap-4 rounded-xl border bg-muted/30 p-5 sm:grid-cols-3">
            <div className="min-w-0 sm:col-span-1">
              <dt className="stat-label">{t(`${K}.amountLabel`)}</dt>
              <dd className="mt-1 text-foreground">
                <TruncatedFigure
                  value={formatCurrency(shownAmount, locale)}
                  className="text-xl font-bold"
                />
              </dd>
            </div>
            <div>
              <dt className="stat-label">{t(`${K}.term`)}</dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {t(`${K}.termValue`, { months: fundingWindow.term_months })}
              </dd>
            </div>
            <div>
              <dt className="stat-label">{t(`${K}.closes`)}</dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {formatDate(fundingWindow.window_end, locale)}
              </dd>
            </div>
          </dl>
        )}

        {/* Unlocked, with late money kept as a top-up: keep it in view. */}
        {!locked && hasPledges && <LenderStandingCard locale={locale} t={t} />}
        {body}
      </Card>
    </div>
  );
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
        {action}
      </div>
    </div>
  );
}
