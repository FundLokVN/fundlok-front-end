/**
 * The illustrative SME rate quiz on /rate.
 *
 * WHAT THIS IS
 * A short published formula that gives a first-time visitor an illustrative
 * monthly rate from five answers. It is NOT the underwriting engine, does not
 * call it, and is never carried into an application: a real applicant's rate
 * comes from the 0–100 score and the handbook rate formula after review.
 * Spec: backend repo docs/specs/rates/sme-rate-quiz.md (decided by Loc,
 * 20 Nov 2026).
 *
 * THE FORMULA
 *   rate (%/yr) = baseline + industry adjustment + burden adjustment
 *   burden      = amount ÷ (term months × monthly revenue)
 * Over 30% burden is declined (no rate). Every number lives in
 * SME_QUIZ_PARAMS; changing one means a new `version`, which is saved with
 * every lead so an old enquiry can be explained later.
 */

export const SME_QUIZ_PARAMS = {
  version: "sme-quiz-v1",
  baselineAnnualPct: 14.5,
  /**
   * The 15 industries ranked by the grading engine's Sector premium
   * (sector_reference_v1.yaml, v1-20260728), +0.1% per rank. A fixed copy:
   * the quiz never reads the engine's table.
   */
  industryAdjustmentPct: {
    "IT Services": 0.0,
    "Healthcare & Pharmacy": 0.1,
    "Professional Services": 0.2,
    "Education & Training": 0.3,
    "Beauty & Personal Care": 0.4,
    "Retail Trade": 0.5,
    "Food & Beverage": 0.6,
    Manufacturing: 0.7,
    "Electronics Retail": 0.8,
    "Logistics & Transport": 0.9,
    "Tourism & Hospitality": 1.0,
    "Furniture & Woodwork": 1.1,
    "Textile & Garment": 1.2,
    "Agriculture & Farming": 1.3,
    "Construction Materials": 1.4,
    Other: 0.7,
  } as Record<string, number>,
  /**
   * Burden brackets, checked in order: the first whose `maxPct` the burden
   * does not exceed applies. `inclusive: false` means strictly below.
   * Over the last bracket is declined.
   */
  burdenBrackets: [
    { maxPct: 10, inclusive: false, adjustmentPct: -0.5 },
    { maxPct: 20, inclusive: true, adjustmentPct: 0 },
    { maxPct: 25, inclusive: true, adjustmentPct: 0.5 },
    { maxPct: 30, inclusive: true, adjustmentPct: 1.0 },
  ],
  amountsVnd: [20_000_000, 30_000_000, 50_000_000, 80_000_000, 100_000_000],
  tenorsMonths: [1, 2, 3, 4, 5, 6],
  revenuePresetsVnd: [
    50_000_000, 100_000_000, 200_000_000, 500_000_000, 1_000_000_000,
  ],
} as const;

export const QUIZ_INDUSTRIES = Object.keys(
  SME_QUIZ_PARAMS.industryAdjustmentPct,
) as readonly string[];

export type OperatingBand = "LT_1Y" | "Y1_3" | "GT_3Y";
export const OPERATING_BANDS: readonly OperatingBand[] = [
  "LT_1Y",
  "Y1_3",
  "GT_3Y",
];

export interface QuizAnswers {
  amountVnd: number;
  tenorMonths: number;
  operatingBand: OperatingBand;
  industry: string;
  monthlyRevenueVnd: number;
}

export interface QuizSuggestion {
  /** Largest amount chip that passes at the visitor's term and revenue. */
  amountVnd: number | null;
  /** Shortest term that passes at the visitor's amount and revenue. */
  tenorMonths: number | null;
}

export type QuizResult =
  | {
      outcome: "QUOTED";
      annualRatePct: number;
      /** annual ÷ 12, rounded half-up to 2 decimals. What the visitor sees. */
      monthlyRatePct: number;
    }
  | { outcome: "DECLINED"; suggestion: QuizSuggestion };

/**
 * Burden bracket for amount ÷ (tenor × revenue), compared in integers so a
 * value sitting exactly on a boundary (e.g. 20%) is never misread through
 * floating point: amount × 100 vs threshold × tenor × revenue.
 */
function burdenAdjustment(
  amountVnd: number,
  tenorMonths: number,
  monthlyRevenueVnd: number,
): number | null {
  const lhs = BigInt(amountVnd) * BigInt(100);
  const base = BigInt(tenorMonths) * BigInt(monthlyRevenueVnd);
  for (const bracket of SME_QUIZ_PARAMS.burdenBrackets) {
    const rhs = BigInt(bracket.maxPct) * base;
    if (bracket.inclusive ? lhs <= rhs : lhs < rhs)
      return bracket.adjustmentPct;
  }
  return null;
}

/** Rounds half-up to 2 decimals without the 1.005 floating-point trap. */
export function roundHalfUp2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function passes(amountVnd: number, tenorMonths: number, revenue: number) {
  return burdenAdjustment(amountVnd, tenorMonths, revenue) !== null;
}

export function suggestFor(answers: QuizAnswers): QuizSuggestion {
  const { amountVnd, tenorMonths, monthlyRevenueVnd } = answers;
  const amounts = [...SME_QUIZ_PARAMS.amountsVnd].reverse();
  const amount =
    amounts.find(
      (a) => a < amountVnd && passes(a, tenorMonths, monthlyRevenueVnd),
    ) ?? null;
  const tenor =
    SME_QUIZ_PARAMS.tenorsMonths.find(
      (t) => t > tenorMonths && passes(amountVnd, t, monthlyRevenueVnd),
    ) ?? null;
  return { amountVnd: amount, tenorMonths: tenor };
}

export function computeQuizRate(answers: QuizAnswers): QuizResult {
  const { amountVnd, tenorMonths, monthlyRevenueVnd, industry } = answers;
  if (monthlyRevenueVnd <= 0 || tenorMonths <= 0) {
    throw new Error("monthly revenue and term must be positive");
  }
  const burdenAdj = burdenAdjustment(amountVnd, tenorMonths, monthlyRevenueVnd);
  if (burdenAdj === null) {
    return { outcome: "DECLINED", suggestion: suggestFor(answers) };
  }
  const industryAdj =
    SME_QUIZ_PARAMS.industryAdjustmentPct[industry] ??
    SME_QUIZ_PARAMS.industryAdjustmentPct.Other;
  // Work in hundredths of a percent so 14.5 + 0.5 - 0.5 is exactly 14.5.
  const annualHundredths =
    Math.round(SME_QUIZ_PARAMS.baselineAnnualPct * 100) +
    Math.round(industryAdj * 100) +
    Math.round(burdenAdj * 100);
  const annualRatePct = annualHundredths / 100;
  return {
    outcome: "QUOTED",
    annualRatePct,
    monthlyRatePct: roundHalfUp2(annualHundredths / 1200),
  };
}

/** "1,21" in Vietnamese, "1.21" in English. Always two decimals. */
export function formatRatePct(value: number, locale: string): string {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
