"use client";

import { ReadError } from "@/app/(app)/dashboard/_components/ReadError";
import { useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  FileSignature,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ZaloCodeConfirm,
  type ZaloCodeSent,
} from "@/components/zalo-code-confirm";
import {
  useDownloadWindowLoanContract,
  useSendWindowGuarantorCode,
  useSignWindowAsGuarantor,
  useUploadWindowLoanContract,
  useWindowDecision,
  useWindowLoanContracts,
} from "@/hooks/use-funding";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format-currency";
import { formatDateTime } from "@/lib/format-date";
import { useTranslations } from "@/lib/i18n";
import type { SmeRound, WindowLoanContract } from "@/services/funding.service";

const K = "dashboard.sme.decision";

// Refusals with their own sentence (backend day13_contracts, commit_flow).
const KNOWN_ERRORS = new Set([
  "CONTRACTS_NOT_SIGNED",
  "DECISION_NOT_OPEN",
  "DECISION_DEADLINE_PASSED",
  "SIGNING_CUTOFF_PASSED",
  "SIGNING_ALREADY_SIGNED",
  "SIGNING_NOT_PDF",
  "SIGNING_UNSIGNED",
  "SIGNING_WRONG_DOCUMENT",
  "SIGNING_DOCUMENT_OUTDATED",
  "SIGNING_SIGNATURE_INVALID",
  "SIGNING_SIGNER_MISMATCH",
  "NEAC_UNAVAILABLE",
  "GUARANTOR_ALREADY_SIGNED",
  "CONTRACT_SIGNING_NOT_OPEN",
]);

/**
 * The business's side of a commit-then-accept round (Money flow FINAL v1.0).
 * Days 0 to 12: how much is pledged and what Day 13 asks. Day 13: by 15:00
 * accept (by signing every investor's loan contract with the enterprise
 * digital signature) or decline; below 50% of the target, signing closes at
 * 12:00. The guarantor signs every contract with one Zalo code (not a
 * condition). Silence: 50% or more counts as accepted, less as declined.
 */
export function SmeDecision({ round }: { round: SmeRound }) {
  const { t, locale } = useTranslations();
  const day13 =
    round.status === "AWAITING_SME" || round.status === "AWAITING_PAYMENT";
  const contracts = useWindowLoanContracts(round.id, day13);
  const pledged = round.committed_total_vnd ?? 0;
  const at = (iso?: string | null) => (iso ? formatDateTime(iso, locale) : "—");

  if (round.status === "OPEN") {
    return (
      <Card
        testId="sme-decision-open"
        icon={<Clock className="h-4 w-4" />}
        title={t(`${K}.openTitle`)}
      >
        <p>
          {t(`${K}.openBody`)
            .replace("{pledged}", formatCurrency(pledged, locale))
            .replace("{target}", formatCurrency(round.target_vnd, locale))
            .replace("{closes}", at(round.commit_closes_at))
            .replace("{deadline}", at(round.sme_deadline_at))}
        </p>
        <p>{t(`${K}.silenceRule`)}</p>
      </Card>
    );
  }
  if (round.status === "FAILED" || round.status === "CANCELLED") {
    return (
      <Card
        testId="sme-decision-declined"
        icon={<XCircle className="h-4 w-4" />}
        title={t(`${K}.declinedTitle`)}
      >
        <p>
          {t(
            round.sme_decision === "AUTO_DECLINED"
              ? `${K}.autoDeclinedBody`
              : `${K}.declinedBody`,
          )}
        </p>
      </Card>
    );
  }
  if (!day13) return null;
  if (contracts.isError) {
    return (
      <ReadError
        message={t(`${K}.loadFailed`)}
        retryLabel={t("errorPage.retry")}
        isFetching={contracts.isFetching}
        refetch={contracts.refetch}
      />
    );
  }
  if (contracts.isLoading || !contracts.data) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const data = contracts.data;
  if (round.status === "AWAITING_PAYMENT") {
    return (
      <Card
        testId="sme-decision-accepted"
        icon={<CheckCircle2 className="h-4 w-4" />}
        title={t(`${K}.acceptedTitle`)}
      >
        <p>
          {t(
            round.sme_decision === "AUTO_ACCEPTED"
              ? `${K}.autoAcceptedBody`
              : `${K}.acceptedBody`,
          ).replace("{time}", at(round.pay_deadline_at))}
        </p>
        <GuarantorStep
          windowId={round.id}
          signedAt={data.guarantor_signed_at}
          phone={data.guarantor_phone}
        />
      </Card>
    );
  }
  return (
    <Card
      testId="sme-decision-day13"
      icon={<FileSignature className="h-4 w-4" />}
      title={t(`${K}.day13Title`)}
    >
      <p>
        {t(`${K}.day13Body`)
          .replace("{pledged}", formatCurrency(data.pledged_vnd, locale))
          .replace("{target}", formatCurrency(data.target_vnd, locale))
          .replace("{deadline}", at(data.sme_deadline_at))}
      </p>
      {data.signing_cutoff_at ? (
        <p
          className="font-semibold text-amber-700 dark:text-amber-400"
          data-testid="signing-cutoff"
        >
          {t(`${K}.cutoff`).replace("{time}", at(data.signing_cutoff_at))}
        </p>
      ) : (
        <p>{t(`${K}.silenceAccepts`)}</p>
      )}
      <ul className="divide-y rounded-lg border">
        {data.contracts
          .filter((c) => c.status !== "VOID")
          .map((c) => (
            <ContractRow key={c.id} windowId={round.id} contract={c} />
          ))}
      </ul>
      <GuarantorStep
        windowId={round.id}
        signedAt={data.guarantor_signed_at}
        phone={data.guarantor_phone}
      />
      <DecisionButtons windowId={round.id} canAccept={data.all_signed} />
    </Card>
  );
}

function Card({
  testId,
  icon,
  title,
  children,
}: {
  testId: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"
    >
      <h4 className="flex items-center gap-2 font-bold text-foreground">
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
        {title}
      </h4>
      <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function errorText(t: (k: string) => string, code?: string) {
  return t(`${K}.errors.${KNOWN_ERRORS.has(code ?? "") ? code : "generic"}`);
}

function ContractRow({
  windowId,
  contract,
}: {
  windowId: string;
  contract: WindowLoanContract;
}) {
  const { t, locale } = useTranslations();
  const { toast } = useToast();
  const download = useDownloadWindowLoanContract(windowId);
  const upload = useUploadWindowLoanContract(windowId);
  const input = useRef<HTMLInputElement>(null);
  const signed = contract.status !== "GENERATED";

  const save = () =>
    download.mutate(contract.id, {
      onSuccess: ({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          filename ?? `FundLok-${contract.contract_no.split("/")[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      onError: (failure) =>
        toast({
          variant: "destructive",
          title: t(`${K}.downloadFailed`),
          description: failure.message,
        }),
    });

  return (
    <li
      className="flex flex-wrap items-center justify-between gap-2 p-3"
      data-testid={`contract-${contract.id}`}
    >
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{contract.contract_no}</p>
        <p>
          {contract.lender_name} · {formatCurrency(contract.amount_vnd, locale)}{" "}
          ·{" "}
          {signed
            ? t(`${K}.signedAt`).replace(
                "{time}",
                formatDateTime(contract.sme_signed_at ?? "", locale),
              )
            : t(`${K}.toSign`)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={save}
          disabled={download.isPending}
        >
          <Download className="h-3.5 w-3.5" />
          {t(`${K}.download`)}
        </Button>
        {!signed && (
          <>
            <input
              ref={input}
              type="file"
              accept="application/pdf"
              className="hidden"
              data-testid={`contract-file-${contract.id}`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                upload.mutate(
                  { contractId: contract.id, file },
                  {
                    onSuccess: () => toast({ title: t(`${K}.uploaded`) }),
                    onError: (failure) =>
                      toast({
                        variant: "destructive",
                        title: t(`${K}.uploadFailed`),
                        description: errorText(t, failure.code),
                      }),
                  },
                );
              }}
            />
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={upload.isPending}
              onClick={() => input.current?.click()}
            >
              {upload.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {t(`${K}.upload`)}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function GuarantorStep({
  windowId,
  signedAt,
  phone,
}: {
  windowId: string;
  signedAt: string | null;
  phone: string | null;
}) {
  const { t, locale } = useTranslations();
  const { toast } = useToast();
  const send = useSendWindowGuarantorCode(windowId);
  const sign = useSignWindowAsGuarantor(windowId);
  const [sent, setSent] = useState<ZaloCodeSent | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  if (signedAt) {
    return (
      <p
        className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400"
        data-testid="window-guarantor-signed"
      >
        <ShieldCheck className="h-4 w-4" />
        {t(`${K}.guarantorSigned`).replace(
          "{time}",
          formatDateTime(signedAt, locale),
        )}
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <p className="font-semibold text-foreground">
        {t(`${K}.guarantorTitle`)}
      </p>
      <p>{t(`${K}.guarantorBody`)}</p>
      <ZaloCodeConfirm
        testId="window-guarantor-code"
        phone={phone}
        sent={sent}
        sending={send.isPending}
        confirming={sign.isPending}
        done={sign.isSuccess}
        errorCode={errorCode}
        errorText={errorCode ? errorText(t, errorCode) : null}
        sendLabel={t(`${K}.guarantorSend`)}
        confirmLabel={t(`${K}.guarantorConfirm`)}
        onSend={() => {
          setErrorCode(null);
          send.mutate(undefined, {
            onSuccess: setSent,
            onError: (failure) => setErrorCode(failure.code ?? "generic"),
          });
        }}
        onConfirm={(code) => {
          setErrorCode(null);
          sign.mutate(code, {
            onSuccess: () => toast({ title: t(`${K}.guarantorDone`) }),
            onError: (failure) => setErrorCode(failure.code ?? "generic"),
          });
        }}
      />
    </div>
  );
}

function DecisionButtons({
  windowId,
  canAccept,
}: {
  windowId: string;
  canAccept: boolean;
}) {
  const { t } = useTranslations();
  const { toast } = useToast();
  const decide = useWindowDecision();
  const [key] = useState(() => crypto.randomUUID());
  const [declining, setDeclining] = useState(false);

  const submit = (decision: "ACCEPT" | "DECLINE") =>
    decide.mutate(
      { windowId, decision, idempotencyKey: `${key}-${decision}` },
      {
        onSuccess: () =>
          toast({
            title: t(
              decision === "ACCEPT"
                ? `${K}.acceptedToast`
                : `${K}.declinedToast`,
            ),
          }),
        onError: (failure) =>
          toast({
            variant: "destructive",
            title: t(`${K}.decisionFailed`),
            description: errorText(t, failure.code),
          }),
      },
    );

  return (
    <div className="space-y-2">
      {!canAccept && (
        <p data-testid="accept-needs-signing">{t(`${K}.acceptNeedsSigning`)}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="gap-2"
          disabled={!canAccept || decide.isPending}
          onClick={() => submit("ACCEPT")}
          data-testid="decision-accept"
        >
          <CheckCircle2 className="h-4 w-4" />
          {t(`${K}.accept`)}
        </Button>
        {declining ? (
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            disabled={decide.isPending}
            onClick={() => submit("DECLINE")}
            data-testid="decision-decline-confirm"
          >
            <XCircle className="h-4 w-4" />
            {t(`${K}.declineConfirm`)}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeclining(true)}
            data-testid="decision-decline"
          >
            {t(`${K}.decline`)}
          </Button>
        )}
      </div>
    </div>
  );
}
