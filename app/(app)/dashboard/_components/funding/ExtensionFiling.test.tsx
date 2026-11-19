import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExtensionFiling } from "./ExtensionFiling";
import type { SmeRound } from "@/services/funding.service";

const fileMock = vi.fn();

vi.mock("@/hooks/use-repayment", () => ({
  useFileExtension: () => ({ mutate: fileMock, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({
    locale: "en",
    t: (key: string, values?: Record<string, string | number>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}));

const round = { id: "w-1" } as SmeRound;

describe("ExtensionFiling", () => {
  beforeEach(() => fileMock.mockReset());
  afterEach(() => vi.useRealTimers());

  it("files last month's revenue with its evidence from the 1st to the 5th", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-03T03:00:00Z")); // 10:00 on 3 Dec in Vietnam
    render(<ExtensionFiling round={round} />);

    expect(screen.getByTestId("extension-filing")).toHaveTextContent(
      'dashboard.sme.funding.extension.hint:{"month":"11/2026"}',
    );
    const submit = screen.getByRole("button", {
      name: "dashboard.sme.funding.extension.submit",
    });
    expect(submit).toBeDisabled(); // revenue and evidence first
    fireEvent.change(
      screen.getByLabelText(
        'dashboard.sme.funding.extension.revenue:{"month":"11/2026"}',
      ),
      { target: { value: "205.000.000" } },
    );
    fireEvent.click(
      screen.getByLabelText(
        "dashboard.sme.funding.extension.kinds.BANK_INFLOW",
      ),
    );
    const statement = new File(["%PDF-1.4"], "inflow.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(
      screen.getByLabelText("dashboard.sme.funding.extension.file"),
      { target: { files: [statement] } },
    );
    fireEvent.click(submit);
    expect(fileMock).toHaveBeenCalledWith(
      {
        periodMonth: "2026-11",
        revenueVnd: 205_000_000,
        evidenceKind: "BANK_INFLOW",
        file: statement,
      },
      expect.anything(),
    );
  });

  it("is not shown after the 5th", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-06T03:00:00Z"));
    render(<ExtensionFiling round={round} />);
    expect(screen.queryByTestId("extension-filing")).toBeNull();
  });
});
