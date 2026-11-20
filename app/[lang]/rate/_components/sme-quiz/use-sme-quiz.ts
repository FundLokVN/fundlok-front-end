"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeQuizRate,
  type OperatingBand,
  type QuizAnswers,
  type QuizResult,
} from "@/lib/rate-quiz";
import type { QuizTracking } from "@/services/rates.service";

/**
 * All local UI state for the SME quiz. Nothing here is server data: the rate
 * is derived in the browser by lib/rate-quiz.ts, so this is useState, not
 * React Query (see the fundlok-frontend skill).
 *
 * The component that uses this is rendered client-only (dynamic, ssr:false),
 * which is what lets the initial state come straight from sessionStorage
 * without a hydration mismatch.
 */

export const QUIZ_QUESTION_COUNT = 5;
/** Steps 0–4 are the questions; 5 is the result screen. */
export const RESULT_STEP = QUIZ_QUESTION_COUNT;

const STORAGE_KEY = "fundlok_rate_quiz_v1";
const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const;

export interface QuizState {
  step: number;
  amountVnd: number | null;
  tenorMonths: number | null;
  operatingBand: OperatingBand | null;
  industry: string | null;
  /** Digits as typed, so the field shows exactly what the visitor entered. */
  revenueDigits: string;
  /** Set once the lead is sent; the quiz is then finished. */
  sentInquiryId: string | null;
  /** First-touch ad parameters from the landing URL. */
  tracking: QuizTracking | null;
}

const EMPTY: QuizState = {
  step: 0,
  amountVnd: null,
  tenorMonths: null,
  operatingBand: null,
  industry: null,
  revenueDigits: "",
  sentInquiryId: null,
  tracking: null,
};

function readTrackingFromUrl(): QuizTracking | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const tracking: QuizTracking = {};
    let found = false;
    for (const key of TRACKING_KEYS) {
      const value = params.get(key);
      if (value) {
        tracking[key] = value;
        found = true;
      }
    }
    return found ? tracking : null;
  } catch {
    return null;
  }
}

function loadInitialState(): QuizState {
  const fromUrl = readTrackingFromUrl();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = { ...EMPTY, ...(JSON.parse(raw) as Partial<QuizState>) };
      // First touch wins: keep the parameters of the ad that brought them.
      return { ...saved, tracking: saved.tracking ?? fromUrl };
    }
  } catch {
    // Private mode, blocked storage or a corrupt value: start fresh.
  }
  return { ...EMPTY, tracking: fromUrl };
}

export function useSmeQuiz() {
  const [state, setState] = useState<QuizState>(loadInitialState);

  // Persist on every change so a reload (common in in-app browsers when the
  // visitor switches apps) resumes at the same question. Writing to storage is
  // a side effect, not a state update, so an effect is the right place.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable: the quiz still works, it just won't resume.
    }
  }, [state]);

  const revenueVnd = useMemo(() => {
    const value = Number(state.revenueDigits);
    return state.revenueDigits && Number.isFinite(value) && value > 0
      ? value
      : null;
  }, [state.revenueDigits]);

  const answers: QuizAnswers | null = useMemo(() => {
    if (
      state.amountVnd === null ||
      state.tenorMonths === null ||
      state.operatingBand === null ||
      state.industry === null ||
      revenueVnd === null
    ) {
      return null;
    }
    return {
      amountVnd: state.amountVnd,
      tenorMonths: state.tenorMonths,
      operatingBand: state.operatingBand,
      industry: state.industry,
      monthlyRevenueVnd: revenueVnd,
    };
  }, [state, revenueVnd]);

  const result: QuizResult | null = useMemo(
    () => (answers ? computeQuizRate(answers) : null),
    [answers],
  );

  const advance = (patch: Partial<QuizState>) =>
    setState((prev) => ({
      ...prev,
      ...patch,
      step: Math.min(prev.step + 1, RESULT_STEP),
    }));

  const chooseAmount = (amountVnd: number) => advance({ amountVnd });
  const chooseTenor = (tenorMonths: number) => advance({ tenorMonths });
  const chooseBand = (operatingBand: OperatingBand) =>
    advance({ operatingBand });
  const chooseIndustry = (industry: string) => advance({ industry });
  const setRevenueDigits = (revenueDigits: string) =>
    setState((prev) => ({ ...prev, revenueDigits }));
  const chooseRevenue = (amount: number) =>
    advance({ revenueDigits: String(amount) });
  const submitRevenue = () => {
    if (revenueVnd !== null) advance({});
  };

  const back = () =>
    setState((prev) => ({ ...prev, step: Math.max(prev.step - 1, 0) }));

  /** Declined-screen suggestions: change one answer and stay on the result. */
  const applySuggestion = (patch: {
    amountVnd?: number;
    tenorMonths?: number;
  }) => setState((prev) => ({ ...prev, ...patch, step: RESULT_STEP }));

  const markSent = (inquiryId: string) =>
    setState((prev) => ({ ...prev, sentInquiryId: inquiryId }));

  const restart = useCallback(
    () => setState((prev) => ({ ...EMPTY, tracking: prev.tracking })),
    [],
  );

  return {
    state,
    answers,
    result,
    revenueVnd,
    chooseAmount,
    chooseTenor,
    chooseBand,
    chooseIndustry,
    setRevenueDigits,
    chooseRevenue,
    submitRevenue,
    back,
    applySuggestion,
    markSent,
    restart,
  };
}

export type SmeQuizState = ReturnType<typeof useSmeQuiz>;

/** "1 tháng" / "3 tháng", "1 month" / "3 months". */
export function termLabel(months: number, t: (key: string) => string): string {
  return months === 1
    ? t("ratePage.quiz.monthsOne")
    : t("ratePage.quiz.monthsMany").replace("{n}", String(months));
}

/** "50 tr" / "1 tỷ" in Vietnamese, "50M" / "1B" in English. */
export function quizAmountLabel(amountVnd: number, locale: string): string {
  const vi = locale === "vi";
  if (amountVnd >= 1_000_000_000 && amountVnd % 100_000_000 === 0) {
    const b = amountVnd / 1_000_000_000;
    const text = vi ? String(b).replace(".", ",") : String(b);
    return vi ? `${text} tỷ` : `${text}B`;
  }
  const m = Math.round(amountVnd / 1_000_000);
  return vi ? `${m} tr` : `${m}M`;
}
