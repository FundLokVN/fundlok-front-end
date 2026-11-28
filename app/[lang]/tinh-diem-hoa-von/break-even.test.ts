import { describe, expect, it } from "vitest";
import { calculateBreakEven } from "./break-even";

const cafe = {
  fixedCosts: "24.000.000",
  orderPrice: "50,000",
  orderCost: "30 000",
  openDays: "30",
};

describe("café break-even calculator", () => {
  it("calculates monthly and daily targets from grouped VND inputs", () => {
    expect(calculateBreakEven(cafe)).toEqual({
      status: "ok",
      perOrder: 20_000,
      ordersPerMonth: 1200,
      ordersPerDay: 40,
      revenue: 60_000_000,
    });
  });

  it("rounds up to whole orders and bases revenue on the monthly target", () => {
    expect(
      calculateBreakEven({ ...cafe, fixedCosts: "24000001", openDays: "26" }),
    ).toMatchObject({
      ordersPerMonth: 1201,
      ordersPerDay: 47,
      revenue: 60_050_000,
    });
  });

  it("allows zero fixed costs or zero variable cost per order", () => {
    expect(
      calculateBreakEven({ ...cafe, fixedCosts: "0", orderCost: "0" }),
    ).toMatchObject({ status: "ok", ordersPerMonth: 0, revenue: 0 });
  });

  it.each(["50000", "50001"])(
    "explains when order cost %s leaves no contribution",
    (orderCost) => {
      expect(calculateBreakEven({ ...cafe, orderCost })).toEqual({
        status: "noBreakEven",
      });
    },
  );

  it.each([
    { orderPrice: "" },
    { orderPrice: "0" },
    { fixedCosts: "-24000000" },
    { orderCost: "3,00" },
    { openDays: "32" },
    { openDays: "0" },
    { fixedCosts: "9007199254740991", orderPrice: "2", orderCost: "1" },
  ])("rejects unusable inputs %j", (inputs) => {
    expect(calculateBreakEven({ ...cafe, ...inputs })).toEqual({
      status: "invalid",
    });
  });
});
