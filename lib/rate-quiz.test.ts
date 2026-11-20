import { describe, expect, it } from "vitest";
import {
  computeQuizRate,
  formatRatePct,
  QUIZ_INDUSTRIES,
  roundHalfUp2,
  SME_QUIZ_PARAMS,
  type QuizAnswers,
} from "./rate-quiz";

const M = 1_000_000;

function answers(overrides: Partial<QuizAnswers> = {}): QuizAnswers {
  return {
    amountVnd: 50 * M,
    tenorMonths: 6,
    operatingBand: "Y1_3",
    industry: "Retail Trade",
    monthlyRevenueVnd: 100 * M,
    ...overrides,
  };
}

function quoted(a: QuizAnswers) {
  const result = computeQuizRate(a);
  if (result.outcome !== "QUOTED") throw new Error("expected a rate");
  return result;
}

describe("computeQuizRate — the spec's worked examples", () => {
  it.each([
    // industry, amount, tenor, revenue, annual, monthly
    ["Retail Trade", 50, 6, 100, 14.5, 1.21],
    ["Retail Trade", 30, 2, 100, 15.0, 1.25],
    ["Retail Trade", 100, 5, 100, 15.0, 1.25],
    ["Agriculture & Farming", 100, 3, 150, 16.3, 1.36],
    ["Retail Trade", 60, 2, 100, 16.0, 1.33],
    ["IT Services", 50, 6, 100, 14.0, 1.17],
    ["Construction Materials", 60, 2, 100, 16.9, 1.41],
  ])(
    "%s %iM over %i months at %iM/month",
    (industry, amt, tenor, rev, annual, monthly) => {
      const r = quoted(
        answers({
          industry,
          amountVnd: amt * M,
          tenorMonths: tenor,
          monthlyRevenueVnd: rev * M,
        }),
      );
      expect(r.annualRatePct).toBe(annual);
      expect(r.monthlyRatePct).toBe(monthly);
    },
  );

  it("declines over 30% and suggests a smaller chip or a longer term", () => {
    const r = computeQuizRate(
      answers({
        amountVnd: 100 * M,
        tenorMonths: 2,
        monthlyRevenueVnd: 120 * M,
      }),
    );
    expect(r).toEqual({
      outcome: "DECLINED",
      suggestion: { amountVnd: 50 * M, tenorMonths: 3 },
    });
  });

  it("declines with no suggestion when nothing passes", () => {
    const r = computeQuizRate(
      answers({ amountVnd: 100 * M, tenorMonths: 6, monthlyRevenueVnd: 5 * M }),
    );
    expect(r).toEqual({
      outcome: "DECLINED",
      suggestion: { amountVnd: null, tenorMonths: null },
    });
  });
});

describe("burden bracket boundaries (confirmed by Loc)", () => {
  // 100M revenue, 1 month: burden% = amount in millions.
  const at = (amountM: number) =>
    computeQuizRate(
      answers({
        industry: "IT Services",
        amountVnd: amountM * M,
        tenorMonths: 1,
        monthlyRevenueVnd: 100 * M,
      }),
    );

  it("just under 10% is −0.5, exactly 10% is 0", () => {
    // 9.99%: 9.99M of 100M
    const under = computeQuizRate(
      answers({
        industry: "IT Services",
        amountVnd: 9_990_000,
        tenorMonths: 1,
        monthlyRevenueVnd: 100 * M,
      }),
    );
    expect(under).toMatchObject({ annualRatePct: 14.0 });
    expect(at(10)).toMatchObject({ annualRatePct: 14.5 });
  });

  it("exactly 20% is 0", () => {
    expect(at(20)).toMatchObject({ annualRatePct: 14.5 });
  });

  it("exactly 25% is +0.5", () => {
    expect(at(25)).toMatchObject({ annualRatePct: 15.0 });
  });

  it("exactly 30% is +1.0 and still quoted", () => {
    expect(at(30)).toMatchObject({ outcome: "QUOTED", annualRatePct: 15.5 });
  });

  it("just over 30% is declined", () => {
    const over = computeQuizRate(
      answers({
        industry: "IT Services",
        amountVnd: 30_000_001,
        tenorMonths: 1,
        monthlyRevenueVnd: 100 * M,
      }),
    );
    expect(over.outcome).toBe("DECLINED");
  });

  it("is exact on huge revenues (no floating-point drift)", () => {
    const r = computeQuizRate(
      answers({
        amountVnd: 20 * M,
        tenorMonths: 6,
        monthlyRevenueVnd: 10 ** 15,
      }),
    );
    expect(r).toMatchObject({ outcome: "QUOTED" });
  });
});

describe("industry adjustments", () => {
  it("covers the 15 industries plus Other", () => {
    expect(QUIZ_INDUSTRIES).toHaveLength(16);
    expect(QUIZ_INDUSTRIES).toContain("Other");
  });

  it("steps 0.0 to 1.4 in 0.1 by Sector-premium rank, Other at 0.7", () => {
    const ranked = [
      "IT Services",
      "Healthcare & Pharmacy",
      "Professional Services",
      "Education & Training",
      "Beauty & Personal Care",
      "Retail Trade",
      "Food & Beverage",
      "Manufacturing",
      "Electronics Retail",
      "Logistics & Transport",
      "Tourism & Hospitality",
      "Furniture & Woodwork",
      "Textile & Garment",
      "Agriculture & Farming",
      "Construction Materials",
    ];
    ranked.forEach((industry, i) => {
      // burden 8.3% → −0.5, so annual = 14.0 + rank step
      const r = quoted(answers({ industry }));
      expect(r.annualRatePct).toBeCloseTo(14.0 + i * 0.1, 10);
    });
    expect(quoted(answers({ industry: "Other" })).annualRatePct).toBe(14.7);
  });

  it("every quoted monthly rate is within the backend's bounds check", () => {
    for (const industry of QUIZ_INDUSTRIES) {
      for (const amountVnd of SME_QUIZ_PARAMS.amountsVnd) {
        for (const tenorMonths of SME_QUIZ_PARAMS.tenorsMonths) {
          for (const monthlyRevenueVnd of SME_QUIZ_PARAMS.revenuePresetsVnd) {
            const r = computeQuizRate({
              industry,
              amountVnd,
              tenorMonths,
              monthlyRevenueVnd,
              operatingBand: "Y1_3",
            });
            if (r.outcome === "QUOTED") {
              expect(r.monthlyRatePct).toBeGreaterThanOrEqual(1.16);
              expect(r.monthlyRatePct).toBeLessThanOrEqual(1.41);
            }
          }
        }
      }
    }
  });
});

describe("rounding and display", () => {
  it("rounds half-up", () => {
    expect(roundHalfUp2(1.005)).toBe(1.01);
    expect(roundHalfUp2(14.5 / 12)).toBe(1.21);
  });

  it("formats with the locale's decimal mark and two decimals", () => {
    expect(formatRatePct(1.2, "vi")).toBe("1,20");
    expect(formatRatePct(1.21, "en")).toBe("1.21");
  });
});
