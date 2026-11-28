"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format-currency";
import { useTranslations } from "@/lib/i18n";
import {
  calculateBreakEven,
  example,
  type BreakEvenInputs,
} from "./break-even";

const fields = ["fixedCosts", "orderPrice", "orderCost", "openDays"] as const;

export default function BreakEvenCalculator() {
  const { locale, t } = useTranslations();
  const number = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US");
  const exampleInputs = () => ({
    fixedCosts: number.format(example.fixedCosts),
    orderPrice: number.format(example.orderPrice),
    orderCost: number.format(example.orderCost),
    openDays: String(example.openDays),
  });
  const [inputs, setInputs] = useState<BreakEvenInputs>(exampleInputs);
  const result = calculateBreakEven(inputs);

  return (
    <div className="grid overflow-hidden rounded-2xl border bg-card shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <section
        className="space-y-5 p-5 sm:p-8"
        aria-labelledby="break-even-inputs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="break-even-inputs" className="text-lg font-semibold">
            {t("breakEvenPage.inputs")}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setInputs(exampleInputs())}
          >
            <RotateCcw aria-hidden="true" />
            {t("breakEvenPage.example")}
          </Button>
        </div>
        {fields.map((field) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={`break-even-${field}`}>
              {t(`breakEvenPage.fields.${field}.label`)}
            </Label>
            <Input
              id={`break-even-${field}`}
              inputMode="numeric"
              autoComplete="off"
              className="h-11 font-medium tabular-nums"
              value={inputs[field]}
              aria-describedby={`break-even-${field}-hint`}
              onChange={(event) =>
                setInputs({ ...inputs, [field]: event.target.value })
              }
            />
            <p
              id={`break-even-${field}-hint`}
              className="text-xs leading-relaxed text-muted-foreground"
            >
              {t(`breakEvenPage.fields.${field}.hint`)}
            </p>
          </div>
        ))}
      </section>

      <section
        aria-labelledby="break-even-result"
        aria-live="polite"
        className="min-w-0 border-t bg-muted/45 p-5 sm:p-8 md:border-l md:border-t-0"
      >
        <h2 id="break-even-result" className="mb-5 text-lg font-semibold">
          {t("breakEvenPage.result")}
        </h2>
        {result.status === "ok" ? (
          <>
            <div className="rounded-xl border border-emerald-600/25 bg-emerald-50 p-5 dark:bg-emerald-950/40">
              <p className="break-words text-4xl font-bold tracking-tight text-emerald-900 tabular-nums dark:text-emerald-200 sm:text-5xl">
                {number.format(result.ordersPerDay)}
              </p>
              <p className="mt-2 font-medium">
                {t("breakEvenPage.dailyOrders")}
              </p>
            </div>
            <dl className="mt-4 divide-y">
              {[
                [
                  t("breakEvenPage.monthlyOrders"),
                  number.format(result.ordersPerMonth),
                ],
                [
                  t("breakEvenPage.monthlyRevenue"),
                  formatCurrency(result.revenue, locale),
                ],
                [
                  t("breakEvenPage.contribution"),
                  formatCurrency(result.perOrder, locale),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("breakEvenPage.rounding")}
            </p>
          </>
        ) : (
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm leading-relaxed">
              {t(`breakEvenPage.${result.status}`)}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
