import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  AdminProjectDetail,
  AdminUserRow,
} from "@/services/admin.service";
import { t } from "../../dashboard/invest/_components/test-t";
import { ProjectPreviewSheet } from "./ProjectPreviewSheet";
import { UserPreviewSheet } from "./UserPreviewSheet";

const decideApplication = vi.fn();
const setUserStatus = vi.fn();

const project: AdminProjectDetail = {
  id: "p-1",
  legal_name: "Delta Foods",
  tax_id: null,
  industry: null,
  status: "PENDING",
  address: null,
  incorporation_date: null,
  created_at: null,
  kyb: null,
  applications: [
    {
      id: "app-1",
      requested_amount: 50_000_000,
      purpose: null,
      repayment_preference: null,
      status: "SUBMITTED",
      admin_approval: "PENDING",
      submitted_at: null,
      decided_at: null,
      decision_note: null,
      created_at: "2026-11-02T05:26:00Z",
      documents: [],
      score_run: null,
      missing_documents: ["charter"],
    },
  ],
};

const account: AdminUserRow = {
  id: "sme-1",
  email: "owner@example.com",
  full_name: "Delta Owner",
  role: "SME",
  status: "ACTIVE",
};

vi.mock("@/hooks/use-admin", () => ({
  useAdminProjectDetail: () => ({ data: project }),
  useDecideApplication: () => ({ mutateAsync: decideApplication }),
  useResolveKybVerification: () => ({ mutateAsync: vi.fn() }),
  useSetUserStatus: () => ({ mutateAsync: setUserStatus }),
  useAdminUserDetail: () => ({}),
}));
vi.mock("@/hooks/use-underwriting", () => ({
  useApproveScoreRun: () => ({ mutateAsync: vi.fn() }),
  useStartScoreRun: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/use-authentication", () => ({
  useCurrentUser: () => ({ data: { id: "admin-1", role: "ADMIN" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({ locale: "en", t }),
}));
vi.mock("./DocumentViewerDialog", () => ({ DocumentViewerDialog: () => null }));
vi.mock("./ProjectFunding", () => ({ ProjectFunding: () => null }));
vi.mock("./UserRoleSection", () => ({ UserRoleSection: () => null }));
vi.mock("../kyc-reviews/_components/KybReviewSheet", () => ({
  KybReviewSheet: () => null,
}));
vi.mock("../kyc-reviews/_components/KycReviewSheet", () => ({
  KycReviewSheet: () => null,
}));

describe("Admin preview confirmations", () => {
  beforeEach(() => {
    decideApplication.mockReset();
    setUserStatus.mockReset();
  });

  it("rejects the selected loan application only after confirmation", async () => {
    const user = userEvent.setup();
    render(
      <ProjectPreviewSheet projectId={project.id} onOpenChange={vi.fn()} />,
    );
    const reject = screen.getByRole("button", { name: "Reject" });
    await user.click(reject);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delta Foods");
    expect(dialog).toHaveTextContent("50,000,000");
    expect(dialog).toHaveTextContent("marked as rejected");
    expect(decideApplication).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(decideApplication).not.toHaveBeenCalled();
    await user.click(reject);
    await user.click(screen.getByRole("button", { name: "Confirm rejection" }));
    expect(decideApplication).toHaveBeenCalledExactlyOnceWith({
      id: "app-1",
      body: { decision: "REJECTED", note: null },
    });
  });

  it("suspends the named user only after confirmation", async () => {
    const user = userEvent.setup();
    render(<UserPreviewSheet user={account} onOpenChange={vi.fn()} />);
    const suspend = screen.getByRole("button", { name: "Suspend" });
    await user.click(suspend);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delta Owner (owner@example.com)");
    expect(dialog).toHaveTextContent("will lose access");
    expect(setUserStatus).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(setUserStatus).not.toHaveBeenCalled();
    await user.click(suspend);
    await user.click(
      screen.getByRole("button", { name: "Confirm suspension" }),
    );
    expect(setUserStatus).toHaveBeenCalledExactlyOnceWith({
      id: account.id,
      body: { status: "SUSPENDED", note: null },
    });
  });
});
