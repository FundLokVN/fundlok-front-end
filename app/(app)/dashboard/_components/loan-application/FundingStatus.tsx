import { Loader2, Users } from "lucide-react";
import { ReadError } from "@/app/(app)/dashboard/_components/ReadError";
import { useMyRounds } from "@/hooks/use-funding";
import { RoundProgress } from "../funding/RoundProgress";
import { ExtensionFiling } from "../funding/ExtensionFiling";
import { RepaymentPlan } from "../funding/RepaymentPlan";
import { SmeDecision } from "../funding/SmeDecision";
import { RoundTickets } from "../funding/RoundTickets";
import { TodaysRepayments } from "../funding/TodaysRepayments";

/**
 * Where funding stands on an approved request, from the business's own round:
 * what investors have put in, each investor's ticket (masked), its daily
 * repayments (projected until the loan forms), and once it has formed, what is
 * due to each investor today.
 *
 * Approval is not funding: until the round opens (it opens by itself once the
 * project is live and the business's bank account is approved) this says so
 * rather than claiming any progress.
 */
export function FundingStatus({
  projectId,
  t,
}: {
  projectId: string;
  t: (key: string) => string;
}) {
  const rounds = useMyRounds();
  // The newest round on this project (the API lists newest first).
  const round = rounds.data?.find((r) => r.project_id === projectId);

  if (rounds.isError) {
    return (
      <ReadError
        message={t("dashboard.sme.funding.loadFailed")}
        retryLabel={t("errorPage.retry")}
        isFetching={rounds.isFetching}
        refetch={rounds.refetch}
      />
    );
  }
  if (rounds.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!round) {
    return (
      <section
        aria-label={t("dashboard.sme.funding.heading")}
        data-testid="funding-status"
        className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-4"
      >
        <Users
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="space-y-0.5">
          <p className="stat-label">{t("dashboard.sme.funding.heading")}</p>
          <p className="text-sm font-bold text-foreground">
            {t("dashboard.sme.funding.none")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("dashboard.sme.funding.noneHint")}
          </p>
        </div>
      </section>
    );
  }
  const usesPledges = round.flow === "COMMIT_THEN_ACCEPT";
  const showProgress =
    !usesPledges ||
    round.confirmed_vnd > 0 ||
    round.status === "CLOSING" ||
    round.status === "REPAYING" ||
    round.status === "REPAID";
  const showTickets = showProgress || round.tickets.length > 0;

  return (
    <div className="space-y-4" data-testid="funding-status">
      {/* Commit-then-accept rounds: pledges, then the Day-13 decision. */}
      {usesPledges && <SmeDecision round={round} />}
      {showTickets && (
        <section
          aria-label={t("dashboard.sme.funding.heading")}
          className="space-y-5 rounded-xl border border-border/60 bg-card p-4 md:p-5"
        >
          {showProgress && <RoundProgress round={round} />}
          <RoundTickets round={round} />
        </section>
      )}
      {/* An investment repays from its approval, so payments can be due while
          the round is still open. */}
      {(round.status === "REPAYING" ||
        round.tickets.some((ticket) => ticket.status === "ACTIVE")) && (
        <>
          <TodaysRepayments />
          <ExtensionFiling round={round} />
        </>
      )}
      {(round.confirmed_vnd > 0 ||
        round.status === "REPAYING" ||
        round.status === "REPAID") && <RepaymentPlan round={round} />}
    </div>
  );
}
