"use client";

import { Bar, BarChart, LabelList, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { SERIES_COLORS } from "@/app/(app)/dashboard/analytics/_components/chart-colors";
import { CurrencyChartTooltip } from "@/app/(app)/dashboard/analytics/_components/CurrencyChartTooltip";
import { monthTickLabel } from "@/app/(app)/dashboard/analytics/_components/mock-analytics";
import { formatCompactCurrency, formatCurrency } from "@/lib/format-currency";
import type { AdminMonthAmount } from "@/services/admin-funding.service";

/**
 * Twelve months of one amount, for the overview's transaction boxes.
 *
 * One series per chart, named by the caption above it, so there is no legend.
 * Colour follows the meaning used across the app's analytics (chart-colors.ts):
 * slate for money that has left (investments), emerald for money coming back
 * (repayments). Only the peak carries a label; hover shows any month, and a
 * visually hidden table carries every value for screen readers.
 */
export function MonthlyTrendChart({
  points,
  series,
  caption,
  locale,
  monthHeader,
  amountHeader,
}: {
  points: AdminMonthAmount[];
  series: keyof typeof SERIES_COLORS;
  caption: string;
  locale: string;
  monthHeader: string;
  amountHeader: string;
}) {
  const chartConfig = {
    amount_vnd: { label: caption, theme: SERIES_COLORS[series] },
  } satisfies ChartConfig;

  const peakIndex = points.reduce(
    (best, point, i) => (point.amount_vnd > points[best].amount_vnd ? i : best),
    0,
  );
  const data = points.map((point, i) => ({
    ...point,
    peak_label:
      i === peakIndex && point.amount_vnd > 0
        ? formatCompactCurrency(point.amount_vnd, locale)
        : undefined,
  }));

  return (
    <figure className="space-y-1.5">
      <figcaption className="text-[11px] text-muted-foreground">
        {caption}
      </figcaption>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[112px] w-full"
        aria-hidden
      >
        <BarChart
          data={data}
          margin={{ top: 18, right: 4, left: 4, bottom: 0 }}
        >
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            minTickGap={4}
            fontSize={10}
            tickFormatter={(value: string) => monthTickLabel(value, locale)}
          />
          <ChartTooltip
            content={(props) => (
              <CurrencyChartTooltip
                {...props}
                labelFormatter={(_label, payload) => {
                  const month = payload?.[0]?.payload?.month as
                    string | undefined;
                  if (!month) return null;
                  return `${monthTickLabel(month, locale)} ${month.split("-")[0]}`;
                }}
              />
            )}
          />
          <Bar
            dataKey="amount_vnd"
            name={caption}
            fill="var(--color-amount_vnd)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          >
            <LabelList
              dataKey="peak_label"
              position="top"
              offset={6}
              className="fill-foreground text-[10px] font-semibold"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{monthHeader}</th>
            <th scope="col">{amountHeader}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.month}>
              <td>{point.month}</td>
              <td>{formatCurrency(point.amount_vnd, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
