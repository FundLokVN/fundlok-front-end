import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Tranche } from "@/services/funding.service";
import { Day14ContractStep } from "./Day14ContractStep";
import { t } from "./test-t";

document.elementFromPoint = () => null;

const sendMutate = vi.fn();
const signMutate = vi.fn();
vi.mock("@/hooks/use-funding", () => ({
  useTrancheContractPdf: () => ({
    data: { blob: new Blob(["%PDF"]), filename: "c.pdf" },
    isError: false,
  }),
  useSendContractCode: () => ({ mutate: sendMutate, isPending: false }),
  useSignContract: () => ({
    mutate: signMutate,
    isPending: false,
    isSuccess: false,
  }),
}));
vi.mock("@/hooks/use-object-url", () => ({
  useObjectUrl: (blob: Blob | null) => (blob ? "blob:contract" : null),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({ locale: "en", setLocale: vi.fn(), t }),
}));

const ticket = {
  id: "tr-1",
  window_id: "w-1",
  amount_vnd: 30_000_000,
  status: "RESERVED",
  reference_code: "FLAB12CD34",
} as Tranche;

describe("Day14ContractStep (Money flow FINAL v1.0, Day 14)", () => {
  beforeEach(() => {
    sendMutate.mockReset();
    signMutate.mockReset();
  });

  it("asks for the code only after the investor ticks that they sign, then signs with it", async () => {
    const user = userEvent.setup();
    sendMutate.mockImplementation((_id, opts) =>
      opts.onSuccess({
        sent_to_masked: "0903***489",
        channel: "zalo",
        expires_in_seconds: 300,
        resend_after_seconds: 60,
      }),
    );
    render(
      <Day14ContractStep
        ticket={ticket}
        payDeadlineAt="2026-11-16T07:45:00Z"
        phone="0903***489"
        firstTime
        locale="en"
        t={t}
      />,
    );
    expect(screen.getByTestId("day14-first-time")).toBeInTheDocument();
    const send = screen.getByTestId("day14-code-send");
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(send);
    expect(sendMutate).toHaveBeenCalledWith("tr-1", expect.anything());
    await user.type(screen.getByRole("textbox"), "654321");
    expect(signMutate).toHaveBeenCalledWith(
      { trancheId: "tr-1", code: "654321" },
      expect.anything(),
    );
  });

  it("points to the profile when there is no phone for the Zalo code", () => {
    render(
      <Day14ContractStep
        ticket={ticket}
        payDeadlineAt={null}
        phone={null}
        firstTime={false}
        locale="en"
        t={t}
      />,
    );
    expect(screen.getByTestId("day14-code-no-phone")).toBeInTheDocument();
  });
});
