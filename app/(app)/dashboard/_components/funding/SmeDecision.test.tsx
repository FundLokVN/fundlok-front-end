import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SmeRound, WindowLoanContracts } from "@/services/funding.service";
import { t } from "../../invest/_components/test-t";
import { SmeDecision } from "./SmeDecision";

document.elementFromPoint = () => null;

const decideMutate = vi.fn();
const uploadMutate = vi.fn();
let contracts: WindowLoanContracts;
vi.mock("@/hooks/use-funding", () => ({
  useWindowLoanContracts: () => ({ data: contracts, isLoading: false }),
  useDownloadWindowLoanContract: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadWindowLoanContract: () => ({
    mutate: uploadMutate,
    isPending: false,
  }),
  useSendWindowGuarantorCode: () => ({ mutate: vi.fn(), isPending: false }),
  useSignWindowAsGuarantor: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  }),
  useWindowDecision: () => ({ mutate: decideMutate, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({ locale: "en", setLocale: vi.fn(), t }),
}));

function round(over: Partial<SmeRound> = {}): SmeRound {
  return {
    id: "w-1",
    listing_id: "l-1",
    status: "AWAITING_SME",
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
    days_left: 0,
    tranche_count: 0,
    flow: "COMMIT_THEN_ACCEPT",
    commit_closes_at: "2026-11-14T17:00:00Z",
    sme_deadline_at: "2026-11-15T08:00:00Z",
    pay_deadline_at: "2026-11-16T07:45:00Z",
    committed_total_vnd: 30_000_000,
    project_id: "p-1",
    project_name: "ABC",
    tickets: [],
    closing_started_at: null,
    close_wait_until: null,
    repayment_start_date: null,
    ...over,
  } as SmeRound;
}

function day13(over: Partial<WindowLoanContracts> = {}): WindowLoanContracts {
  return {
    window_id: "w-1",
    status: "AWAITING_SME",
    pledged_vnd: 30_000_000,
    target_vnd: 100_000_000,
    sme_deadline_at: "2026-11-15T08:00:00Z",
    signing_cutoff_at: "2026-11-15T05:00:00Z",
    all_signed: false,
    guarantor_signed_at: null,
    guarantor_phone: "0903***489",
    contracts: [
      {
        id: "k-1",
        contract_no: "AB12-01/HĐCV-FL",
        lender_name: "N*** A",
        amount_vnd: 30_000_000,
        status: "GENERATED",
        generated_at: "2026-11-14T17:00:00Z",
        sme_signed_at: null,
        investor_signed_at: null,
      },
    ],
    ...over,
  };
}

describe("SmeDecision (Money flow FINAL v1.0, Day 13)", () => {
  beforeEach(() => {
    decideMutate.mockReset();
    uploadMutate.mockReset();
    contracts = day13();
  });

  it("lists each investor's contract, says the noon cut-off and keeps Accept shut until all are signed", () => {
    render(<SmeDecision round={round()} />);
    expect(screen.getByTestId("contract-k-1")).toHaveTextContent(
      "AB12-01/HĐCV-FL",
    );
    expect(screen.getByTestId("signing-cutoff")).toBeInTheDocument();
    expect(screen.getByTestId("decision-accept")).toBeDisabled();
    expect(screen.getByTestId("accept-needs-signing")).toBeInTheDocument();
  });

  it("uploads a signed copy for its contract", async () => {
    const user = userEvent.setup();
    render(<SmeDecision round={round()} />);
    const file = new File(["%PDF-1.4"], "signed.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByTestId("contract-file-k-1"), file);
    expect(uploadMutate).toHaveBeenCalledWith(
      { contractId: "k-1", file },
      expect.anything(),
    );
  });

  it("accepts once every contract is signed, and declines only after a confirm", async () => {
    const user = userEvent.setup();
    contracts = day13({
      all_signed: true,
      signing_cutoff_at: null,
      contracts: [
        {
          ...day13().contracts[0],
          status: "SME_SIGNED",
          sme_signed_at: "2026-11-15T02:00:00Z",
        },
      ],
    });
    render(<SmeDecision round={round()} />);
    await user.click(screen.getByTestId("decision-accept"));
    expect(decideMutate.mock.calls[0][0]).toMatchObject({
      windowId: "w-1",
      decision: "ACCEPT",
    });
    await user.click(screen.getByTestId("decision-decline"));
    await user.click(screen.getByTestId("decision-decline-confirm"));
    expect(decideMutate.mock.calls[1][0]).toMatchObject({
      decision: "DECLINE",
    });
  });

  it("explains the silence rule while investors are still pledging", () => {
    render(<SmeDecision round={round({ status: "OPEN" })} />);
    expect(screen.getByTestId("sme-decision-open")).toHaveTextContent(
      t("dashboard.sme.decision.silenceRule"),
    );
  });
});
