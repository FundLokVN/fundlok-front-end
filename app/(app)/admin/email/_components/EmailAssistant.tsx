"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDraftEmail, useEmailAssistant } from "@/hooks/use-admin-email";
import { useTranslations } from "@/lib/i18n";
import type { ApiError } from "@/lib/types";
import {
  EMAIL_ASSISTANT_INSTRUCTION_MAX,
  type EmailAssistantDraft,
  type EmailAssistantRequest,
  type EmailTemplate,
} from "@/services/admin-email.service";

const ERROR_CODES = [
  "EMAIL_ASSIST_BUSY",
  "EMAIL_ASSIST_NO_CREDIT",
  "EMAIL_ASSIST_FAILED",
  "EMAIL_ASSIST_UNAVAILABLE",
  "EMAIL_ASSIST_PERSONAL_DATA",
] as const;

// Retrying cannot help these: the admin has to change something first.
const NO_RETRY = new Set([
  "EMAIL_ASSIST_UNAVAILABLE",
  "EMAIL_ASSIST_PERSONAL_DATA",
]);

/** The i18n key for a failed request; timeouts and 422s get the generic one. */
export function emailAssistantErrorKey(error: ApiError | null): string {
  const code = error?.code ?? "";
  return (ERROR_CODES as readonly string[]).includes(code)
    ? `admin.email.assistant.errors.${code}`
    : "admin.email.assistant.errors.generic";
}

// "Write with Claude" in the composer: the admin says what the email should
// cover (or how to change what is in the form), and Claude drafts the
// subject, heading and message in the email language. Recipients are never
// sent. "Use this draft" hands it to the composer, which asks before
// replacing text; nothing is sent from here. See the backend's
// docs/specs/admin/email-assistant.md.
export function EmailAssistant({
  language,
  template,
  current,
  onUse,
}: {
  language: EmailAssistantRequest["language"];
  template: EmailTemplate;
  /** What is in the form now, as plain text. */
  current: () => EmailAssistantRequest["current"];
  onUse: (draft: EmailAssistantDraft) => void;
}) {
  const { t } = useTranslations();
  const status = useEmailAssistant();
  const draftEmail = useDraftEmail();
  const [instruction, setInstruction] = useState("");
  // The last good draft stays until it is discarded; a failed retry keeps it.
  const [draft, setDraft] = useState<EmailAssistantDraft | null>(null);

  if (!status.data?.enabled) return null;

  const pending = draftEmail.isPending;
  const ready = instruction.trim() !== "";

  const run = () => {
    if (!ready || pending) return;
    draftEmail.mutate(
      {
        instruction: instruction.trim(),
        language,
        template,
        current: current(),
      },
      { onSuccess: setDraft },
    );
  };

  const discard = () => {
    setDraft(null);
    draftEmail.reset();
  };

  const errorCode = draftEmail.error?.code ?? "";

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3"
      data-testid="email-assistant"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t("admin.email.assistant.title")}
      </span>
      <p className="text-xs text-muted-foreground">
        {t("admin.email.assistant.hint")}
      </p>

      <Label htmlFor="email-assistant-instruction" className="mt-1">
        {t("admin.email.assistant.instructionLabel")}
      </Label>
      <Textarea
        id="email-assistant-instruction"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        maxLength={EMAIL_ASSISTANT_INSTRUCTION_MAX}
        rows={3}
        placeholder={t("admin.email.assistant.instructionPlaceholder")}
        aria-describedby="email-assistant-privacy"
      />
      <p id="email-assistant-privacy" className="text-xs text-muted-foreground">
        {t("admin.email.assistant.privacy")}
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={run}
        disabled={pending || !ready}
        className="gap-1.5 self-start"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden />
        )}
        {pending
          ? t("admin.email.assistant.working")
          : draft
            ? t("admin.email.assistant.redraft")
            : t("admin.email.assistant.draft")}
      </Button>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {pending ? t("admin.email.assistant.workingHint") : null}
      </p>

      {draftEmail.isError && (
        <div
          role="alert"
          className="flex flex-col items-start gap-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground"
        >
          <p>{t(emailAssistantErrorKey(draftEmail.error))}</p>
          {!NO_RETRY.has(errorCode) && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={run}
              disabled={!ready}
            >
              {t("admin.email.assistant.retry")}
            </Button>
          )}
        </div>
      )}

      {draft && (
        <div
          className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3"
          data-testid="email-assistant-draft"
        >
          <p className="text-xs text-muted-foreground">
            {t("admin.email.assistant.review")}
          </p>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {t("admin.email.compose.subjectLabel")}
              </dt>
              <dd className="break-words text-foreground">{draft.subject}</dd>
            </div>
            {draft.heading && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  {t("admin.email.compose.headingLabel")}
                </dt>
                <dd className="break-words text-foreground">{draft.heading}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {t("admin.email.compose.bodyLabel")}
              </dt>
              <dd className="whitespace-pre-line break-words text-foreground">
                {draft.body_text}
              </dd>
            </div>
          </dl>
          {draft.placeholders.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("admin.email.assistant.placeholders").replace(
                "{list}",
                draft.placeholders.join(", "),
              )}
            </p>
          )}
          {draft.unverified_numbers.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("admin.email.assistant.unverified").replace(
                "{list}",
                draft.unverified_numbers.join(", "),
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onUse(draft)}>
              {t("admin.email.assistant.use")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={discard}>
              {t("admin.email.assistant.discard")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
