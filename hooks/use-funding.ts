"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fundingService,
  type FundingWindow,
  type InvestmentConfirmation,
  type AgreementCodeSent,
  type Commitment,
  type CommitRequest,
  type ContractCodeSent,
  type GuarantorCodeSent,
  type WindowLoanContracts,
  type InvestorAgreementStatus,
  type LenderStanding,
  type PaymentInstructions,
  type ReceiptResult,
  type ReserveRequest,
  type SmeRepaymentPlan,
  type SmeRound,
  type SignedInvestmentConfirmation,
  type SmeTicket,
  type Tranche,
} from "@/services/funding.service";
import type { ApiError } from "@/lib/types";

export const fundingKeys = {
  all: ["funding"] as const,
  window: (listingId: string) =>
    [...fundingKeys.all, "window", listingId] as const,
  myTranches: () => [...fundingKeys.all, "my-tranches"] as const,
  payment: (trancheId: string) =>
    [...fundingKeys.all, "payment", trancheId] as const,
  trancheConfirmation: (trancheId: string) =>
    [...fundingKeys.all, "confirmation", trancheId] as const,
  trancheConfirmationPdf: (trancheId: string) =>
    [...fundingKeys.all, "confirmation", trancheId, "pdf"] as const,
  myRounds: () => [...fundingKeys.all, "my-rounds"] as const,
  repaymentPlan: (windowId: string) =>
    [...fundingKeys.all, "repayment-plan", windowId] as const,
  investorAgreement: () => [...fundingKeys.all, "investor-agreement"] as const,
  investorAgreementPdf: (trancheId: string) =>
    [...fundingKeys.all, "investor-agreement", "pdf", trancheId] as const,
  signedInvestorAgreement: (signedAt: string) =>
    [...fundingKeys.all, "investor-agreement", "signed", signedAt] as const,
  windowLoanContract: (windowId: string) =>
    [...fundingKeys.all, "loan-contract", windowId] as const,
  standing: () => [...fundingKeys.all, "standing"] as const,
  myCommitments: (windowId: string) =>
    [...fundingKeys.all, "my-commitments", windowId] as const,
  windowLoanContracts: (windowId: string) =>
    [...fundingKeys.all, "window-loan-contracts", windowId] as const,
  trancheContract: (trancheId: string) =>
    [...fundingKeys.all, "tranche-contract", trancheId] as const,
  investmentConfirmation: (windowId: string, amountVnd: number) =>
    [
      ...fundingKeys.all,
      "investment-confirmation",
      windowId,
      amountVnd,
    ] as const,
};

// The project's funding window, by its listing. Null id: nothing to fetch (the
// project has no listing yet).
export function useFundingWindow(listingId: string | null) {
  return useQuery<FundingWindow, ApiError>({
    queryKey: fundingKeys.window(listingId ?? ""),
    queryFn: () => fundingService.getWindow(listingId as string),
    enabled: Boolean(listingId),
    staleTime: 30 * 1000,
    retry: false,
  });
}

export function useMyTranches(enabled = true) {
  return useQuery<Tranche[], ApiError>({
    queryKey: fundingKeys.myTranches(),
    queryFn: () => fundingService.listMyTranches(),
    enabled,
    staleTime: 30 * 1000,
    retry: false,
  });
}

// Whether the investor must still confirm the Investor Service Agreement with
// their next commitment, the number the code goes to, and Party B as
// confirmed or as the PDF fills it.
export function useInvestorAgreement(enabled = true) {
  return useQuery<InvestorAgreementStatus, ApiError>({
    queryKey: fundingKeys.investorAgreement(),
    queryFn: () => fundingService.getInvestorAgreement(),
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
}

// The agreement as a PDF filled in with the investor's details and the Annex
// of the commitment it is confirmed with, to read and download.
// Generated on each request, so never cached.
export function useInvestorAgreementPdf(trancheId: string, enabled = true) {
  return useQuery<{ blob: Blob; filename: string | null }, ApiError>({
    queryKey: fundingKeys.investorAgreementPdf(trancheId),
    queryFn: () => fundingService.getInvestorAgreementPdf(trancheId),
    enabled: enabled && Boolean(trancheId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

// The copy kept when the investor confirmed, by when they did.
export function useSignedInvestorAgreement(
  signedAt: string | null,
  enabled = true,
) {
  return useQuery<{ blob: Blob; filename: string | null }, ApiError>({
    queryKey: fundingKeys.signedInvestorAgreement(signedAt ?? ""),
    queryFn: () => fundingService.getSignedInvestorAgreement(),
    enabled: enabled && Boolean(signedAt),
    staleTime: Infinity,
    retry: false,
  });
}

// Asking for the one-time code that confirms the agreement with a commitment.
export function useSendInvestorAgreementCode() {
  return useMutation<
    AgreementCodeSent,
    ApiError,
    { version: string; trancheId: string }
  >({
    mutationFn: ({ version, trancheId }) =>
      fundingService.sendInvestorAgreementCode(version, trancheId),
  });
}

// The Loan Contract the business signed for this listing, to read before
// committing. A listing without one answers 404: nothing to show.
export function useWindowLoanContract(windowId: string, enabled = true) {
  return useQuery<{ blob: Blob; filename: string | null }, ApiError>({
    queryKey: fundingKeys.windowLoanContract(windowId),
    queryFn: () => fundingService.getWindowLoanContract(windowId),
    enabled: enabled && Boolean(windowId),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

// Confirming the agreement with a commitment by the one-time code: the answer
// is the new status, and that commitment's payment details and Annex are now
// there to read.
export function useSignInvestorAgreement() {
  const queryClient = useQueryClient();
  return useMutation<
    InvestorAgreementStatus,
    ApiError,
    { version: string; trancheId: string; code: string }
  >({
    mutationFn: ({ version, trancheId, code }) =>
      fundingService.signInvestorAgreement(version, trancheId, code),
    onSuccess: (status, { trancheId }) => {
      queryClient.setQueryData(fundingKeys.investorAgreement(), status);
      void queryClient.invalidateQueries({
        queryKey: fundingKeys.payment(trancheId),
      });
      void queryClient.invalidateQueries({
        queryKey: fundingKeys.trancheConfirmation(trancheId),
      });
    },
  });
}

// The Investment Confirmation (the agreement's Annex) for this amount on this
// window, filled in as the backend will sign it.
export function useInvestmentConfirmation(
  windowId: string | null,
  amountVnd: number,
) {
  return useQuery<InvestmentConfirmation, ApiError>({
    queryKey: fundingKeys.investmentConfirmation(windowId ?? "", amountVnd),
    queryFn: () =>
      fundingService.getInvestmentConfirmation(windowId as string, amountVnd),
    enabled: Boolean(windowId) && amountVnd > 0,
    staleTime: 60 * 1000,
    retry: false,
  });
}

// The Investment Confirmation kept for a ticket. It never changes once made.
export function useTrancheConfirmation(trancheId: string | null) {
  return useQuery<SignedInvestmentConfirmation, ApiError>({
    queryKey: fundingKeys.trancheConfirmation(trancheId ?? ""),
    queryFn: () => fundingService.getTrancheConfirmation(trancheId as string),
    enabled: Boolean(trancheId),
    staleTime: Infinity,
    retry: false,
  });
}

// Its filled-in PDF, to view and download.
export function useTrancheConfirmationPdf(
  trancheId: string | null,
  enabled = true,
) {
  return useQuery<{ blob: Blob; filename: string | null }, ApiError>({
    queryKey: fundingKeys.trancheConfirmationPdf(trancheId ?? ""),
    queryFn: () =>
      fundingService.getTrancheConfirmationPdf(trancheId as string),
    enabled: enabled && Boolean(trancheId),
    staleTime: Infinity,
    retry: false,
  });
}

export function usePaymentInstructions(trancheId: string | null) {
  return useQuery<PaymentInstructions, ApiError>({
    queryKey: fundingKeys.payment(trancheId ?? ""),
    queryFn: () => fundingService.getPayment(trancheId as string),
    enabled: Boolean(trancheId),
    // The account and amount never change for a ticket. A new QR replaces
    // the cached answer (useNewQr) rather than refetching it.
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * "Get a new QR" (Day-14 transfer rule): a new code valid 15 minutes. The
 * answer replaces the ticket's payment instructions in the cache.
 */
export function useNewQr(trancheId: string) {
  const queryClient = useQueryClient();
  return useMutation<PaymentInstructions, ApiError, void>({
    mutationFn: () => fundingService.issueNewQr(trancheId),
    onSuccess: (instructions) => {
      queryClient.setQueryData(fundingKeys.payment(trancheId), instructions);
    },
  });
}

/** Whether the investor is locked after Day 14, and their top-up pledges. */
export function useStanding(enabled = true) {
  return useQuery<LenderStanding, ApiError>({
    queryKey: fundingKeys.standing(),
    queryFn: () => fundingService.getStanding(),
    enabled,
    staleTime: 30 * 1000,
    retry: false,
  });
}

export function useUnlockStanding() {
  const queryClient = useQueryClient();
  return useMutation<LenderStanding, ApiError, string>({
    mutationFn: (acknowledgement) =>
      fundingService.unlockStanding(acknowledgement),
    onSuccess: (standing) => {
      queryClient.setQueryData(fundingKeys.standing(), standing);
    },
  });
}

/** The investor's own pledges to a commit-then-accept round, newest first. */
export function useMyCommitments(windowId: string | null) {
  return useQuery<Commitment[], ApiError>({
    queryKey: fundingKeys.myCommitments(windowId ?? ""),
    queryFn: () => fundingService.listMyCommitments(windowId as string),
    enabled: Boolean(windowId),
    staleTime: 15 * 1000,
    retry: false,
  });
}

// A pledge or a withdrawal moves the round's totals and the investor's list.
function useCommitmentMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<Commitment>,
) {
  const queryClient = useQueryClient();
  return useMutation<Commitment, ApiError, TVars>({
    mutationFn,
    onSuccess: (commitment) => {
      void queryClient.invalidateQueries({
        queryKey: fundingKeys.myCommitments(commitment.window_id),
      });
      void queryClient.invalidateQueries({
        queryKey: [...fundingKeys.all, "window"],
      });
    },
  });
}

/** Pledge on a commit-then-accept round: pressing Confirm, no money moves. */
export function useCommit() {
  return useCommitmentMutation(
    ({
      windowId,
      body,
      idempotencyKey,
    }: {
      windowId: string;
      body: CommitRequest;
      idempotencyKey: string;
    }) => fundingService.commit(windowId, body, idempotencyKey),
  );
}

/** Withdraw a pledge, until the end of Day 12. */
export function useWithdrawCommitment() {
  return useCommitmentMutation((commitmentId: string) =>
    fundingService.withdrawCommitment(commitmentId),
  );
}

/** Day 14: the investor's own loan contract, to read before signing. */
export function useTrancheContractPdf(trancheId: string, enabled = true) {
  return useQuery<{ blob: Blob; filename: string | null }, ApiError>({
    queryKey: fundingKeys.trancheContract(trancheId),
    queryFn: () => fundingService.getTrancheContractPdf(trancheId),
    enabled: enabled && Boolean(trancheId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useSendContractCode() {
  return useMutation<ContractCodeSent, ApiError, string>({
    mutationFn: (trancheId) => fundingService.sendContractCode(trancheId),
  });
}

/**
 * Signing the Day-14 loan contract with the Zalo code: the ticket is SIGNED
 * and its VietQR opens; the first time, the agreement is signed too.
 */
export function useSignContract() {
  const queryClient = useQueryClient();
  return useMutation<Tranche, ApiError, { trancheId: string; code: string }>({
    mutationFn: ({ trancheId, code }) =>
      fundingService.signContract(trancheId, code),
    onSuccess: (tranche) => {
      queryClient.setQueryData<Tranche[]>(fundingKeys.myTranches(), (old) =>
        (old ?? []).map((t) => (t.id === tranche.id ? tranche : t)),
      );
      void queryClient.invalidateQueries({
        queryKey: fundingKeys.myTranches(),
      });
      void queryClient.invalidateQueries({
        queryKey: fundingKeys.investorAgreement(),
        exact: true,
      });
    },
  });
}

/** Day 13: each investor's loan contract on the business's round. */
export function useWindowLoanContracts(windowId: string, enabled = true) {
  return useQuery<WindowLoanContracts, ApiError>({
    queryKey: fundingKeys.windowLoanContracts(windowId),
    queryFn: () => fundingService.getWindowLoanContracts(windowId),
    enabled: enabled && Boolean(windowId),
    staleTime: 15 * 1000,
    retry: false,
  });
}

/** One contract's PDF, fetched on demand to save it. */
export function useDownloadWindowLoanContract(windowId: string) {
  return useMutation<{ blob: Blob; filename: string | null }, ApiError, string>(
    {
      mutationFn: (contractId) =>
        fundingService.getWindowLoanContractPdf(windowId, contractId),
    },
  );
}

// Each Day-13 step answers with where signing stands.
function useLoanContractsMutation<TVars>(
  windowId: string,
  mutationFn: (vars: TVars) => Promise<WindowLoanContracts>,
) {
  const queryClient = useQueryClient();
  return useMutation<WindowLoanContracts, ApiError, TVars>({
    mutationFn,
    onSuccess: (status) =>
      queryClient.setQueryData(
        fundingKeys.windowLoanContracts(windowId),
        status,
      ),
  });
}

/** The business's signed copy of one investor's contract (NEAC-checked). */
export function useUploadWindowLoanContract(windowId: string) {
  return useLoanContractsMutation(
    windowId,
    ({ contractId, file }: { contractId: string; file: File }) =>
      fundingService.uploadSignedWindowLoanContract(windowId, contractId, file),
  );
}

export function useSendWindowGuarantorCode(windowId: string) {
  return useMutation<GuarantorCodeSent, ApiError, void>({
    mutationFn: () => fundingService.sendWindowGuarantorCode(windowId),
  });
}

/** The guarantor signs every contract with the Zalo code (not a condition). */
export function useSignWindowAsGuarantor(windowId: string) {
  return useLoanContractsMutation(windowId, (code: string) =>
    fundingService.signWindowAsGuarantor(windowId, code),
  );
}

/** The business accepts or declines its round on Day 13. */
export function useWindowDecision() {
  const queryClient = useQueryClient();
  return useMutation<
    FundingWindow,
    ApiError,
    { windowId: string; decision: "ACCEPT" | "DECLINE"; idempotencyKey: string }
  >({
    mutationFn: ({ windowId, decision, idempotencyKey }) =>
      fundingService.decide(windowId, decision, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fundingKeys.myRounds() });
      void queryClient.invalidateQueries({
        queryKey: [...fundingKeys.all, "window"],
      });
    },
  });
}

export function useReserveTicket() {
  const queryClient = useQueryClient();
  return useMutation<
    Tranche,
    ApiError,
    { windowId: string; body: ReserveRequest; idempotencyKey: string }
  >({
    mutationFn: ({ windowId, body, idempotencyKey }) =>
      fundingService.reserve(windowId, body, idempotencyKey),
    onSuccess: (tranche) => {
      queryClient.setQueryData<Tranche[]>(fundingKeys.myTranches(), (old) => [
        tranche,
        ...(old ?? []).filter((t) => t.id !== tranche.id),
      ]);
      // The window's reserved and capacity figures moved.
      queryClient.invalidateQueries({
        queryKey: [...fundingKeys.all, "window"],
      });
      // A first commitment is now waiting for the agreement to be signed.
      void queryClient.invalidateQueries({
        queryKey: fundingKeys.investorAgreement(),
        exact: true,
      });
    },
  });
}

export function useUploadReceipt() {
  const queryClient = useQueryClient();
  return useMutation<
    ReceiptResult,
    ApiError,
    { trancheId: string; file: File; idempotencyKey: string }
  >({
    mutationFn: ({ trancheId, file, idempotencyKey }) =>
      fundingService.uploadReceipt(trancheId, file, idempotencyKey),
    onSuccess: () => {
      // The ticket now carries receipt_submitted_at (or went UNDER_REVIEW).
      void queryClient.invalidateQueries({
        queryKey: fundingKeys.myTranches(),
      });
    },
  });
}

// The business's rounds and tickets.
export function useMyRounds(enabled = true) {
  return useQuery<SmeRound[], ApiError>({
    queryKey: fundingKeys.myRounds(),
    queryFn: () => fundingService.listMyRounds(),
    enabled,
    staleTime: 30 * 1000,
    retry: false,
  });
}

// Closing early moves the round's status and figures.
function useRoundMutation<TVars, TResult>(
  mutationFn: (vars: TVars) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, ApiError, TVars>({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fundingKeys.myRounds() });
    },
  });
}

export function useCloseRoundEarly() {
  return useRoundMutation((windowId: string) =>
    fundingService.closeEarly(windowId),
  );
}

export function useReportMissingTransfer() {
  return useRoundMutation<
    { trancheId: string; statement: string | null },
    SmeTicket
  >(({ trancheId, statement }) =>
    fundingService.reportMissingTransfer(trancheId, statement),
  );
}

// The business's daily repayments: projected until the loan forms, then real.
export function useRepaymentPlan(windowId: string, enabled = true) {
  return useQuery<SmeRepaymentPlan, ApiError>({
    queryKey: fundingKeys.repaymentPlan(windowId),
    queryFn: () => fundingService.getRepaymentPlan(windowId),
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
}
