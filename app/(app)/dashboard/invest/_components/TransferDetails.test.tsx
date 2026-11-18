import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { PaymentInstructions } from "@/services/funding.service";
import { TransferDetails } from "./TransferDetails";
import { t } from "./test-t";

let payment: { isLoading: boolean; data?: PaymentInstructions };
vi.mock("@/hooks/use-funding", () => ({
  usePaymentInstructions: () => payment,
}));

const instructions = (holdMs: number): PaymentInstructions => ({
  bank_name: "Techcombank",
  bank_bin: "970407",
  account_number: "19036789012",
  account_name: "CONG TY DELTA FOODS",
  amount_vnd: 20_000_000,
  reference_code: "FLAB12CD34",
  vietqr_payload: "000201010212...6304ABCD",
  hold_expires_at: new Date(Date.now() + holdMs).toISOString(),
});

describe("TransferDetails", () => {
  beforeEach(() => {
    payment = { isLoading: false, data: instructions(2 * 3600 * 1000) };
  });

  it("shows the business's account, the amount, the memo and the QR", () => {
    render(<TransferDetails trancheId="tr-1" locale="en" t={t} />);

    const details = screen.getByTestId("transfer-details");
    expect(details).toHaveTextContent("Techcombank");
    expect(details).toHaveTextContent("19036789012");
    expect(details).toHaveTextContent("CONG TY DELTA FOODS");
    expect(details).toHaveTextContent("FLAB12CD34");
    expect(screen.getByTestId("transfer-qr")).toHaveAttribute(
      "data-qr-value",
      "000201010212...6304ABCD",
    );
    expect(screen.getByTestId("transfer-deadline")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy Payment memo" }),
    ).toBeInTheDocument();
  });

  describe("15-minute QR", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      payment = { isLoading: false, data: instructions(2 * 3600 * 1000) };
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const tick = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms);
      });

    it("counts down 15 minutes, not the whole 2-hour hold", () => {
      render(<TransferDetails trancheId="tr-1" locale="en" t={t} />);

      expect(screen.getByTestId("transfer-deadline")).toHaveTextContent(
        "15:00 left",
      );
      tick(60 * 1000);
      expect(screen.getByTestId("transfer-deadline")).toHaveTextContent(
        "14:00 left",
      );
    });

    it("blurs the QR after 15 minutes and offers a new one", () => {
      render(<TransferDetails trancheId="tr-1" locale="en" t={t} />);
      tick(15 * 60 * 1000);

      expect(screen.getByText("This QR has expired")).toBeInTheDocument();
      expect(screen.queryByTestId("transfer-deadline")).toBeNull();
      expect(screen.getByTestId("transfer-qr")).toHaveClass("blur-sm");
      // The hold is still live: this is not the "reserve again" case.
      expect(screen.queryByText("The time to transfer has passed")).toBeNull();
    });

    it("starts a fresh 15 minutes when the investor gets a new QR", () => {
      render(<TransferDetails trancheId="tr-1" locale="en" t={t} />);
      tick(16 * 60 * 1000);

      fireEvent.click(screen.getByRole("button", { name: "Get a new QR" }));

      expect(screen.getByTestId("transfer-deadline")).toHaveTextContent(
        "15:00 left",
      );
      expect(screen.getByTestId("transfer-qr")).not.toHaveClass("blur-sm");
    });

    it("never runs past the reservation hold", () => {
      payment = { isLoading: false, data: instructions(5 * 60 * 1000) };
      render(<TransferDetails trancheId="tr-1" locale="en" t={t} />);

      expect(screen.getByTestId("transfer-deadline")).toHaveTextContent(
        "05:00 left",
      );
      tick(5 * 60 * 1000);
      expect(
        screen.getByText("The time to transfer has passed"),
      ).toBeInTheDocument();
      expect(screen.queryByText("This QR has expired")).toBeNull();
    });
  });

  it("says when the time to transfer has passed", () => {
    payment = { isLoading: false, data: instructions(-60 * 1000) };
    render(<TransferDetails trancheId="tr-1" locale="en" t={t} />);

    expect(
      screen.getByText("The time to transfer has passed"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("transfer-deadline")).toBeNull();
  });

  it("offers to reserve again once the time has passed", () => {
    payment = { isLoading: false, data: instructions(-60 * 1000) };
    const onReserveAgain = vi.fn();
    render(
      <TransferDetails
        trancheId="tr-1"
        locale="en"
        t={t}
        onReserveAgain={onReserveAgain}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reserve again" }));
    expect(onReserveAgain).toHaveBeenCalledOnce();
  });

  it("does not offer to reserve again while the hold is live", () => {
    render(
      <TransferDetails
        trancheId="tr-1"
        locale="en"
        t={t}
        onReserveAgain={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Reserve again" })).toBeNull();
  });

  it("says so when the details cannot load", () => {
    payment = { isLoading: false, data: undefined };
    render(<TransferDetails trancheId="tr-1" locale="en" t={t} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load the transfer details",
    );
  });
});
