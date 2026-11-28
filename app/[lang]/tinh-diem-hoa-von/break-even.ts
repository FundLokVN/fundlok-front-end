export const example = {
  fixedCosts: 24_000_000,
  orderPrice: 50_000,
  orderCost: 30_000,
  openDays: 30,
};

export type BreakEvenInputs = Record<keyof typeof example, string>;

function readWholeNumber(value: string) {
  const text = value.trim().replace(/[\u00a0\u202f]/g, " ");
  if (!/^\d+$/.test(text) && !/^\d{1,3}([., ])\d{3}(?:\1\d{3})*$/.test(text)) {
    return NaN;
  }
  return Number(text.replace(/[., ]/g, ""));
}

export function calculateBreakEven(inputs: BreakEvenInputs) {
  const fixedCosts = readWholeNumber(inputs.fixedCosts);
  const orderPrice = readWholeNumber(inputs.orderPrice);
  const orderCost = readWholeNumber(inputs.orderCost);
  const openDays = readWholeNumber(inputs.openDays);
  if (
    ![fixedCosts, orderPrice, orderCost, openDays].every(
      Number.isSafeInteger,
    ) ||
    orderPrice === 0 ||
    openDays < 1 ||
    openDays > 31
  ) {
    return { status: "invalid" } as const;
  }

  const perOrder = orderPrice - orderCost;
  if (perOrder <= 0) return { status: "noBreakEven" } as const;

  const ordersPerMonth = Math.ceil(fixedCosts / perOrder);
  const revenue = ordersPerMonth * orderPrice;
  if (!Number.isSafeInteger(revenue)) return { status: "invalid" } as const;

  return {
    status: "ok",
    perOrder,
    ordersPerMonth,
    ordersPerDay: Math.ceil(ordersPerMonth / openDays),
    revenue,
  } as const;
}
