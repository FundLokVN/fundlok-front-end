"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  ZaloCodeConfirm,
  type ZaloCodeSent,
} from "@/components/zalo-code-confirm";
import { useSendGuarantorCode, useSignAsGuarantor } from "@/hooks/use-loans";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format-date";
import type { ListingDocuments } from "@/services/loans.service";

const K = "dashboard.sme.signing.guarantor";

// Refusals of this step with their own sentence (app/loans/signing.py).
const STEP_ERRORS = new Set([
  "GUARANTOR_SIGNS_AFTER_UPLOAD",
  "GUARANTOR_ALREADY_SIGNED",
  "SIGNING_GUARANTOR_NOT_READY",
]);

/**
 * The Personal Guarantor signs the Standing Offer and the Loan Contract
 * template with one code sent by Zalo (Money flow FINAL v1.0, Day 0: "the
 * guarantor signs the standing offer by OTP sent by Zalo; the SME signs with
 * its digital signature"). The guarantor is the signing owner, so the code
 * goes to this account's verified phone. It opens once the SME's signed copies
 * of both are on file; with the Service Agreement too, it publishes the
 * listing.
 */
export function GuarantorZaloSignature({
  applicationId,
  docs,
  locale,
  t,
}: {
  applicationId: string;
  docs: ListingDocuments;
  locale: string;
  t: (key: string) => string;
}) {
  const { toast } = useToast();
  const send = useSendGuarantorCode(applicationId);
  const sign = useSignAsGuarantor(applicationId);
  const [sent, setSent] = useState<ZaloCodeSent | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const missing = docs.guarantor_missing ?? [];
  const canSign = docs.standing_offer.signed && docs.loan_contract.signed;

  if (docs.guarantor_signed_by) {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4"
        data-testid="guarantor-signed"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-foreground">
            {t(`${K}.signedTitle`)}
          </p>
          <p className="text-xs text-muted-foreground">
            {docs.guarantor_signed_by === "ZALO_OTP" && docs.guarantor_signed_at
              ? t(`${K}.signedByCode`).replace(
                  "{time}",
                  formatDateTime(docs.guarantor_signed_at, locale),
                )
              : t(`${K}.signedInPdf`)}
          </p>
        </div>
      </div>
    );
  }

  const fail = (code: string | undefined, title: string) => {
    const known = code ?? "generic";
    setErrorCode(known);
    toast({
      variant: "destructive",
      title,
      description: STEP_ERRORS.has(known)
        ? t(`${K}.errors.${known}`)
        : undefined,
    });
  };

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      aria-labelledby="guarantor-signature-title"
      data-testid="guarantor-signature"
    >
      <h4
        id="guarantor-signature-title"
        className="flex items-center gap-2 text-sm font-bold text-foreground"
      >
        <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t(`${K}.title`)}
      </h4>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(`${K}.intro`)}
      </p>

      {missing.length > 0 ? (
        <div
          className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
          data-testid="guarantor-not-ready"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 text-foreground">
            <p className="font-semibold">{t(`${K}.notReady`)}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {missing.map((m) => (
                <li key={m}>
                  {t(`${K}.missing.${m}`)}{" "}
                  <Link
                    href={m === "EKYC" ? "/kyc" : "/dashboard/settings/profile"}
                    className="font-semibold underline underline-offset-2"
                  >
                    {t(`${K}.fix`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : !canSign ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="guarantor-waiting"
        >
          {t(`${K}.waiting`)}
        </p>
      ) : (
        <ZaloCodeConfirm
          testId="guarantor-code"
          phone={docs.guarantor_phone ?? null}
          sent={sent}
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
            send.mutate(undefined, {
              onSuccess: (answer) => setSent(answer),
              onError: (failure) => fail(failure.code, t(`${K}.sendFailed`)),
            });
          }}
          onConfirm={(code) => {
            setErrorCode(null);
            sign.mutate(code, {
              onSuccess: (status) =>
                toast({
                  title: t(
                    status.published
                      ? "dashboard.sme.signing.publishedToast"
                      : `${K}.signedTitle`,
                  ),
                }),
              onError: (failure) => fail(failure.code, t(`${K}.failed`)),
            });
          }}
        />
      )}
    </section>
  );
}
