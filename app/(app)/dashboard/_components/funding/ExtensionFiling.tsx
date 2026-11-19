"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { useFileExtension } from "@/hooks/use-repayment";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/api-error-message";
import { formatDate, todayIct } from "@/lib/format-date";
import { useTranslations } from "@/lib/i18n";
import type { SmeRound } from "@/services/funding.service";
import type { ExtensionFiling as Filing } from "@/services/repayment.service";

const K = "dashboard.sme.funding.extension";
const KINDS = ["TAX_DECLARATION", "BANK_INFLOW"] as const;
const KNOWN = new Set([
  "FILING_CLOSED",
  "ALREADY_FILED",
  "LATE_DAY_BLOCKS_FILING",
  "REVENUE_SHARE_UNKNOWN",
]);
const EVIDENCE = "application/pdf,image/png,image/jpeg,image/webp";

/** "2026-12-03" -> "2026-11": the month filed in the first days of the next. */
function previousMonth(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
}

// The business files last month's revenue from the 1st to the 5th
// (automatic-extension.md, D-042); the backend decides at once.
export function ExtensionFiling({ round }: { round: SmeRound }) {
  const { t, locale } = useTranslations();
  const { toast } = useToast();
  const file = useFileExtension(round.id);
  const [today] = useState(todayIct);
  const [revenue, setRevenue] = useState("");
  const [kind, setKind] = useState<Filing["evidence_kind"]>("TAX_DECLARATION");
  const [evidence, setEvidence] = useState<File | null>(null);

  if (Number(today.slice(8, 10)) > 5) return null;
  const month = previousMonth(today);
  const label = `${month.slice(5, 7)}/${month.slice(0, 4)}`;

  const send = () =>
    evidence &&
    file.mutate(
      {
        periodMonth: month,
        revenueVnd: Number(revenue),
        evidenceKind: kind,
        file: evidence,
      },
      {
        onSuccess: (filing) =>
          toast({
            title: t(`${K}.result.${filing.status}`, {
              days: filing.delta_days,
              date: filing.start_date
                ? formatDate(filing.start_date, locale)
                : "",
            }),
          }),
        onError: (error) =>
          toast({
            variant: "destructive",
            title: t(`${K}.failed`),
            description: KNOWN.has(error.code ?? "")
              ? t(`${K}.errors.${error.code}`)
              : apiErrorMessage(error, locale, t("common.tryAgain")),
          }),
      },
    );

  return (
    <section
      aria-label={t(`${K}.heading`)}
      className="space-y-3 rounded-xl border border-border/60 bg-card p-4 md:p-5"
      data-testid="extension-filing"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          {t(`${K}.heading`)}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(`${K}.hint`, { month: label })}
        </p>
      </div>
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>{t(`${K}.revenue`, { month: label })}</span>
        <NumericInput
          value={revenue}
          onValueChange={setRevenue}
          disabled={file.isPending}
        />
      </label>
      <fieldset className="space-y-1 text-xs text-muted-foreground">
        <legend>{t(`${K}.kind`)}</legend>
        <div className="flex flex-wrap gap-3">
          {KINDS.map((value) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`evidence-kind-${round.id}`}
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                disabled={file.isPending}
              />
              {t(`${K}.kinds.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>{t(`${K}.file`)}</span>
        <input
          type="file"
          accept={EVIDENCE}
          className="block w-full text-xs"
          disabled={file.isPending}
          onChange={(event) => setEvidence(event.target.files?.[0] ?? null)}
        />
      </label>
      <Button
        type="button"
        size="sm"
        disabled={file.isPending || revenue === "" || !evidence}
        onClick={send}
      >
        {t(`${K}.submit`)}
      </Button>
    </section>
  );
}
