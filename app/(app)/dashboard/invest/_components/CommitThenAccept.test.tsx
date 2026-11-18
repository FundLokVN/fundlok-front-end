import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Commitment, FundingWindow } from "@/services/funding.service";
import { CommitThenAccept } from "./CommitThenAccept";
import { t } from "./test-t";

const commitMutate = vi.fn();
const withdrawMutate = vi.fn();
let pledges: Commitment[] = [];
vi.mock("@/hooks/use-funding", () => ({
  useMyCommitments: () => ({ data: pledges, isLoading: false }),
  useCommit: () => ({ mutate: commitMutate, isPending: false }),
  useWithdrawCommitment: () => ({
    mutate: withdrawMutate,
    isPending: false,
    variables: undefined,
  }),
}));
vi.mock("@/hooks/use-payment-accounts", () => ({
  usePaymentAccounts: () => ({
    data: [{ id: "acc-1", status: "APPROVED" }],
    isLoading: false,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

function round(over: Partial<FundingWindow> = {}): FundingWindow {
  return {
    id: "w-1",
    listing_id: "l-1",
    status: "OPEN",
    target_vnd: 100_000_000,
    min_raise_vnd: 50_000_000,
    min_ticket_vnd: 10_000_000,
    confirmed_vnd: 0,
    reserved_vnd: 0,
    capacity_vnd: 100_000_000,
    annual_rate_pct: "15.000",
    term_months: 2,
    window_start: "2026-11-02T02:00:00Z",
    window_end: "2026-11-14T17:00:00Z",
    days_left: 10,
    tranche_count: 0,
    flow: "COMMIT_THEN_ACCEPT",
    commit_closes_at: "2026-11-14T17:00:00Z",
    sme_deadline_at: "2026-11-15T08:00:00Z",
    pay_deadline_at: "2026-11-16T07:45:00Z",
    committed_total_vnd: 40_000_000,
    committed_pct: 40,
    sme_decision: null,
    sme_decided_at: null,
    ...over,
  };
}

const pledge: Commitment = {
  id: "c-1",
  window_id: "w-1",
  amount_vnd: 20_000_000,
  status: "PLEDGED",
  committed_at: "2026-11-03T03:00:00Z",
  my_committed_total_vnd: 20_000_000,
  window_committed_total_vnd: 40_000_000,
  window_target_vnd: 100_000_000,
};

function show(w: FundingWindow, amount = 20_000_000) {
  return render(
    <CommitThenAccept
      fundingWindow={w}
      amount={amount}
      businessName="Cong Ty ABC"
      locale="en"
      t={t}
    />,
  );
}

describe("CommitThenAccept (Money flow FINAL v1.0)", () => {
  beforeEach(() => {
    commitMutate.mockReset();
    withdrawMutate.mockReset();
    pledges = [];
  });

  it("pledges with Confirm, from the investor's approved account, no money", async () => {
    const user = userEvent.setup();
    show(round());
    expect(screen.getByTestId("round-timeline")).toBeInTheDocument();
    const confirm = screen.getByTestId("pledge-confirm");
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(confirm);
    expect(commitMutate).toHaveBeenCalledOnce();
    const vars = commitMutate.mock.calls[0][0];
    expect(vars.windowId).toBe("w-1");
    expect(vars.body).toMatchObject({
      amount_vnd: 20_000_000,
      ack_risk_disclosure: true,
      payment_account_id: "acc-1",
    });
    expect(vars.idempotencyKey).toBeTruthy();
  });

  it("lists the investor's pledges and withdraws one until Day 12 ends", async () => {
    const user = userEvent.setup();
    pledges = [pledge];
    show(round());
    const row = screen.getByTestId("pledge-c-1");
    await user.click(
      within(row).getByRole("button", {
        name: t("investConfirm.pledge.withdraw"),
      }),
    );
    expect(withdrawMutate).toHaveBeenCalledWith("c-1", expect.anything());
  });

  it("takes no pledge when the round is full, and offers no withdrawal once final", () => {
    pledges = [pledge];
    show(round({ committed_total_vnd: 100_000_000 }));
    expect(
      screen.getByText(t("investConfirm.pledge.fullTitle")),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pledge-form")).toBeNull();

    show(round({ status: "AWAITING_SME" }));
    expect(
      screen.getAllByText(t("investConfirm.pledge.awaitingSmeTitle")).length,
    ).toBeGreaterThan(0);
  });

  it("refuses an amount below the minimum unless it is exactly what is left", () => {
    show(round(), 5_000_000);
    expect(
      screen.getByText(t("investConfirm.pledge.amountTitle")),
    ).toBeInTheDocument();
    show(round({ committed_total_vnd: 95_000_000 }), 5_000_000);
    expect(screen.getByTestId("pledge-form")).toBeInTheDocument();
  });
});
