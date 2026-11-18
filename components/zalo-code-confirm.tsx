"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  AlertCircle,
  FileSignature,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useTranslations } from "@/lib/i18n";

const K = "common.zaloCode";
const CODE_LENGTH = 6;

/** Failures with their own sentence (X-Error-Code); anything else is generic. */
export const ZALO_CODE_ERRORS = new Set([
  "CODE_INCORRECT",
  "CODE_EXPIRED",
  "CODE_TOO_MANY_ATTEMPTS",
  "CODE_COOLDOWN",
  "CODE_DAILY_LIMIT",
  "CODE_NOT_SENT",
  "CODE_UNAVAILABLE",
  "PHONE_REQUIRED",
  "PHONE_NO_ZALO",
]);

// A code that can no longer be entered: only a new one helps.
const SPENT = new Set(["CODE_EXPIRED", "CODE_TOO_MANY_ATTEMPTS"]);

export interface ZaloCodeSent {
  /** Masked, e.g. 0903***489. */
  phone: string;
  channel: string;
  expires_in: number;
  resend_in: number;
}

/**
 * Signing with a one-time code sent by Zalo: ask for the code, enter it,
 * confirm. The code is the signature. The parent owns the two requests
 * (React Query mutations) and says how they went; this keeps only the local
 * UI state (the digits typed, the resend countdown).
 *
 * Used for the investor's Day-14 loan contract and the Personal Guarantor's
 * Day-0 and Day-13 signatures (Money flow FINAL v1.0).
 */
export function ZaloCodeConfirm({
  phone,
  noPhoneHref = "/dashboard/settings/profile",
  sent,
  sending,
  confirming,
  done = false,
  disabled = false,
  errorCode,
  errorText,
  sendLabel,
  confirmLabel,
  onSend,
  onConfirm,
  testId = "zalo-code",
}: {
  /** Where the code goes, masked; null when there is no verified number. */
  phone: string | null;
  noPhoneHref?: string;
  sent: ZaloCodeSent | null;
  sending: boolean;
  confirming: boolean;
  /** Signed: nothing more to enter. */
  done?: boolean;
  /** Not open yet (e.g. a box to tick first). */
  disabled?: boolean;
  /** The X-Error-Code of the last failure, if any. */
  errorCode: string | null;
  /** The sentence for a failure this component does not know. */
  errorText?: string | null;
  sendLabel: string;
  confirmLabel: string;
  onSend: () => void;
  onConfirm: (code: string) => void;
  testId?: string;
}) {
  const { t } = useTranslations();
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [lastSent, setLastSent] = useState<ZaloCodeSent | null>(null);

  // A new answer restarts the code entry and the countdown (set during render,
  // as React recommends for state derived from a changed prop).
  if (sent !== lastSent) {
    setLastSent(sent);
    setCode("");
    setResendIn(sent?.resend_in ?? 0);
  }
  // A refused code is cleared so the next one can be typed.
  const [lastError, setLastError] = useState<string | null>(null);
  if (errorCode !== lastError) {
    setLastError(errorCode);
    if (errorCode) setCode("");
  }

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const spent = errorCode !== null && SPENT.has(errorCode);
  const busy = confirming || done;
  const message = errorCode
    ? ZALO_CODE_ERRORS.has(errorCode)
      ? t(`${K}.errors.${errorCode}`)
      : (errorText ?? t(`${K}.errors.generic`))
    : null;

  const confirm = (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;
    onConfirm(value);
  };

  if (!phone) {
    return (
      <div
        className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
        data-testid={`${testId}-no-phone`}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="leading-relaxed text-foreground">
          {t(`${K}.noPhone`)}{" "}
          <Link
            href={noPhoneHref}
            className="font-semibold underline underline-offset-2"
          >
            {t(`${K}.noPhoneLink`)}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      {!sent ? (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(`${K}.intro`).replace("{phone}", phone)}
          </p>
          <Button
            type="button"
            className="h-11 w-full gap-2 font-semibold"
            disabled={disabled || sending}
            onClick={onSend}
            data-testid={`${testId}-send`}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t(`${K}.sending`)}
              </>
            ) : (
              <>
                <MessageSquareText className="h-4 w-4" />
                {sendLabel}
              </>
            )}
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-1 text-center">
            <p className="text-sm text-foreground">
              {t(
                sent.channel === "zalo" ? `${K}.sentZalo` : `${K}.sentLog`,
              ).replace("{phone}", sent.phone)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(`${K}.expiry`).replace(
                "{minutes}",
                String(Math.round(sent.expires_in / 60)),
              )}
            </p>
          </div>
          <InputOTP
            maxLength={CODE_LENGTH}
            value={code}
            onChange={setCode}
            onComplete={confirm}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={spent || busy}
            aria-label={t(`${K}.label`)}
            containerClassName="justify-center"
            data-testid={`${testId}-input`}
          >
            <InputOTPGroup>
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  aria-invalid={!!errorCode}
                  className="h-12 w-11 text-lg"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button
            type="button"
            className="h-11 w-full gap-2 font-semibold"
            disabled={code.length !== CODE_LENGTH || spent || busy}
            onClick={() => confirm(code)}
            data-testid={`${testId}-confirm`}
          >
            {confirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t(`${K}.confirming`)}
              </>
            ) : (
              <>
                <FileSignature className="h-4 w-4" />
                {confirmLabel}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={resendIn > 0 || sending || busy}
            onClick={onSend}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t(`${K}.sending`)}
              </>
            ) : resendIn > 0 ? (
              t(`${K}.resendIn`).replace("{seconds}", String(resendIn))
            ) : (
              t(`${K}.resend`)
            )}
          </Button>
        </>
      )}
      {message && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
