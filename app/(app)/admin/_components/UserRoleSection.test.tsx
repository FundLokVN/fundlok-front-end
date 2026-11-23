import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import enDictionary from "@/lib/i18n/en.json";
import { UserRoleSection } from "./UserRoleSection";

const changeRole = vi.fn();
const toast = vi.fn();

vi.mock("@/hooks/use-admin", () => ({
  useChangeUserRole: () => ({ mutateAsync: changeRole, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

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
  useTranslations: () => ({ locale: "en", setLocale: vi.fn(), t }),
}));

function renderSection(
  props: Partial<Parameters<typeof UserRoleSection>[0]> = {},
) {
  const onChanged = vi.fn();
  render(
    <UserRoleSection
      userId="user-1"
      email="new.ops@fundlok.com"
      displayName="New Ops"
      currentRole="INVESTOR"
      myRole="ADMIN"
      isSelf={false}
      onChanged={onChanged}
      {...props}
    />,
  );
  return { onChanged };
}

const buttonNames = () =>
  screen.queryAllByRole("button").map((button) => button.textContent);

describe("UserRoleSection", () => {
  beforeEach(() => {
    changeRole.mockReset();
    toast.mockReset();
  });

  it("offers an admin only the Admin role for a member", () => {
    renderSection();
    expect(buttonNames()).toEqual(["Make Admin"]);
  });

  it("offers a system admin both admin roles for a member", () => {
    renderSection({ myRole: "SYSTEM_ADMIN", currentRole: null });
    expect(buttonNames()).toEqual(["Make Admin", "Make System admin"]);
  });

  it("lets a system admin move an admin to any other role", () => {
    renderSection({ myRole: "SYSTEM_ADMIN", currentRole: "ADMIN" });
    expect(buttonNames()).toEqual([
      "Make System admin",
      "Make Investor",
      "Make SME",
    ]);
  });

  it("explains instead of offering buttons when an admin opens another admin", () => {
    renderSection({ currentRole: "ADMIN" });
    expect(buttonNames()).toEqual([]);
    expect(
      screen.getByText(enDictionary.admin.userRole.blockedAdmin),
    ).toBeTruthy();
  });

  it("never offers a change to your own role", () => {
    renderSection({ myRole: "SYSTEM_ADMIN", isSelf: true });
    expect(buttonNames()).toEqual([]);
    expect(
      screen.getByText(enDictionary.admin.userRole.blockedSelf),
    ).toBeTruthy();
  });

  it("confirms first, then sends the role and the note", async () => {
    changeRole.mockResolvedValue({ id: "user-1", role: "ADMIN" });
    const { onChanged } = renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Make Admin" }));
    expect(changeRole).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Joins operations" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change role" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(changeRole).toHaveBeenCalledWith({
      id: "user-1",
      body: { role: "ADMIN", note: "Joins operations" },
    });
  });

  it("warns before granting admin to an address outside @fundlok.com", () => {
    renderSection({ email: "someone@gmail.com" });
    fireEvent.click(screen.getByRole("button", { name: "Make Admin" }));
    expect(screen.getByText(/outside the @fundlok.com domain/)).toBeTruthy();
  });

  it("shows its own copy for a refusal the panel could not predict", async () => {
    changeRole.mockRejectedValue({
      message: "This account has money in a funding round",
      code: "ROLE_CHANGE_LIVE_INVESTMENT",
    });
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Make Admin" }));
    fireEvent.click(screen.getByRole("button", { name: "Change role" }));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0]).toMatchObject({
      variant: "destructive",
      description: enDictionary.admin.userRole.errors.liveInvestment,
    });
  });
});
