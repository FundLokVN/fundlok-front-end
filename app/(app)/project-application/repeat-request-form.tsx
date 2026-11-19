"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRepeatProject } from "@/hooks/use-projects";
import { useTranslations } from "@/lib/i18n";
import { digitsOnly, formatAmountInput } from "@/lib/format-currency";
import { apiErrorMessage } from "@/lib/api-error-message";
import { cn } from "@/lib/utils";
import {
  LOAN_DURATIONS_MONTHS,
  LOAN_MAX_VND,
  LOAN_MIN_VND,
} from "@/lib/constants/loan-constraints";
import type { Project } from "@/services/projects.service";
import { CREATE_ERRORS } from "./tax-code";

const PRESETS = [20_000_000, 30_000_000, 50_000_000, 75_000_000, 100_000_000];

/**
 * A business borrowing again (POST /projects/repeat): only the amount and the
 * term are asked. The company, the documents and the figures come from its
 * last approved request (`source`), and the request goes straight to review.
 */
export function RepeatRequestForm({ source }: { source: Project }) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const { mutate, isPending } = useRepeatProject();
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState(
    source.loan_application?.duration_months ?? 3,
  );
  const numeric = Number(amount);
  const valid = numeric >= LOAN_MIN_VND && numeric <= LOAN_MAX_VND;
  const K = "projectApplication.repeat";

  const submit = () =>
    mutate(
      { requested_amount: numeric, duration_months: term },
      {
        onSuccess: () => {
          toast({
            title: t(`${K}.submittedTitle`),
            description: t(`${K}.submittedDescription`),
          });
          router.push("/dashboard");
        },
        onError: (error) => {
          const code = error.code ?? "";
          toast({
            variant: "destructive",
            title: t("projectApplication.toasts.failedTitle"),
            description: CREATE_ERRORS.has(code)
              ? t(`projectApplication.errors.${code}`)
              : apiErrorMessage(
                  error,
                  locale,
                  t("projectApplication.toasts.failedDescription"),
                ),
          });
        },
      },
    );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 gap-2">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          {t("projectApplication.card.back")}
        </Link>
      </Button>

      <div className="space-y-3">
        <p className="eyebrow text-primary">{t(`${K}.eyebrow`)}</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
          {t(`${K}.title`)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {source.legal_name} · {t("projectApplication.fields.taxId")}{" "}
          {source.tax_id}
        </p>
      </div>

      <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
        <RefreshCw
          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
          aria-hidden
        />
        <p>{t(`${K}.reused`)}</p>
      </div>

      <form
        className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-2">
          <Label htmlFor="repeatAmount" className="text-sm font-semibold">
            {t("projectApplication.fields.requestedAmount")}
          </Label>
          <Input
            id="repeatAmount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t("projectApplication.placeholders.requestedAmount")}
            value={formatAmountInput(amount, locale)}
            onChange={(event) => {
              const digits = digitsOnly(event.target.value);
              setAmount(
                digits && Number(digits) > LOAN_MAX_VND
                  ? String(LOAN_MAX_VND)
                  : digits,
              );
            }}
            disabled={isPending}
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={cn(
                  "cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                  amount === String(preset)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {formatAmountInput(String(preset), locale)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("projectApplication.hints.requestedAmountRange", {
              min: formatAmountInput(String(LOAN_MIN_VND), locale),
              max: formatAmountInput(String(LOAN_MAX_VND), locale),
            })}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold" id="repeatTerm">
            {t("projectApplication.fields.durationMonths")}
          </p>
          <div
            role="group"
            aria-labelledby="repeatTerm"
            className="grid grid-cols-3 gap-1.5 sm:grid-cols-6"
          >
            {LOAN_DURATIONS_MONTHS.map((months) => (
              <button
                key={months}
                type="button"
                aria-pressed={term === months}
                disabled={isPending}
                onClick={() => setTerm(months)}
                className={cn(
                  "cursor-pointer rounded-lg border py-1.5 text-center text-xs font-semibold transition",
                  term === months
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t("projectApplication.durationOptions.months", {
                  count: months,
                })}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("projectApplication.hints.durationMonths")}
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full gap-2"
          disabled={!valid || isPending}
          onClick={submit}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t(isPending ? `${K}.submitting` : `${K}.submit`)}
        </Button>
      </form>
    </div>
  );
}
