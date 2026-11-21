"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  HandCoins,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAdminFundingAnalytics,
  useAdminInvestorTransfers,
  useAdminRepaymentReceipts,
} from "@/hooks/use-admin-funding";
import { formatCompactCurrency, formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { CONTROL_HOVER } from "@/lib/ui-tokens";
import { cn } from "@/lib/utils";
import type { AdminActivityPerson } from "@/services/admin-funding.service";
import { RepaymentStatusBadge } from "../transactions/_components/RepaymentStatusBadge";
import { TransferStatusBadge } from "../transactions/_components/TransferQueue";
import { MonthlyTrendChart } from "./MonthlyTrendChart";

const LATEST = 3;
const K = "admin.recentTransactions";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** A box: its header, the platform-wide totals and trend, then the latest
 *  few items (what waits on staff first). */
function Panel({
  icon: Icon,
  title,
  total,
  href,
  viewAll,
  refreshLabel,
  onRefresh,
  fetching,
  summary,
  latestLabel,
  loading,
  empty,
  children,
  testId,
}: {
  icon: typeof HandCoins;
  title: string;
  total: number | undefined;
  href: string;
  viewAll: string;
  refreshLabel: string;
  onRefresh: () => void;
  fetching: boolean;
  summary: React.ReactNode;
  latestLabel: string;
  loading: boolean;
  empty: string | null;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col rounded-lg border bg-card"
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {total !== undefined && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={fetching}
            aria-label={refreshLabel}
            className="h-7 gap-1 px-2 text-xs"
          >
            <RefreshCw className={cn("h-3 w-3", fetching && "animate-spin")} />
            <span className="hidden sm:inline">{refreshLabel}</span>
          </Button>
          <Link
            href={href}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground",
              CONTROL_HOVER,
            )}
          >
            {viewAll}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="space-y-4 border-b px-5 py-4">{summary}</div>
      <p className="px-5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {latestLabel}
      </p>
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : empty ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  );
}

/** One headline figure: a label, the value, and an optional detail line. */
function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {detail && (
        <div className="truncate text-[11px] text-muted-foreground">
          {detail}
        </div>
      )}
    </div>
  );
}

/** While the totals load, or if they fail: the same height, no numbers. */
function SummaryState({ loading, t }: { loading: boolean; t: T }) {
  return loading ? (
    <div className="flex h-[172px] items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ) : (
    <p className="py-6 text-center text-sm text-muted-foreground">
      {t(`${K}.analyticsError`)}
    </p>
  );
}

const person = (p: AdminActivityPerson) => p.full_name || p.email || "—";

/**
 * The money on the platform, on the first screen an admin sees: across every
 * account, what investors have put into businesses (left) and what businesses
 * have repaid them (right), each with its last 12 months and the latest few
 * items. FundLok holds none of it: each transfer goes straight from one
 * party's bank account to the other's. The lists put what waits on staff
 * first, then the newest; the full queues live on /admin/transactions.
 */
export function RecentTransactions({ locale, t }: { locale: string; t: T }) {
  const analytics = useAdminFundingAnalytics();
  const transfers = useAdminInvestorTransfers({
    status: "ALL",
    page: 1,
    page_size: LATEST,
  });
  const repayments = useAdminRepaymentReceipts({
    status: "ALL",
    page: 1,
    page_size: LATEST,
  });

  const inv = analytics.data?.investments;
  const rep = analytics.data?.repayments;
  const transferItems = transfers.data?.items ?? [];
  const repaymentItems = repayments.data?.items ?? [];
  const money = (vnd: number) => formatCompactCurrency(vnd, locale);
  const fill = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      t(key),
    );
  const chartHeaders = {
    monthHeader: t(`${K}.month`),
    amountHeader: t(`${K}.amount`),
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        testId="recent-investment-transfers"
        icon={HandCoins}
        title={t(`${K}.investmentsTitle`)}
        total={transfers.data?.total}
        href="/admin/transactions?tab=transfers"
        viewAll={t(`${K}.viewAll`)}
        refreshLabel={t("admin.table.refresh")}
        onRefresh={() => {
          void analytics.refetch();
          void transfers.refetch();
        }}
        fetching={analytics.isFetching || transfers.isFetching}
        summary={
          inv ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label={t(`${K}.invested`)}
                  value={money(inv.invested_vnd)}
                  detail={fill(`${K}.investmentsCount`, {
                    count: inv.investments,
                  })}
                />
                <Stat
                  label={t(`${K}.inProgress`)}
                  value={money(inv.in_progress_vnd)}
                  detail={fill(`${K}.inProgressCount`, {
                    count: inv.in_progress,
                  })}
                />
                <Stat
                  label={t(`${K}.participants`)}
                  value={`${inv.investors} / ${inv.businesses}`}
                  detail={t(`${K}.participantsDetail`)}
                />
              </div>
              <MonthlyTrendChart
                points={inv.monthly}
                series="deployed"
                caption={t(`${K}.investedTrend`)}
                locale={locale}
                {...chartHeaders}
              />
            </>
          ) : (
            <SummaryState loading={analytics.isLoading} t={t} />
          )
        }
        latestLabel={t(`${K}.latest`)}
        loading={transfers.isLoading}
        empty={
          transfers.isError
            ? t(`${K}.error`)
            : transferItems.length === 0
              ? t(`${K}.emptyInvestments`)
              : null
        }
      >
        {transferItems.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[1fr_auto] items-start gap-3 px-5 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">
                {row.investor_full_name || row.investor_email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.project_name}
              </p>
              <p className="truncate text-xs font-semibold tabular-nums text-foreground">
                {formatCurrency(row.amount_vnd, locale)}
                <span className="ml-1.5 font-mono font-normal text-muted-foreground">
                  {row.reference_code}
                </span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <TransferStatusBadge transfer={row} />
              <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                {formatDate(
                  row.receipt_submitted_at ?? row.reserved_at,
                  locale,
                )}
              </span>
            </div>
          </li>
        ))}
      </Panel>

      <Panel
        testId="recent-repayments"
        icon={CalendarCheck}
        title={t(`${K}.repaymentsTitle`)}
        total={repayments.data?.total}
        href="/admin/transactions?tab=repayments"
        viewAll={t(`${K}.viewAll`)}
        refreshLabel={t("admin.table.refresh")}
        onRefresh={() => {
          void analytics.refetch();
          void repayments.refetch();
        }}
        fetching={analytics.isFetching || repayments.isFetching}
        summary={
          rep ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label={t(`${K}.repaid`)}
                  value={money(rep.repaid_vnd)}
                  detail={fill(`${K}.principalRepaid`, {
                    amount: money(rep.principal_repaid_vnd),
                  })}
                />
                <Stat
                  label={t(`${K}.outstanding`)}
                  value={money(rep.outstanding_principal_vnd)}
                  detail={t(`${K}.outstandingDetail`)}
                />
                <Stat
                  label={t(`${K}.onTime`)}
                  // Floored, so a rate is never shown better than it is.
                  value={
                    rep.days_due > 0
                      ? `${Math.floor((rep.days_on_time / rep.days_due) * 100)}%`
                      : "—"
                  }
                  detail={
                    rep.late_tickets > 0 ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertTriangle
                          className="h-3 w-3 shrink-0"
                          aria-hidden
                        />
                        {fill(`${K}.late`, {
                          tickets: rep.late_tickets,
                          days: rep.late_days,
                        })}
                      </span>
                    ) : (
                      fill(`${K}.onTimeDays`, {
                        onTime: rep.days_on_time,
                        due: rep.days_due,
                      })
                    )
                  }
                />
              </div>
              <MonthlyTrendChart
                points={rep.monthly}
                series="returns"
                caption={t(`${K}.repaidTrend`)}
                locale={locale}
                {...chartHeaders}
              />
            </>
          ) : (
            <SummaryState loading={analytics.isLoading} t={t} />
          )
        }
        latestLabel={t(`${K}.latest`)}
        loading={repayments.isLoading}
        empty={
          repayments.isError
            ? t(`${K}.error`)
            : repaymentItems.length === 0
              ? t(`${K}.emptyRepayments`)
              : null
        }
      >
        {repaymentItems.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[1fr_auto] items-start gap-3 px-5 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
                <span className="truncate">{person(row.business)}</span>
                <ArrowRight
                  className="h-3 w-3 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="truncate">{person(row.investor)}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.project_name}
              </p>
              <p className="truncate text-xs font-semibold tabular-nums text-foreground">
                {formatCurrency(row.net_vnd, locale)}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {row.tranche_paid_days != null &&
                  row.tranche_total_days != null
                    ? fill("admin.transactions.repayments.table.progressDays", {
                        paid: row.tranche_paid_days,
                        total: row.tranche_total_days,
                      })
                    : `${t("admin.transactions.repayments.table.days")}: ${row.days.length}`}
                </span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <RepaymentStatusBadge receipt={row} />
              <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                {formatDate(row.submitted_at, locale)}
              </span>
            </div>
          </li>
        ))}
      </Panel>
    </div>
  );
}
