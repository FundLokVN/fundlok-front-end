"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useSubmitSmeQuizLead } from "@/hooks/use-rates";
import { useTurnstile } from "@/hooks/use-turnstile";
import { formatRatePct, SME_QUIZ_PARAMS } from "@/lib/rate-quiz";
import { cn } from "@/lib/utils";
import { useSmeQuizContext } from "./SmeQuizContext";
import { quizAmountLabel, termLabel } from "./use-sme-quiz";

// Mirrors the backend's validate_contact_phone: 8–15 digits, with the
// separators people actually type.
const PHONE_RE = /^[0-9+()\s.-]{8,20}$/;
const phoneDigits = (v: string) => (v.match(/\d/g) ?? []).length;

/**
 * The result screen: the illustrative rate (or the declined message), and the
 * name and phone fields on the same screen — no extra tap in between (Loc,
 * 20 Nov 2026).
 */
export function QuizResult() {
  const { result, answers, state, t, locale, applySuggestion, restart } =
    useSmeQuizContext();

  if (!result || !answers) return null;

  const ask = t("ratePage.quiz.askSummary")
    .replace("{amount}", quizAmountLabel(answers.amountVnd, locale))
    .replace("{term}", termLabel(answers.tenorMonths, t));

  return (
    <div className="space-y-6">
      {result.outcome === "QUOTED" ? (
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {t("ratePage.quiz.resultTitle")}
          </p>
          <p className="text-5xl font-extrabold tracking-tight text-foreground">
            {formatRatePct(result.monthlyRatePct, locale)}%
            <span className="ml-1 text-xl font-semibold text-muted-foreground">
              {t("ratePage.quiz.perMonthSuffix")}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t("ratePage.quiz.perYearLine").replace(
              "{rate}",
              formatRatePct(result.annualRatePct, locale),
            )}{" "}
            · {ask}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {t("ratePage.quiz.declinedTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("ratePage.quiz.declinedBody")}
          </p>
          {!state.sentInquiryId && (
            <div className="flex flex-wrap gap-2">
              {result.suggestion.amountVnd !== null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    applySuggestion({ amountVnd: result.suggestion.amountVnd! })
                  }
                >
                  {t("ratePage.quiz.tryAmount").replace(
                    "{amount}",
                    quizAmountLabel(result.suggestion.amountVnd, locale),
                  )}
                </Button>
              )}
              {result.suggestion.tenorMonths !== null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    applySuggestion({
                      tenorMonths: result.suggestion.tenorMonths!,
                    })
                  }
                >
                  {t("ratePage.quiz.tryTerm").replace(
                    "{term}",
                    termLabel(result.suggestion.tenorMonths, t),
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {t("ratePage.quiz.disclaimer")}
      </p>

      {state.sentInquiryId ? <SentNotice /> : <LeadForm />}

      <div className="text-center">
        <button
          type="button"
          onClick={restart}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("ratePage.quiz.restart")}
        </button>
      </div>
    </div>
  );
}

function SentNotice() {
  const { state, t } = useSmeQuizContext();
  const reference = (state.sentInquiryId ?? "").slice(0, 8).toUpperCase();
  return (
    <div
      role="status"
      className="space-y-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
    >
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        {t("ratePage.quiz.sentTitle")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("ratePage.quiz.sentBody")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("ratePage.quiz.reference").replace("{ref}", reference)}
      </p>
    </div>
  );
}

function LeadForm() {
  const { answers, result, state, t, getSessionId, markSent } =
    useSmeQuizContext();
  const submit = useSubmitSmeQuizLead();
  const {
    turnstileToken,
    turnstileContainerRef,
    turnstileError,
    reset: resetTurnstile,
  } = useTurnstile({ appearance: "interaction-only" });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const nameError =
    attempted && fullName.trim().length < 2
      ? t("ratePage.error.fullName")
      : null;
  const phoneError =
    attempted &&
    (!PHONE_RE.test(phone.trim()) ||
      phoneDigits(phone) < 8 ||
      phoneDigits(phone) > 15)
      ? t("ratePage.error.phone")
      : null;
  const consentError =
    attempted && !consent ? t("ratePage.error.consent") : null;
  const waitingForCaptcha = attempted && !turnstileToken && !turnstileError;

  if (!answers || !result) return null;

  // Not <form onSubmit>: the send is triggered only by its own button (see the
  // fundlok-frontend skill's multi-step gotcha).
  const onSend = () => {
    setAttempted(true);
    const valid =
      fullName.trim().length >= 2 &&
      PHONE_RE.test(phone.trim()) &&
      phoneDigits(phone) >= 8 &&
      phoneDigits(phone) <= 15 &&
      consent;
    if (!valid || !turnstileToken || submit.isPending) return;

    submit.mutate(
      {
        requested_amount: answers.amountVnd,
        tenor_months: answers.tenorMonths,
        operating_band: answers.operatingBand,
        industry: answers.industry,
        monthly_revenue: answers.monthlyRevenueVnd,
        quiz_params_version: SME_QUIZ_PARAMS.version,
        outcome: result.outcome,
        monthly_rate_pct:
          result.outcome === "QUOTED" ? result.monthlyRatePct : null,
        full_name: fullName.trim(),
        phone: phone.trim(),
        consent_contact: true,
        session_id: getSessionId() || null,
        turnstile_token: turnstileToken,
        tracking: state.tracking,
      },
      { onSuccess: (data) => markSent(data.inquiry_id) },
    );
    // A Turnstile token is single-use whatever the server does with it.
    resetTurnstile();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">
        {t("ratePage.quiz.leadTitle")}
      </h3>

      <div className="space-y-1.5">
        <label
          htmlFor="quiz-full-name"
          className="text-sm font-medium text-foreground"
        >
          {t("ratePage.fullName")}
        </label>
        <Input
          id="quiz-full-name"
          autoComplete="name"
          value={fullName}
          placeholder={t("ratePage.fullNamePlaceholder")}
          aria-invalid={Boolean(nameError)}
          onChange={(e) => setFullName(e.target.value)}
          className="h-12 text-base"
        />
        {nameError && <FieldError text={nameError} />}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="quiz-phone"
          className="text-sm font-medium text-foreground"
        >
          {t("ratePage.phone")}
        </label>
        <Input
          id="quiz-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          placeholder="09xx xxx xxx"
          aria-invalid={Boolean(phoneError)}
          onChange={(e) => setPhone(e.target.value)}
          className="h-12 text-base"
        />
        {phoneError && <FieldError text={phoneError} />}
      </div>

      <div className="space-y-1.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-foreground">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            aria-invalid={Boolean(consentError)}
            className="mt-0.5"
          />
          <span>{t("ratePage.consent")}</span>
        </label>
        {consentError && <FieldError text={consentError} />}
      </div>

      {/* Invisible unless Cloudflare needs a click. */}
      <div ref={turnstileContainerRef} />
      {turnstileError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {t("ratePage.quiz.captchaError")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={resetTurnstile}
          >
            {t("ratePage.quiz.retry")}
          </Button>
        </div>
      )}
      {waitingForCaptcha && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("ratePage.quiz.captchaWaiting")}
        </p>
      )}
      {submit.isError && <FieldError text={t("ratePage.quiz.sendFailed")} />}

      <Button
        type="button"
        size="lg"
        onClick={onSend}
        disabled={submit.isPending}
        className={cn("h-12 w-full text-base font-semibold")}
      >
        {submit.isPending ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            {t("ratePage.quiz.sending")}
          </>
        ) : (
          t("ratePage.quiz.send")
        )}
      </Button>
    </div>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}
