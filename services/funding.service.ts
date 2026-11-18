import { apiClient } from "@/lib/api-client";
import { FUNDING_ENDPOINTS } from "@/lib/endpoints";

/**
 * The version of the investing terms the investor reads (investment.terms in
 * lib/i18n). Must equal the backend's INVESTOR_TERMS_VERSION
 * (app/market/funding.py): change both with the text, or every reservation
 * answers 409 TERMS_OUTDATED.
 */
export const INVESTOR_TERMS_VERSION = "2026-10-30";

export type FundingWindowStatus =
  | "OPEN"
  | "FULL"
  | "CLOSING"
  | "REPAYING"
  | "FAILED"
  | "REPAID"
  | "CANCELLED"
  // Commit-then-accept rounds: Day 13 (the business decides) and Day 14
  // (investors sign and pay).
  | "AWAITING_SME"
  | "AWAITING_PAYMENT";

export type WindowFlow = "LEGACY" | "COMMIT_THEN_ACCEPT";
export type SmeDecision =
  "ACCEPTED" | "DECLINED" | "AUTO_ACCEPTED" | "AUTO_DECLINED";

// Mirrors backend FundingWindowOut. Money is integer VND.
export interface FundingWindow {
  id: string;
  listing_id: string;
  status: FundingWindowStatus;
  target_vnd: number;
  /** Below this confirmed at close, no loan forms and transfers are refunded. */
  min_raise_vnd: number;
  min_ticket_vnd: number;
  /** Transfers the business has confirmed. */
  confirmed_vnd: number;
  /** Held by investors who have not finished paying yet. */
  reserved_vnd: number;
  /** What is still open: the most one ticket can take. */
  capacity_vnd: number;
  /** Decimal string, e.g. "16.000". */
  annual_rate_pct: string;
  term_months: number;
  window_start: string;
  window_end: string;
  days_left: number;
  tranche_count: number;
  /*
   * Day-14 transfer rule (backend docs/specs/direct_transfer/
   * day14-transfer-rule.md 4.3). Null on LEGACY windows and absent from older
   * backends: without them the invest flow behaves as before.
   */
  /** Day 14, ISO date (YYYY-MM-DD). */
  disbursement_date?: string | null;
  /** Day 14, 14:45 ICT: signing and new QR codes close. */
  pay_deadline_at?: string | null;
  /** Day 14, 15:00 ICT: unpaid and late lenders are locked. */
  no_show_at?: string | null;
  /** Day 14, 15:30 ICT: the last receipt upload. */
  receipt_deadline_at?: string | null;
  /*
   * Commit-then-accept (backend commit-then-accept-flow.md 4.2, Money flow
   * FINAL v1.0). Null on LEGACY windows.
   */
  flow?: WindowFlow | null;
  /** 00:00 on Day 13: pledges and withdrawals end, the pledge list is final. */
  commit_closes_at?: string | null;
  /** 15:00 on Day 13: the business accepts or declines. */
  sme_deadline_at?: string | null;
  committed_total_vnd?: number | null;
  committed_pct?: number | null;
  sme_decision?: SmeDecision | null;
  sme_decided_at?: string | null;
}

/** One pledge (backend CommitmentOut). Money is integer VND. */
export interface Commitment {
  id: string;
  window_id: string;
  amount_vnd: number;
  status: "PLEDGED" | "FOLDED" | "VOID";
  committed_at: string;
  /** All of this investor's live pledges on the round. */
  my_committed_total_vnd: number;
  window_committed_total_vnd: number;
  window_target_vnd: number;
}

/** One investor's Day-13 loan contract (backend WindowLoanContractOut). */
export interface WindowLoanContract {
  id: string;
  contract_no: string;
  /** Masked. */
  lender_name: string;
  amount_vnd: number;
  status: "GENERATED" | "SME_SIGNED" | "INVESTOR_SIGNED" | "VOID";
  generated_at: string;
  sme_signed_at: string | null;
  investor_signed_at: string | null;
}

/**
 * Where Day-13 signing stands on the business's round. `signing_cutoff_at`:
 * 12:00 on Day 13 when the pledges are below 50% of the target (signing must
 * be done by then), else null. `all_signed`: Accept is open.
 */
export interface WindowLoanContracts {
  window_id: string;
  status: FundingWindowStatus;
  pledged_vnd: number;
  target_vnd: number;
  sme_deadline_at: string | null;
  signing_cutoff_at: string | null;
  all_signed: boolean;
  guarantor_signed_at: string | null;
  guarantor_phone: string | null;
  contracts: WindowLoanContract[];
}

/** A Zalo code sent to the guarantor. */
export interface GuarantorCodeSent {
  phone: string;
  channel: string;
  expires_in: number;
  resend_in: number;
}

/** A Zalo code sent for the Day-14 loan contract. */
export interface ContractCodeSent {
  sent_to_masked: string;
  channel: string;
  expires_in_seconds: number;
  resend_after_seconds: number;
}

export interface CommitRequest {
  amount_vnd: number;
  ack_risk_disclosure: boolean;
  terms_version: string;
  payment_account_id: string;
}

export type TrancheStatus =
  | "RESERVED"
  | "SIGNED"
  | "ATTESTED"
  | "CONFIRMED"
  | "ACTIVE"
  | "EXPIRED"
  | "UNDER_REVIEW"
  | "VOID";

/** A tranche in one of these still holds its place on the window. */
export const LIVE_TRANCHE_STATUSES: readonly TrancheStatus[] = [
  "RESERVED",
  "SIGNED",
  "ATTESTED",
  "CONFIRMED",
  "UNDER_REVIEW",
  "ACTIVE",
];

// Mirrors backend TrancheOut: one investor's ticket on a window.
export interface Tranche {
  id: string;
  window_id: string;
  status: TrancheStatus;
  amount_vnd: number;
  /** The payment memo: it ties the bank transfer to this ticket. */
  reference_code: string;
  /** Pay before this, or the hold lapses. */
  hold_expires_at: string;
  signed_at: string | null;
  attested_at: string | null;
  /** When the investor uploaded their transfer receipt; null until then. */
  receipt_submitted_at: string | null;
  /** In the investor's own list: the project the ticket is in. */
  project_id?: string | null;
  project_name?: string | null;
  /** Loan duration in months (from the project's funding window). */
  term_months?: number | null;
  /** Day-14 rule: whether the transfer was on time; null until checked. */
  payment_timing?: PaymentTiming | null;
  /** Why a LATE transfer was late. */
  late_reason?: LateReason | null;
}

export type PaymentTiming = "ON_TIME" | "LATE" | "PENDING_CHECK";
export type LateReason = "EXPIRED_CODE" | "NO_QR_CODE" | "AFTER_CUTOFF";

/** What the receipt upload is checked for, client-side, before it is sent. */
export const RECEIPT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

// Mirrors backend ReceiptResultOut.
export interface ReceiptResult {
  transfer_id: string;
  /** UNDER_REVIEW when the receipt came after the hold lapsed. */
  tranche_status: TrancheStatus;
  /** AWAITING_FIELDS: FundLok staff read the receipt. With automatic reading
   *  on (receipt-ocr.md): MATCHED with tranche_status CONFIRMED when it
   *  matched, REJECTED with failure_codes when it did not (upload the right
   *  one). */
  check_status: "AWAITING_FIELDS" | "MATCHED" | "MISMATCH" | "REJECTED" | "DUE";
  failure_codes: string[];
  confirmation_level: string;
}

/** One investor's ticket as the business sees it: the investor masked. */
export interface SmeTicket {
  id: string;
  amount_vnd: number;
  status: TrancheStatus;
  reference_code: string;
  /** e.g. "N. A***" */
  investor_display: string;
  receipt_submitted_at?: string | null;
  attested_at: string | null;
  confirm_deadline: string | null;
  review_cause: string | null;
  /** Confirmed automatically (24 hours of silence): the business may dispute
   * it with its bank statement until then. Null otherwise. */
  dispute_until?: string | null;
}

// Mirrors backend SmeRoundOut: the business's own round and its tickets.
export interface SmeRound extends FundingWindow {
  project_id: string;
  project_name: string;
  tickets: SmeTicket[];
  closing_started_at: string | null;
  close_wait_until: string | null;
  /** Set once the loan formed: the first repayment day. */
  repayment_start_date: string | null;
}

/** One day the business pays, summed over its investors. */
export interface SmeRepaymentDay {
  due_date: string;
  /** Investors' money coming back. */
  principal_vnd: number;
  /** Tax is withheld on this part only. */
  interest_vnd: number;
  /** What it owes that day: net to investors plus the tax it withholds. */
  gross_vnd: number;
  tax_withheld_vnd: number;
  net_vnd: number;
  /** Investors' tickets that day; paid / missing only once the loan formed. */
  tickets: number;
  paid: number;
  missing: number;
}

// Mirrors backend SmeRepaymentPlanOut.
export interface SmeRepaymentPlan {
  /** PROJECTED before the loan forms (not a promise), ACTUAL after. */
  kind: "PROJECTED" | "ACTUAL";
  assumed_close_date: string | null;
  start_date: string | null;
  days: SmeRepaymentDay[];
  totals: { gross_vnd: number; tax_withheld_vnd: number; net_vnd: number };
}

export interface ReserveRequest {
  amount_vnd: number;
  ack_risk_disclosure: boolean;
  terms_version: string;
}

// Mirrors backend PartyBOut: the investor as the agreement names them. A null
// prints as a dotted blank.
export interface AgreementPartyB {
  holder_type: "INDIVIDUAL" | "ENTITY" | null;
  name: string | null;
  /** Personal ID number, or enterprise code. */
  id_number: string | null;
  address: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
}

// Mirrors backend SignatureCheckOut: how the agreement on file was confirmed.
// "ZALO_OTP": with a one-time code sent to `phone`. "NEAC": an agreement of
// the earlier version, an uploaded digitally signed copy NEAC verified.
export interface AgreementSignatureCheck {
  verified_by: "ZALO_OTP" | "NEAC" | (string & {});
  checked_at: string;
  /** ZALO_OTP: the number the code went to, masked, e.g. "0703***489". */
  phone: string | null;
  /** The certificate's name, e.g. "CÔNG TY CỔ PHẦN FUNDLOK". */
  signer_name: string | null;
  /** As on the certificate, e.g. "MST:1501167629" or "CCCD:079…". */
  signer_id: string | null;
  /** The CA, e.g. "FPT Certification Authority SHA256". */
  issuer_name: string | null;
  signed_time: string | null;
  name_matches: boolean;
}

// Mirrors backend InvestorAgreementOut.
export interface InvestorAgreementStatus {
  /** The version the platform asks for now, printed on the PDF to sign. */
  version: string;
  /**
   * True until the investor confirms `version` with a one-time code.
   * Meanwhile a commitment is still made (with its code), but its payment
   * details wait: the agreement is confirmed with it first.
   */
  required: boolean;
  /**
   * The number the confirmation code is sent to by Zalo, masked
   * ("0703***489"): the account's phone. Null when the account has no
   * Vietnamese mobile number.
   */
  phone: string | null;
  /** When the current version was confirmed. */
  signed_at: string | null;
  /** Their latest signed version, of any version. */
  signed_version: string | null;
  /** The confirmed copy's file name. */
  file_name: string | null;
  /** The commitment it was signed with (its Annex is filled in the PDF). */
  tranche_id: string | null;
  /** How it was confirmed. */
  signature_check: AgreementSignatureCheck | null;
  /** As signed once signed; else as the PDF fills it in now. */
  party_b: AgreementPartyB;
}

// Mirrors backend AgreementCodeOut: where the confirmation code went.
export interface AgreementCodeSent {
  /** Masked, e.g. "0703***489". */
  phone: string;
  channel: "zalo" | "log";
  /** Seconds the code is good for. */
  expires_in: number;
  /** Seconds until another code may be requested. */
  resend_in: number;
}

// Mirrors backend InvestmentConfirmationOut: the Annex for one commitment.
export interface InvestmentConfirmation {
  listing_id: string;
  /** The listing id's first block, upper-case, as printed. */
  listing_ref: string;
  sme_name: string;
  amount_vnd: number;
  /** Decimal string, e.g. "16.000". */
  annual_rate_pct: string;
  term_months: number;
  /** P × 2.5% × M / 12, before VAT. */
  service_fee_vnd: number;
  service_fee_bps_per_year: number;
  /** ISO date (YYYY-MM-DD). */
  expected_disbursement_date: string;
}

// Mirrors backend SignedInvestmentConfirmationOut: one ticket's Annex, as
// filled in and confirmed when the investor agreed to it.
export interface SignedInvestmentConfirmation {
  id: string;
  tranche_id: string;
  /** The ticket's reference code, also its transfer memo. */
  reference_code: string;
  listing_id: string;
  listing_ref: string;
  sme_name: string;
  amount_vnd: number;
  /** Decimal string, e.g. "16.000". */
  annual_rate_pct: string;
  term_months: number;
  /** P × 2.5% × M / 12, before VAT. */
  service_fee_vnd: number;
  service_fee_bps_per_year: number;
  /** ISO date (YYYY-MM-DD). */
  expected_disbursement_date: string;
  confirmed_at: string;
  agreement_version: string;
}

// Mirrors backend PaymentOut: where to send the money, straight to the business.
export interface PaymentInstructions {
  bank_name: string;
  bank_bin: string;
  account_number: string;
  account_name: string;
  amount_vnd: number;
  reference_code: string;
  /** EMVCo VietQR text with the amount and memo in it; rendered client-side. */
  vietqr_payload: string;
  hold_expires_at: string;
  /*
   * Day-14 transfer rule (day14-transfer-rule.md 4.1). Each QR has its own
   * code and expiry. Absent from older backends: the UI then keeps its own
   * 15 minutes per QR in the browser and the memo is `reference_code`.
   */
  /** This QR's code, also the VietQR memo: reference_code + 4 digits. */
  qr_code?: string | null;
  qr_issued_at?: string | null;
  /** 15 minutes after issue, never past `pay_deadline_at`. */
  qr_expires_at?: string | null;
  /** 14:45 ICT on Day 14; null on LEGACY windows. */
  pay_deadline_at?: string | null;
  /** 15:30 ICT on Day 14; null on LEGACY windows. */
  receipt_deadline_at?: string | null;
  /** The server's clock when it answered: countdowns run on it, not the device's. */
  server_time?: string | null;
}

/** Day-14 rule: a late payer's money, recorded as their top-up. */
export type TopUpPledgeStatus =
  | "AWAITING_UNLOCK"
  | "AWAITING_SIGNING"
  | "VOID"
  // A backend can be ahead of this build (e.g. SIGNED once signing exists).
  | (string & {});

export interface TopUpPledge {
  id: string;
  window_id: string;
  listing_title: string | null;
  amount_vnd: number;
  recorded_at: string;
  status: TopUpPledgeStatus;
}

export type LenderStandingStatus = "GOOD" | "LOCKED" | "CLOSED";
export type UnlockRequirement = "EKYC" | "ACKNOWLEDGEMENT";

// Mirrors backend LenderStandingOut (commit-then-accept-flow.md 4.7,
// day14-transfer-rule.md 4.5).
export interface LenderStanding {
  status: LenderStandingStatus;
  no_show_count: number;
  locked_at: string | null;
  /** What unlocking takes: a fresh eKYC and/or typing the sentence. */
  unlock_requires: UnlockRequirement[];
  /** The sentence to type exactly to unlock. */
  acknowledgement_sentence: string | null;
  top_up_pledges: TopUpPledge[];
}

export const fundingService = {
  // GET /funding/listings/{id}/window — totals only, never other investors.
  getWindow(listingId: string) {
    return apiClient.get<FundingWindow>(FUNDING_ENDPOINTS.window(listingId));
  },

  // POST /funding/windows/{id}/reservations — holds the amount and signs the
  // acceptance of the terms. Replaying the same key returns the same ticket.
  commit(windowId: string, body: CommitRequest, idempotencyKey: string) {
    return apiClient.post<Commitment>(
      FUNDING_ENDPOINTS.commit(windowId),
      body,
      {
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  },

  listMyCommitments(windowId: string) {
    return apiClient.get<Commitment[]>(FUNDING_ENDPOINTS.myCommitments, {
      params: { window_id: windowId },
    });
  },

  withdrawCommitment(commitmentId: string) {
    return apiClient.post<Commitment>(
      FUNDING_ENDPOINTS.withdrawCommitment(commitmentId),
    );
  },

  getTrancheContractPdf(trancheId: string) {
    return apiClient.getFile(FUNDING_ENDPOINTS.trancheContract(trancheId));
  },

  sendContractCode(trancheId: string) {
    return apiClient.post<ContractCodeSent>(
      FUNDING_ENDPOINTS.trancheContractCode(trancheId),
    );
  },

  signContract(trancheId: string, code: string) {
    return apiClient.post<Tranche>(
      FUNDING_ENDPOINTS.trancheContract(trancheId),
      {
        code,
        click_to_sign: true,
      },
    );
  },

  getWindowLoanContracts(windowId: string) {
    return apiClient.get<WindowLoanContracts>(
      FUNDING_ENDPOINTS.windowLoanContracts(windowId),
    );
  },

  getWindowLoanContractPdf(windowId: string, contractId: string) {
    return apiClient.getFile(
      FUNDING_ENDPOINTS.windowLoanContractDocument(windowId, contractId),
      { params: { download: true } },
    );
  },

  uploadSignedWindowLoanContract(
    windowId: string,
    contractId: string,
    file: File,
  ) {
    const form = new FormData();
    form.append("file", file);
    // NEAC checks the signature (up to 45 s): wait longer than that.
    return apiClient.post<WindowLoanContracts>(
      FUNDING_ENDPOINTS.windowLoanContractSigned(windowId, contractId),
      form,
      { timeout: 60_000 },
    );
  },

  sendWindowGuarantorCode(windowId: string) {
    return apiClient.post<GuarantorCodeSent>(
      FUNDING_ENDPOINTS.windowGuarantorCode(windowId),
    );
  },

  signWindowAsGuarantor(windowId: string, code: string) {
    return apiClient.post<WindowLoanContracts>(
      FUNDING_ENDPOINTS.windowGuarantorSignature(windowId),
      { code },
    );
  },

  decide(
    windowId: string,
    decision: "ACCEPT" | "DECLINE",
    idempotencyKey: string,
  ) {
    return apiClient.post<FundingWindow>(
      FUNDING_ENDPOINTS.windowDecision(windowId),
      { decision },
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
  },

  reserve(windowId: string, body: ReserveRequest, idempotencyKey: string) {
    return apiClient.post<Tranche>(FUNDING_ENDPOINTS.reserve(windowId), body, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
  },

  // GET /funding/me/investor-agreement — whether the next commitment signs the
  // Investor Service Agreement too, and Party B.
  getInvestorAgreement() {
    return apiClient.get<InvestorAgreementStatus>(
      FUNDING_ENDPOINTS.investorAgreement,
    );
  },

  // GET /funding/me/investor-agreement/document — the agreement as a PDF,
  // filled in with the investor's details and the Annex of the commitment it
  // is confirmed with, to read before confirming.
  getInvestorAgreementPdf(trancheId: string) {
    return apiClient.getFile(FUNDING_ENDPOINTS.investorAgreementDocument, {
      params: { tranche_id: trancheId },
    });
  },

  // GET /funding/me/investor-agreement/signed — the copy kept when they
  // confirmed.
  getSignedInvestorAgreement() {
    return apiClient.getFile(FUNDING_ENDPOINTS.investorAgreementSigned);
  },

  // POST /funding/me/investor-agreement/code — send the one-time code that
  // confirms the agreement with this commitment, by Zalo to the account's
  // phone.
  sendInvestorAgreementCode(version: string, trancheId: string) {
    return apiClient.post<AgreementCodeSent>(
      FUNDING_ENDPOINTS.investorAgreementCode,
      { version, tranche_id: trancheId },
    );
  },

  // POST /funding/me/investor-agreement — confirm the agreement with this
  // commitment by the one-time code: the investor's signature. Opens that
  // commitment's payment details.
  signInvestorAgreement(version: string, trancheId: string, code: string) {
    return apiClient.post<InvestorAgreementStatus>(
      FUNDING_ENDPOINTS.investorAgreement,
      { version, tranche_id: trancheId, code },
    );
  },

  // GET /funding/windows/{id}/loan-contract — the Loan Contract the business
  // and its guarantor signed for this listing. 404 when the listing has none.
  getWindowLoanContract(windowId: string) {
    return apiClient.getFile(FUNDING_ENDPOINTS.windowLoanContract(windowId));
  },

  // GET /funding/windows/{id}/investment-confirmation — the Annex for this
  // amount on this window, as it will be signed.
  getInvestmentConfirmation(windowId: string, amountVnd: number) {
    return apiClient.get<InvestmentConfirmation>(
      FUNDING_ENDPOINTS.investmentConfirmation(windowId),
      { params: { amount_vnd: amountVnd } },
    );
  },

  // GET /funding/tranches/{id}/investment-confirmation — the Annex kept for
  // the caller's own ticket (404 for tickets from before they were kept).
  getTrancheConfirmation(trancheId: string) {
    return apiClient.get<SignedInvestmentConfirmation>(
      FUNDING_ENDPOINTS.trancheConfirmation(trancheId),
    );
  },

  // GET /funding/tranches/{id}/investment-confirmation/document — its PDF.
  getTrancheConfirmationPdf(trancheId: string) {
    return apiClient.getFile(
      FUNDING_ENDPOINTS.trancheConfirmationDocument(trancheId),
    );
  },

  // GET /funding/tranches/{id}/payment — the caller's own ticket only.
  getPayment(trancheId: string) {
    return apiClient.get<PaymentInstructions>(
      FUNDING_ENDPOINTS.payment(trancheId),
    );
  },

  // POST /funding/tranches/{id}/qr — a new QR with a new code (201, the same
  // body as getPayment). 409 PAY_DEADLINE_PASSED after 14:45, 409
  // TRANCHE_NOT_PAYABLE, 429 QR_TOO_SOON with Retry-After.
  issueNewQr(trancheId: string) {
    return apiClient.post<PaymentInstructions>(
      FUNDING_ENDPOINTS.newQr(trancheId),
    );
  },

  // GET /funding/me/standing — whether the investor may commit, and their
  // top-up pledges.
  getStanding() {
    return apiClient.get<LenderStanding>(FUNDING_ENDPOINTS.standing);
  },

  // POST /funding/me/standing/unlock — after a fresh eKYC, with the sentence
  // typed exactly. Answers the new standing.
  unlockStanding(acknowledgement: string) {
    return apiClient.post<LenderStanding>(FUNDING_ENDPOINTS.standingUnlock, {
      acknowledgement,
    });
  },

  // POST /funding/tranches/{id}/receipt — the investor's bank receipt for the
  // transfer. Replaying the same key returns the same result.
  uploadReceipt(trancheId: string, file: File, idempotencyKey: string) {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<ReceiptResult>(
      FUNDING_ENDPOINTS.receipt(trancheId),
      form,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
  },

  // GET /funding/me/rounds — the business's rounds, newest first.
  listMyRounds() {
    return apiClient.get<SmeRound[]>(FUNDING_ENDPOINTS.myRounds);
  },

  // GET /funding/me/rounds/{id}/repayment-plan — the business's daily
  // repayments to its investors.
  getRepaymentPlan(windowId: string) {
    return apiClient.get<SmeRepaymentPlan>(
      FUNDING_ENDPOINTS.repaymentPlan(windowId),
    );
  },

  // POST /funding/windows/{id}/close-early — once the minimum is confirmed.
  closeEarly(windowId: string) {
    return apiClient.post<FundingWindow>(
      FUNDING_ENDPOINTS.closeEarly(windowId),
    );
  },

  // POST /funding/tranches/{id}/report-missing — the business reports that an
  // investor's transfer has not reached its account.
  reportMissingTransfer(trancheId: string, statement: string | null) {
    return apiClient.post<SmeTicket>(
      FUNDING_ENDPOINTS.reportMissingTransfer(trancheId),
      { statement },
    );
  },

  // POST /funding/tranches/{id}/sme-receipt — the business confirms a transfer
  // with its own screenshot of the money arriving (within its 24 hours).
  confirmTransferWithReceipt(trancheId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<SmeTicket>(
      FUNDING_ENDPOINTS.smeReceipt(trancheId),
      form,
    );
  },

  // POST /funding/tranches/{id}/dispute — the business disputes a transfer
  // confirmed by its silence, with its bank statement, until dispute_until.
  disputeConfirmedTransfer(trancheId: string, statement: string, file: File) {
    const form = new FormData();
    form.append("statement", statement);
    form.append("file", file);
    return apiClient.post<SmeTicket>(
      FUNDING_ENDPOINTS.disputeTransfer(trancheId),
      form,
    );
  },

  // GET /funding/me/tranches — the investor's tickets, newest first.
  listMyTranches() {
    return apiClient.get<Tranche[]>(FUNDING_ENDPOINTS.myTranches);
  },
};
