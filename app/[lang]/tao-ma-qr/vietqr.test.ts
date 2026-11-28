import { describe, expect, it } from "vitest";
import {
  createVietQr,
  readFields,
  shareFragment,
  type QrFields,
} from "./vietqr";

const account: QrFields = {
  bank: "970436",
  account: "001234abcd",
  name: "Nguyễn Văn An",
  amount: "",
  memo: "",
  template: "details",
};

describe("public VietQR generator", () => {
  // Expected payloads came from the FundLok backend's VietQR builders.
  it("matches the backend’s static account QR and preserves leading zeros", () => {
    expect(createVietQr(account)?.payload).toBe(
      "00020101021138540010A000000727012400069704360110001234abcd0208QRIBFTTA53037045802VN6304AA69",
    );
  });

  it("matches a fixed-amount backend QR with a normalized transfer note", () => {
    const qr = createVietQr({
      ...account,
      bank: "970415",
      account: "00123456789",
      amount: "0100000",
      memo: "Đóng góp đơn #123",
    });
    expect(qr?.payload).toBe(
      "00020101021238550010A000000727012500069704150111001234567890208QRIBFTTA530370454061000005802VN62200816Dong gop don 1236304AD85",
    );
  });

  it("round-trips a share link with Vietnamese names and a selected template", () => {
    const original = {
      ...account,
      name: "An & Đạt",
      template: "qr-only" as const,
    };
    const params = new URLSearchParams(shareFragment(original).slice(1));
    expect(readFields((key) => params.get(key))).toEqual(original);
  });

  it.each([
    { bank: "000000" },
    { account: "12/34" },
    { account: "12345678901234567890" },
    { amount: "0" },
    { amount: "1.5" },
    { amount: "12345678901234" },
  ])("rejects invalid transfer details %j", (values) => {
    expect(createVietQr({ ...account, ...values })).toBeNull();
  });
});
