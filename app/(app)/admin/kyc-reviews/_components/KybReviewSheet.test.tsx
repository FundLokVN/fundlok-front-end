import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KybReviewSheet } from "./KybReviewSheet";
import type { AdminKybReview } from "@/services/admin.service";

// A manual-mode KYB approval records what the SME's contracts print for its
// legal representative and head office (AM-E17): without them the business
// cannot sign.

const mutateAsyncMock = vi.fn();
const toastMock = vi.fn();
let mockData: AdminKybReview | null = null;

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/hooks/use-authentication", () => ({
  useCurrentUser: () => ({ data: { id: "admin-1" } }),
}));

vi.mock("@/hooks/use-admin", () => ({
  useAdminKybVerification: () => ({
    data: mockData,
    isLoading: false,
    isError: false,
  }),
  useResolveKybReview: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  useAdminKybVerifications: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("./KybCertificatePreview", () => ({
  KybCertificatePreview: () => null,
}));

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({
    locale: "en",
    setLocale: vi.fn(),
    t: (key: string, values?: Record<string, string | number>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}));

const manualAttempt: AdminKybReview = {
  id: "kyb-1",
  status: "MANUAL_REVIEW",
  is_approved: false,
  rejection_reason: null,
  document_type: "COMPANY",
  tax_code: "1501167629",
  license_code: null,
  business_name: "CONG TY CO PHAN FUNDLOK",
  business_type: null,
  company_address: "12 Nguyen Hue, Quan 1",
  provider_checked: false,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: null,
  user: {
    id: "sme-1",
    email: "sme@example.com",
    full_name: "Tran Van Owner",
    status: "ACTIVE",
    created_at: "2026-10-01T00:00:00Z",
  },
  kyc_full_name: "TRAN VAN OWNER",
  kyc_person_number: "079123456789",
  projects: ["Fundlok JSC"],
};

const field = (key: string) => screen.getByLabelText(`admin.kybReviews.${key}`);
const approve = () =>
  screen.getByRole("button", { name: /admin\.kycReviews\.approve/i });

describe("KybReviewSheet: signing details on a manual approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData = { ...manualAttempt };
    mutateAsyncMock.mockResolvedValue({ missing_signing_details: [] });
  });

  it("sends the legal representative and head office with the approval", async () => {
    render(<KybReviewSheet verificationId="kyb-1" onOpenChange={vi.fn()} />);
    // The address on file pre-fills, like the declared tax code.
    expect(field("inputCompanyAddress")).toHaveValue("12 Nguyen Hue, Quan 1");
    fireEvent.change(field("inputRepresentativeName"), {
      target: { value: "  Tran   Van Owner " },
    });
    fireEvent.change(field("inputRepresentativePosition"), {
      target: { value: "Giám đốc" },
    });
    fireEvent.click(approve());

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    expect(mutateAsyncMock.mock.calls[0][0]).toEqual({
      id: "kyb-1",
      body: {
        decision: "APPROVED",
        note: null,
        business_name: "CONG TY CO PHAN FUNDLOK",
        tax_code: "1501167629",
        legal_representative_name: "Tran Van Owner",
        legal_representative_position: "Giám đốc",
        company_address: "12 Nguyen Hue, Quan 1",
      },
    });
  });

  it("sends nothing blank: an empty field goes as null", async () => {
    render(<KybReviewSheet verificationId="kyb-1" onOpenChange={vi.fn()} />);
    fireEvent.change(field("inputCompanyAddress"), {
      target: { value: "   " },
    });
    fireEvent.click(approve());

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));
    const body = mutateAsyncMock.mock.calls[0][0].body;
    expect(body.legal_representative_name).toBeNull();
    expect(body.legal_representative_position).toBeNull();
    expect(body.company_address).toBeNull();
  });

  it("blocks a position with no name, as the backend does", () => {
    render(<KybReviewSheet verificationId="kyb-1" onOpenChange={vi.fn()} />);
    fireEvent.change(field("inputRepresentativePosition"), {
      target: { value: "Giám đốc" },
    });
    expect(approve()).toBeDisabled();
    expect(
      screen.getByText("admin.kybReviews.positionNeedsName"),
    ).toBeInTheDocument();
  });

  it("tells staff what the contracts would still leave blank", async () => {
    mutateAsyncMock.mockResolvedValue({
      missing_signing_details: ["LEGAL_REPRESENTATIVE"],
    });
    render(<KybReviewSheet verificationId="kyb-1" onOpenChange={vi.fn()} />);
    fireEvent.click(approve());

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
    expect(toastMock.mock.calls[0][0].description).toBe(
      `admin.kybReviews.signingDetailsMissing:${JSON.stringify({
        fields: "admin.kybReviews.signingDetails.LEGAL_REPRESENTATIVE",
      })}`,
    );
  });

  it("asks nothing extra on a provider-read attempt", () => {
    mockData = { ...manualAttempt, provider_checked: true };
    render(<KybReviewSheet verificationId="kyb-1" onOpenChange={vi.fn()} />);
    expect(
      screen.queryByLabelText("admin.kybReviews.inputRepresentativeName"),
    ).not.toBeInTheDocument();
  });
});
