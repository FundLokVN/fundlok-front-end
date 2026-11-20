"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INDUSTRY_OPTIONS } from "@/lib/constants/industries";
import {
  OPERATING_BANDS,
  SME_QUIZ_PARAMS,
  type OperatingBand,
} from "@/lib/rate-quiz";
import { cn } from "@/lib/utils";
import { AmountInput } from "../../amount-input";
import { QuizResult } from "./QuizResult";
import { SmeQuizProvider, useSmeQuizContext } from "./SmeQuizContext";
import {
  QUIZ_QUESTION_COUNT,
  RESULT_STEP,
  quizAmountLabel,
  termLabel,
} from "./use-sme-quiz";

/**
 * The SME tab of /rate: five tap-through questions, then an illustrative rate
 * with the name and phone fields on the same screen.
 *
 * The rate is computed in the browser by lib/rate-quiz.ts — a published,
 * illustrative formula, not the underwriting engine. Spec: backend repo
 * docs/specs/rates/sme-rate-quiz.md.
 */
export function SmeQuiz({ getSessionId }: { getSessionId: () => string }) {
  return (
    <SmeQuizProvider getSessionId={getSessionId}>
      <QuizCard />
    </SmeQuizProvider>
  );
}

function QuizCard() {
  const { state, t, back } = useSmeQuizContext();
  const onResult = state.step >= RESULT_STEP;

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-8">
        {!onResult && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              {state.step > 0 ? (
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("ratePage.quiz.back")}
                </button>
              ) : (
                <span />
              )}
              <span className="text-xs font-medium text-muted-foreground">
                {t("ratePage.quiz.progress")
                  .replace("{n}", String(state.step + 1))
                  .replace("{total}", String(QUIZ_QUESTION_COUNT))}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={QUIZ_QUESTION_COUNT}
              aria-valuenow={state.step + 1}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{
                  width: `${((state.step + 1) / QUIZ_QUESTION_COUNT) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* The step swaps immediately; the entrance is a CSS animation.
            Deliberately not AnimatePresence: waiting on an exit animation
            stalled the quiz on the old question whenever the browser paused
            animation frames (a backgrounded in-app browser, a busy device),
            and a JS-driven entrance starts the new step at opacity 0 until
            it runs. A CSS keyframe can't hold content back. */}
        <div
          key={onResult ? "result" : `q${state.step}`}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-200"
        >
          {onResult ? <QuizResult /> : <Question step={state.step} />}
        </div>
      </div>
    </div>
  );
}

function Question({ step }: { step: number }) {
  switch (step) {
    case 0:
      return <AmountQuestion />;
    case 1:
      return <TenorQuestion />;
    case 2:
      return <BandQuestion />;
    case 3:
      return <IndustryQuestion />;
    default:
      return <RevenueQuestion />;
  }
}

function QuestionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
      {children}
    </h2>
  );
}

/** A large tap target. Selected = the answer already given, if they came back. */
function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-h-[52px] w-full rounded-xl border px-4 py-3 text-left text-base font-semibold transition active:scale-[0.98]",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background/60 text-foreground hover:border-primary/40 hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function AmountQuestion() {
  const { state, t, locale, chooseAmount } = useSmeQuizContext();
  return (
    <>
      <QuestionTitle>{t("ratePage.quiz.q1")}</QuestionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SME_QUIZ_PARAMS.amountsVnd.map((amount) => (
          <Choice
            key={amount}
            label={quizAmountLabel(amount, locale)}
            selected={state.amountVnd === amount}
            onClick={() => chooseAmount(amount)}
          />
        ))}
      </div>
    </>
  );
}

function TenorQuestion() {
  const { state, t, chooseTenor } = useSmeQuizContext();
  return (
    <>
      <QuestionTitle>{t("ratePage.quiz.q2")}</QuestionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SME_QUIZ_PARAMS.tenorsMonths.map((months) => (
          <Choice
            key={months}
            label={termLabel(months, t)}
            selected={state.tenorMonths === months}
            onClick={() => chooseTenor(months)}
          />
        ))}
      </div>
    </>
  );
}

function BandQuestion() {
  const { state, t, chooseBand } = useSmeQuizContext();
  return (
    <>
      <QuestionTitle>{t("ratePage.quiz.q3")}</QuestionTitle>
      <div className="grid gap-3">
        {OPERATING_BANDS.map((band: OperatingBand) => (
          <Choice
            key={band}
            label={t(`ratePage.quiz.band${band}`)}
            selected={state.operatingBand === band}
            onClick={() => chooseBand(band)}
          />
        ))}
      </div>
    </>
  );
}

function IndustryQuestion() {
  const { state, t, chooseIndustry } = useSmeQuizContext();
  const options = [
    ...INDUSTRY_OPTIONS.map((o) => ({
      value: o.value,
      label: t(`projectApplication.industries.${o.labelKey}`),
    })),
    { value: "Other", label: t("ratePage.quiz.industryOther") },
  ];
  return (
    <>
      <QuestionTitle>{t("ratePage.quiz.q4")}</QuestionTitle>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.map((option) => (
          <Choice
            key={option.value}
            label={option.label}
            selected={state.industry === option.value}
            onClick={() => chooseIndustry(option.value)}
          />
        ))}
      </div>
    </>
  );
}

function RevenueQuestion() {
  const {
    state,
    t,
    locale,
    revenueVnd,
    setRevenueDigits,
    chooseRevenue,
    submitRevenue,
  } = useSmeQuizContext();
  const [attempted, setAttempted] = useState(false);
  const showRequired = attempted && revenueVnd === null;
  return (
    <>
      <QuestionTitle>{t("ratePage.quiz.q5")}</QuestionTitle>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setAttempted(true);
          submitRevenue();
        }}
      >
        <AmountInput
          value={state.revenueDigits}
          onChange={setRevenueDigits}
          locale={locale}
          placeholder={t("ratePage.quiz.q5Placeholder")}
          invalid={showRequired}
        />
        {showRequired && (
          <p className="text-sm text-destructive" role="alert">
            {t("ratePage.quiz.revenueRequired")}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {SME_QUIZ_PARAMS.revenuePresetsVnd.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => chooseRevenue(amount)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition active:scale-[0.97]",
                revenueVnd === amount
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {quizAmountLabel(amount, locale)}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("ratePage.quiz.q5Hint")}
        </p>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base font-semibold"
        >
          {t("ratePage.quiz.seeRate")}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </form>
    </>
  );
}
