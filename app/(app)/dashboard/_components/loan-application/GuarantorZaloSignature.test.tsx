import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  ListingDocuments,
  SignedListingDocument,
} from "@/services/loans.service";
import { t } from "../../invest/_components/test-t";
import { GuarantorZaloSignature } from "./GuarantorZaloSignature";

// input-otp asks the document which element is under the caret; jsdom has no
// layout, so there is never one.
document.elementFromPoint = () => null;

const sendMutate = vi.fn();
const signMutate = vi.fn();
let send: { mutate: typeof sendMutate; isPending: boolean };
let sign: { mutate: typeof signMutate; isPending: boolean; isSuccess: boolean };
vi.mock("@/hooks/use-loans", () => ({
  useSendGuarantorCode: () => send,
  useSignAsGuarantor: () => sign,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({ locale: "en", setLocale: vi.fn(), t }),
}));

const unsigned: SignedListingDocument = {
  signed: false,
  signed_at: null,
  file_name: null,
  checks: null,
  missing_details: [],
  waiting_for: null,
};
const onFile: SignedListingDocument = {
  ...unsigned,
  signed: true,
  signed_at: "2026-11-18T08:00:00Z",
};

function docs(over: Partial<ListingDocuments> = {}): ListingDocuments {
  return {
    ready: true,
    published: false,
    guarantor_verified: true,
    guarantor_address: "45 Le Loi",
    guarantor_address_source: "SME",
    service_agreement: onFile,
    standing_offer: onFile,
    loan_contract: onFile,
    guarantor_missing: [],
    guarantor_signed_by: null,
    guarantor_signed_at: null,
    guarantor_phone: "0903***489",
    ...over,
  } as ListingDocuments;
}

function renderCard(d: ListingDocuments) {
  return render(
    <GuarantorZaloSignature applicationId="app-1" docs={d} locale="en" t={t} />,
  );
}

describe("GuarantorZaloSignature (Money flow FINAL v1.0, Day 0)", () => {
  beforeEach(() => {
    sendMutate.mockReset();
    signMutate.mockReset();
    send = { mutate: sendMutate, isPending: false };
    sign = { mutate: signMutate, isPending: false, isSuccess: false };
  });

  it("says what the guarantor still lacks before signing opens", () => {
    renderCard(docs({ guarantor_missing: ["EKYC", "PHONE"] }));
    const notice = screen.getByTestId("guarantor-not-ready");
    expect(notice).toHaveTextContent(
      t("dashboard.sme.signing.guarantor.missing.EKYC"),
    );
    expect(notice).toHaveTextContent(
      t("dashboard.sme.signing.guarantor.missing.PHONE"),
    );
    expect(screen.queryByTestId("guarantor-code-send")).toBeNull();
  });

  it("waits for the SME's signed Standing Offer and Loan Contract", () => {
    renderCard(docs({ loan_contract: unsigned }));
    expect(screen.getByTestId("guarantor-waiting")).toBeInTheDocument();
    expect(screen.queryByTestId("guarantor-code-send")).toBeNull();
  });

  it("sends the Zalo code, then signs with the six digits", async () => {
    const user = userEvent.setup();
    sendMutate.mockImplementation((_v, opts) =>
      opts.onSuccess({
        phone: "0903***489",
        channel: "zalo",
        expires_in: 300,
        resend_in: 60,
      }),
    );
    renderCard(docs());
    expect(screen.getByTestId("guarantor-code")).toHaveTextContent(
      "0903***489",
    );
    await user.click(screen.getByTestId("guarantor-code-send"));
    expect(sendMutate).toHaveBeenCalledOnce();
    expect(
      screen.getByText(
        t("common.zaloCode.sentZalo").replace("{phone}", "0903***489"),
      ),
    ).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "123456");
    expect(signMutate).toHaveBeenCalledWith("123456", expect.anything());
  });

  it("shows the signature once the guarantor has signed", () => {
    renderCard(
      docs({
        guarantor_signed_by: "ZALO_OTP",
        guarantor_signed_at: "2026-11-18T09:00:00Z",
      }),
    );
    expect(screen.getByTestId("guarantor-signed")).toHaveTextContent(
      t("dashboard.sme.signing.guarantor.signedTitle"),
    );
  });
});
