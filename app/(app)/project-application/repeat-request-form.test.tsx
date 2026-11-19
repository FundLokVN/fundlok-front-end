import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import enDictionary from "@/lib/i18n/en.json";
import { repeatSource, type Project } from "@/services/projects.service";
import { RepeatRequestForm } from "./repeat-request-form";

const t = (key: string) => {
  const value = key
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      enDictionary,
    );
  return typeof value === "string" ? value : key;
};
const mutate = vi.fn();
const push = vi.fn();

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({
    locale: "en",
    t: (key: string, values?: Record<string, string | number>) =>
      Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        t(key),
      ),
  }),
}));
vi.mock("@/hooks/use-projects", () => ({
  useRepeatProject: () => ({ mutate, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const project = (
  id: string,
  status: string,
  approved: boolean,
  duration_months = 2,
): Project =>
  ({
    id,
    legal_name: "CÔNG TY TNHH THỰC PHẨM AN PHÚ",
    tax_id: "0318765432",
    status,
    loan_application: {
      requested_amount: 60_000_000,
      duration_months,
      approval: approved ? {} : null,
    },
  }) as unknown as Project;

beforeEach(() => {
  mutate.mockReset();
  push.mockReset();
});

describe("repeatSource", () => {
  it("copies the newest approved request once every request has ended", () => {
    const approved = project("repaid", "CLOSED", true);
    expect(repeatSource([project("refused", "CLOSED", false), approved])).toBe(
      approved,
    );
  });

  it("copies nothing while a request is open, or when none was approved", () => {
    expect(
      repeatSource([
        project("new", "DRAFT", false),
        project("repaid", "CLOSED", true),
      ]),
    ).toBeUndefined();
    expect(repeatSource([project("refused", "CLOSED", false)])).toBeUndefined();
  });
});

describe("RepeatRequestForm", () => {
  it("asks only for the amount, keeps last time's term, and sends both", () => {
    render(<RepeatRequestForm source={project("repaid", "CLOSED", true)} />);

    expect(
      screen.getByText(/CÔNG TY TNHH THỰC PHẨM AN PHÚ/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 months" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const send = screen.getByRole("button", {
      name: "Send request for review",
    });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Requested amount (VND)"), {
      target: { value: "80.000.000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "3 months" }));
    fireEvent.click(send);

    expect(mutate).toHaveBeenCalledWith(
      { requested_amount: 80_000_000, duration_months: 3 },
      expect.anything(),
    );
  });
});
