import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { EmailAssistantDraft } from "@/services/admin-email.service";
import { ComposeEmailCard } from "./ComposeEmailCard";
import { emailAssistantErrorKey } from "./EmailAssistant";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  assistantStatus: {
    data: { enabled: true } as { enabled: boolean } | undefined,
  },
  draft: {
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null as { code?: string; message: string } | null,
  },
}));

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({
    locale: "vi",
    setLocale: vi.fn(),
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-authentication", () => ({
  useCurrentUser: () => ({
    data: { id: "admin-1", email: "a@fundlok.com", full_name: "Admin" },
  }),
}));

vi.mock("@/hooks/use-admin-email", () => ({
  useEmailSettings: () => ({
    data: { configured: true, enabled: true, gmail_address: "a@fundlok.com" },
  }),
  useEmailPolicy: () => ({ data: { allowed_domains: [] } }),
  usePreviewEmail: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendEmail: () => ({ mutateAsync: mocks.send, isPending: false }),
  useEmailAssistant: () => mocks.assistantStatus,
  useDraftEmail: () => mocks.draft,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assistantStatus.data = { enabled: true };
  Object.assign(mocks.draft, { isPending: false, isError: false, error: null });
});

// The recipients field has its own data hooks; not under test here.
vi.mock("./RecipientsField", () => ({
  RecipientsField: () => null,
}));

const presetButton = (id: string) =>
  screen.getByRole("button", {
    // Title and hint spans join into one accessible name.
    name: new RegExp(`^admin\\.email\\.compose\\.presets\\.${id}`),
  });

const subject = () =>
  screen.getByLabelText("admin.email.compose.subjectLabel") as HTMLInputElement;

describe("ComposeEmailCard predefined content", () => {
  it("fills the form in the chosen language", () => {
    render(<ComposeEmailCard />);

    fireEvent.click(presetButton("investor_onboarding"));
    expect(subject().value).toMatch(/^Chào mừng bạn đến với FundLok/);
    expect(document.getElementById("compose-body")?.innerHTML).toContain(
      "Xin chào Quý nhà đầu tư,",
    );
    expect(
      (
        screen.getByLabelText(
          "admin.email.compose.buttonUrlLabel",
        ) as HTMLInputElement
      ).value,
    ).toMatch(/^https:\/\/.+\/kyc$/);
  });

  it("asks before replacing what was written, and keeps it on cancel", () => {
    render(<ComposeEmailCard />);
    fireEvent.change(subject(), { target: { value: "My own subject" } });

    fireEvent.click(
      screen.getByRole("radio", {
        name: "admin.email.compose.presets.languages.en",
      }),
    );
    fireEvent.click(presetButton("sme_onboarding"));

    expect(
      screen.getByText("admin.email.compose.presets.replaceTitle"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(subject().value).toBe("My own subject");

    fireEvent.click(presetButton("sme_onboarding"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "admin.email.compose.presets.replace",
      }),
    );
    expect(subject().value).toBe(
      "Welcome to FundLok – start raising capital in 2 steps",
    );
  });
});

const DRAFT: EmailAssistantDraft = {
  subject: "Nhắc nộp tờ khai thuế GTGT tháng 11",
  heading: "Nộp tờ khai trước [hạn chót]",
  body_html:
    "<div>Kính gửi Quý khách,</div><div><br></div><div>Vui lòng nộp tờ khai trước [hạn chót].</div><div><br></div><div>Trân trọng,</div>",
  body_text:
    "Kính gửi Quý khách,\n\nVui lòng nộp tờ khai trước [hạn chót].\n\nTrân trọng,",
  placeholders: ["[hạn chót]"],
  unverified_numbers: ["15"],
};

const bodyEditor = () => document.getElementById("compose-body")!;
const instruction = () =>
  screen.getByLabelText(
    "admin.email.assistant.instructionLabel",
  ) as HTMLTextAreaElement;
const heading = () =>
  screen.getByLabelText("admin.email.compose.headingLabel") as HTMLInputElement;
const buttonUrl = () =>
  screen.getByLabelText(
    "admin.email.compose.buttonUrlLabel",
  ) as HTMLInputElement;

function answerWith(draft: EmailAssistantDraft) {
  mocks.draft.mutate.mockImplementation(
    (_request, options: { onSuccess: (value: EmailAssistantDraft) => void }) =>
      options.onSuccess(draft),
  );
}

function askForDraft(text = "Nhắc nộp tờ khai thuế GTGT") {
  fireEvent.change(instruction(), { target: { value: text } });
  fireEvent.click(
    screen.getByRole("button", { name: "admin.email.assistant.draft" }),
  );
}

const useDraft = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "admin.email.assistant.use" }),
  );

describe("ComposeEmailCard Write with Claude", () => {
  it("stays hidden until it is switched on for this admin", () => {
    mocks.assistantStatus.data = { enabled: false };
    render(<ComposeEmailCard />);
    expect(screen.queryByTestId("email-assistant")).toBeNull();
  });

  it("sends the instruction, language, template and current form, never recipients", () => {
    render(<ComposeEmailCard />);
    fireEvent.change(subject(), { target: { value: "Old subject" } });
    fireEvent.click(
      screen.getByRole("radio", {
        name: "admin.email.compose.presets.languages.en",
      }),
    );
    fireEvent.click(
      screen.getByRole("radio", {
        name: /^admin\.email\.compose\.templates\.announcement/,
      }),
    );

    askForDraft("Announce the new repayment reminder emails");

    expect(mocks.draft.mutate).toHaveBeenCalledWith(
      {
        instruction: "Announce the new repayment reminder emails",
        language: "en",
        template: "announcement",
        current: {
          subject: "Old subject",
          heading: "",
          body: "",
          button_label: "",
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("shows the draft with its gaps, then fills subject, heading and message only", () => {
    answerWith(DRAFT);
    render(<ComposeEmailCard />);
    fireEvent.change(buttonUrl(), {
      target: { value: "https://www.fundlok.com/kyc" },
    });

    askForDraft();
    expect(screen.getByTestId("email-assistant-draft")).toHaveTextContent(
      "admin.email.assistant.placeholders",
    );
    expect(screen.getByTestId("email-assistant-draft")).toHaveTextContent(
      "admin.email.assistant.unverified",
    );
    expect(subject().value).toBe("");

    // Only the button is filled in, so nothing written is replaced: no question.
    useDraft();
    expect(subject().value).toBe(DRAFT.subject);
    expect(heading().value).toBe(DRAFT.heading);
    expect(bodyEditor().innerHTML).toBe(DRAFT.body_html);
    expect(buttonUrl().value).toBe("https://www.fundlok.com/kyc");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("asks before replacing what was written, and keeps it on cancel", () => {
    answerWith(DRAFT);
    render(<ComposeEmailCard />);
    fireEvent.change(subject(), { target: { value: "My own subject" } });
    askForDraft();

    useDraft();
    expect(
      screen.getByText("admin.email.assistant.replaceTitle"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(subject().value).toBe("My own subject");

    useDraft();
    fireEvent.click(
      screen.getByRole("button", { name: "admin.email.assistant.replace" }),
    );
    expect(subject().value).toBe(DRAFT.subject);
  });

  it("will not send while a placeholder from the draft is still in the email", () => {
    answerWith(DRAFT);
    render(<ComposeEmailCard />);
    askForDraft();
    useDraft();

    const send = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "admin.email.compose.send" }),
      );
    send();
    expect(
      screen.getByText("admin.email.assistant.placeholdersLeft"),
    ).toBeInTheDocument();
    expect(mocks.send).not.toHaveBeenCalled();

    fireEvent.change(heading(), {
      target: { value: "Nộp tờ khai trước ngày 5" },
    });
    bodyEditor().innerHTML = "<div>Vui lòng nộp tờ khai trước ngày 5.</div>";
    fireEvent.input(bodyEditor());
    send();
    expect(
      screen.queryByText("admin.email.assistant.placeholdersLeft"),
    ).toBeNull();
  });

  it("explains a failure, leaves the form as it was and offers a retry", () => {
    mocks.draft.isError = true;
    mocks.draft.error = { code: "EMAIL_ASSIST_BUSY", message: "slow" };
    render(<ComposeEmailCard />);
    fireEvent.change(subject(), { target: { value: "Kept" } });
    fireEvent.change(instruction(), { target: { value: "Viết lại ngắn hơn" } });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "admin.email.assistant.errors.EMAIL_ASSIST_BUSY",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "admin.email.assistant.retry" }),
    );
    expect(mocks.draft.mutate).toHaveBeenCalledTimes(1);
    expect(subject().value).toBe("Kept");
  });

  it("offers no retry when the instruction holds personal data", () => {
    mocks.draft.isError = true;
    mocks.draft.error = { code: "EMAIL_ASSIST_PERSONAL_DATA", message: "" };
    render(<ComposeEmailCard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "admin.email.assistant.errors.EMAIL_ASSIST_PERSONAL_DATA",
    );
    expect(
      screen.queryByRole("button", { name: "admin.email.assistant.retry" }),
    ).toBeNull();
  });

  it("names each failure the backend reports, and falls back for the rest", () => {
    expect(
      emailAssistantErrorKey({ code: "EMAIL_ASSIST_NO_CREDIT", message: "" }),
    ).toBe("admin.email.assistant.errors.EMAIL_ASSIST_NO_CREDIT");
    expect(
      emailAssistantErrorKey({ message: "timeout of 35000ms exceeded" }),
    ).toBe("admin.email.assistant.errors.generic");
    expect(emailAssistantErrorKey(null)).toBe(
      "admin.email.assistant.errors.generic",
    );
  });
});
