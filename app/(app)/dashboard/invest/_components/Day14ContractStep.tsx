"use client";

import { useState } from "react";
import { Download, FileSignature, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ZaloCodeConfirm,
  type ZaloCodeSent,
} from "@/components/zalo-code-confirm";
import {
  useSendContractCode,
  useSignContract,
  useTrancheContractPdf,
} from "@/hooks/use-funding";
import { useObjectUrl } from "@/hooks/use-object-url";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format-currency";
import { formatDateTime } from "@/lib/format-date";
import type { Tranche } from "@/services/funding.service";

const K = "investConfirm.day14";

// Refusals of this step with their own sentence (backend day14_signing).
const STEP_ERRORS = new Set([
  "CONTRACT_DEADLINE_PASSED",
  "TRANCHE_NOT_SIGNABLE",
  "CONTRACT_UNAVAILABLE",
  "CLICK_REQUIRED",
]);

/**
 * Day 14 of a commit-then-accept round (Money flow FINAL v1.0): "Each investor
 * signs one loan contract for its total pledged (plus the investor service
 * agreement the first time) with one OTP sent by Zalo. It then gets a VietQR."
 * The investor reads their own contract, ticks that they sign it (the logged
 * click), asks for the code by Zalo and enters it. Signing closes at 14:45.
 */
export function Day14ContractStep({
  ticket,
  payDeadlineAt,
  phone,
  firstTime,
  locale,
  t,
}: {
  ticket: Tranche;
  payDeadlineAt: string | null | undefined;
  /** The masked number the code goes to; null without a Vietnamese mobile. */
  phone: string | null;
  /** No Investor Service Agreement yet: the same code signs it too. */
  firstTime: boolean;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { toast } = useToast();
  const pdf = useTrancheContractPdf(ticket.id);
  const url = useObjectUrl(pdf.data?.blob ?? null);
  const send = useSendContractCode();
  const sign = useSignContract();
  const [read, setRead] = useState(false);
  const [sent, setSent] = useState<ZaloCodeSent | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const deadline = payDeadlineAt ? formatDateTime(payDeadlineAt, locale) : "—";

  return (
    <section
      className="space-y-4"
      aria-labelledby="day14-title"
      data-testid="day14-contract"
    >
      <div className="space-y-1">
        <h2
          id="day14-title"
          className="flex items-center gap-2 text-lg font-bold text-foreground"
        >
          <FileSignature className="h-5 w-5 text-muted-foreground" />
          {t(`${K}.title`)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(`${K}.intro`, {
            amount: formatCurrency(ticket.amount_vnd, locale),
            time: deadline,
          })}
        </p>
        {firstTime && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="day14-first-time"
          >
            {t(`${K}.firstTime`)}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border">
        {url ? (
          <iframe
            title={t(`${K}.previewLabel`)}
            src={url}
            className="h-[480px] w-full bg-muted"
          />
        ) : pdf.isError ? (
          <p className="p-4 text-sm text-destructive">{t(`${K}.loadFailed`)}</p>
        ) : (
          <div className="flex justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {url && (
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a
            href={url}
            download={pdf.data?.filename ?? "FundLok-hop-dong-cho-vay.pdf"}
          >
            <Download className="h-4 w-4" />
            {t(`${K}.download`)}
          </a>
        </Button>
      )}

      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="day14-read"
            checked={read}
            onCheckedChange={(v) => setRead(v === true)}
            disabled={sign.isPending || sign.isSuccess}
            className="mt-0.5"
          />
          <Label
            htmlFor="day14-read"
            className="text-sm font-medium leading-relaxed text-foreground"
          >
            {t(`${K}.agree`)}
          </Label>
        </div>
        <ZaloCodeConfirm
          testId="day14-code"
          phone={phone}
          sent={sent}
          disabled={!read || !url}
          sending={send.isPending}
          confirming={sign.isPending}
          done={sign.isSuccess}
          errorCode={errorCode}
          errorText={
            errorCode && STEP_ERRORS.has(errorCode)
              ? t(`${K}.errors.${errorCode}`)
              : null
          }
          sendLabel={t(`${K}.send`)}
          confirmLabel={t(`${K}.confirm`)}
          onSend={() => {
            setErrorCode(null);
            send.mutate(ticket.id, {
              onSuccess: (answer) =>
                setSent({
                  phone: answer.sent_to_masked,
                  channel: answer.channel,
                  expires_in: answer.expires_in_seconds,
                  resend_in: answer.resend_after_seconds,
                }),
              onError: (failure) => setErrorCode(failure.code ?? "generic"),
            });
          }}
          onConfirm={(code) => {
            setErrorCode(null);
            sign.mutate(
              { trancheId: ticket.id, code },
              {
                onSuccess: () => toast({ title: t(`${K}.signed`) }),
                onError: (failure) => setErrorCode(failure.code ?? "generic"),
              },
            );
          }}
        />
      </div>
    </section>
  );
}
