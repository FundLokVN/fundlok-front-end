import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { LenderStanding } from "@/services/funding.service";
import type { ApiError } from "@/lib/types";
import { LenderStandingCard } from "./LenderStandingCard";
import { t } from "./test-t";

const SENTENCE =
  "Tôi cam kết chuyển tiền đúng hạn vào Ngày giải ngân và hiểu rằng nếu tái phạm, tài khoản của tôi sẽ bị khóa vĩnh viễn.";

let standing: { data?: LenderStanding; refetch?: () => void };
let unlock: {
  mutate: ReturnType<typeof vi.fn>;
  isPending: boolean;
  error: ApiError | null;
};
vi.mock("@/hooks/use-funding", () => ({
  useStanding: () => standing,
  useUnlockStanding: () => unlock,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const locked = (overrides: Partial<LenderStanding> = {}): LenderStanding => ({
  status: "LOCKED",
  no_show_count: 0,
  // 08:00 UTC is 15:00 in Vietnam.
  locked_at: "2026-11-02T08:00:00Z",
  unlock_requires: ["EKYC", "ACKNOWLEDGEMENT"],
  acknowledgement_sentence: SENTENCE,
  top_up_pledges: [
    {
      id: "p-1",
      window_id: "w-1",
      listing_title: "Cong Ty Delta Foods",
      amount_vnd: 20_000_000,
      recorded_at: "2026-11-02T08:00:00Z",
      status: "AWAITING_UNLOCK",
    },
  ],
  ...overrides,
});

describe("LenderStandingCard", () => {
  beforeEach(() => {
    unlock = { mutate: vi.fn(), isPending: false, error: null };
  });

  it("shows nothing while the investor is in good standing with no top-up", () => {
    standing = {
      data: {
        ...locked(),
        status: "GOOD",
        unlock_requires: [],
        top_up_pledges: [],
      },
    };
    const { container } = render(<LenderStandingCard locale="en" t={t} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the top-up in view after unlocking", () => {
    const base = locked();
    standing = {
      data: {
        ...base,
        status: "GOOD",
        unlock_requires: [],
        acknowledgement_sentence: null,
        top_up_pledges: [
          { ...base.top_up_pledges[0], status: "AWAITING_SIGNING" },
        ],
      },
    };
    render(<LenderStandingCard locale="en" t={t} />);
    expect(screen.getByTestId("standing-top-ups")).toHaveTextContent(
      "Your late transfer was recorded for manual follow-up.",
    );
    expect(screen.queryByTestId("lender-standing")).toBeNull();
  });

  it("explains the lock, sends the investor to eKYC first and lists the top-up", () => {
    standing = { data: locked() };
    render(<LenderStandingCard locale="en" t={t} />);

    const card = screen.getByTestId("lender-standing");
    expect(card).toHaveTextContent("Your account is locked");
    expect(card).toHaveTextContent("15:00"); // Vietnam time
    expect(
      screen.getByRole("link", { name: "Verify my identity" }),
    ).toHaveAttribute("href", "/kyc?reverify=1&next=%2Fdashboard%2Finvest");
    expect(
      screen.getByRole("button", { name: "Unlock my account" }),
    ).toBeDisabled();
    expect(screen.getByTestId("standing-pledges")).toHaveTextContent(
      "Cong Ty Delta Foods",
    );
    expect(screen.getByTestId("standing-pledges")).toHaveTextContent(
      "Your late transfer was recorded for manual follow-up. Unlock your account to invest again.",
    );
  });

  it("unlocks with the sentence once eKYC is done", () => {
    standing = { data: locked({ unlock_requires: ["ACKNOWLEDGEMENT"] }) };
    render(<LenderStandingCard locale="en" t={t} />);

    expect(screen.getByTestId("standing-sentence")).toHaveTextContent(SENTENCE);
    fireEvent.change(screen.getByLabelText("The undertaking, typed out"), {
      target: { value: SENTENCE },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock my account" }));
    expect(unlock.mutate).toHaveBeenCalledWith(SENTENCE, expect.anything());
  });

  it("says when the sentence does not match", () => {
    standing = { data: locked({ unlock_requires: ["ACKNOWLEDGEMENT"] }) };
    unlock.error = {
      message: "mismatch",
      code: "ACKNOWLEDGEMENT_MISMATCH",
      status: 422,
    } as ApiError;
    render(<LenderStandingCard locale="en" t={t} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The sentence doesn't match",
    );
  });

  it("has no unlock steps for a closed account", () => {
    standing = {
      data: locked({
        status: "CLOSED",
        unlock_requires: [],
        top_up_pledges: [],
      }),
    };
    render(<LenderStandingCard locale="en" t={t} />);
    expect(screen.getByTestId("lender-standing")).toHaveTextContent(
      "Your account is closed",
    );
    expect(
      screen.queryByRole("button", { name: "Unlock my account" }),
    ).toBeNull();
  });
});
