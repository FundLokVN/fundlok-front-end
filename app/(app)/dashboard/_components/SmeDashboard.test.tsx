import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import enDictionary from "@/lib/i18n/en.json";
import type { Project } from "@/services/projects.service";
import { SmeDashboard } from "./SmeDashboard";

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

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({ t, locale: "en" }),
}));
vi.mock("@/hooks/use-verification-gate", () => ({
  useVerificationGate: () => ({
    needsVerification: () => false,
    openVerification: () => {},
  }),
}));
// The application panel has its own tests; here it only marks which project
// the dashboard put first.
vi.mock("./loan-application/LoanApplicationSection", () => ({
  LoanApplicationSection: ({ project }: { project: Project }) => (
    <div data-testid="current-request">{project.id}</div>
  ),
}));

const project = (id: string, status: string, amount = 50_000_000): Project => ({
  id,
  legal_name: `Cong Ty ${id}`,
  tax_id: "0101234567",
  industry: "retail",
  address: {},
  incorporation_date: "2021-04-12",
  status,
  created_at: "2026-11-01T08:00:00Z",
  loan_application: {
    requested_amount: amount,
  } as Project["loan_application"],
});

describe("SmeDashboard", () => {
  it("offers a new request once every request has ended", () => {
    render(<SmeDashboard projects={[project("repaid", "CLOSED")]} />);

    expect(
      screen.getByRole("heading", { name: "Your last request has ended" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start a new request" }),
    ).toHaveAttribute("href", "/project-application");
  });

  it("offers no new request while one is in progress", () => {
    render(
      <SmeDashboard
        projects={[project("new", "DRAFT"), project("repaid", "CLOSED")]}
      />,
    );

    expect(
      screen.queryByRole("link", { name: "Start a new request" }),
    ).not.toBeInTheDocument();
  });

  it("shows the newest request first and links to each earlier one", () => {
    render(
      <SmeDashboard
        projects={[
          project("new", "DRAFT"),
          project("repaid", "CLOSED", 80_000_000),
        ]}
      />,
    );

    expect(screen.getByTestId("current-request")).toHaveTextContent("new");
    const earlier = within(
      screen.getByRole("region", { name: "Previous requests" }),
    ).getByRole("link");
    expect(earlier).toHaveAttribute("href", "/dashboard/projects/repaid");
    expect(earlier).toHaveTextContent("Cong Ty repaid");
    expect(earlier).toHaveTextContent("Requested ₫80,000,000");
    expect(earlier).toHaveTextContent("Ended");
  });
});
