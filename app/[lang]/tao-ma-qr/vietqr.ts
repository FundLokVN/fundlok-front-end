import bankCatalog from "./banks.json";

export const banks = bankCatalog.banks;
export const templates = ["details", "compact", "qr-only"] as const;
export const defaultAccent = "#7755ee";
export const businessNameLimit = 36;

export type QrFields = {
  bank: string;
  account: string;
  name: string;
  amount: string;
  memo: string;
  template: (typeof templates)[number];
  businessName: string;
  accent: string;
};

export function readFields(read: (key: string) => unknown): QrFields {
  const get = (key: string) => String(read(key) ?? "").trim();
  const template = templates.find((value) => value === get("template"));
  const accent = get("accent");

  return {
    bank: get("bank").slice(0, 7),
    account: get("account").slice(0, 20),
    name: get("name").slice(0, 80),
    amount: get("amount").slice(0, 14),
    memo: get("memo").slice(0, 50),
    template: template ?? "details",
    businessName: get("businessName").slice(0, businessNameLimit),
    accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : defaultAccent,
  };
}

function tlv(tag: string, value: string): string {
  return tag + String(value.length).padStart(2, "0") + value;
}

// Matches FundLok's direct_transfer/vietqr.py (NAPAS transfer to account).
export function createVietQr(fields: QrFields) {
  const bank = banks.find(({ bin }) => bin === fields.bank);
  if (!bank || !/^[a-z0-9]{1,19}$/i.test(fields.account)) return null;
  if (
    fields.amount &&
    (!/^\d{1,13}$/.test(fields.amount) || !Number(fields.amount))
  ) {
    return null;
  }

  const amount = fields.amount ? String(Number(fields.amount)) : "";
  const memo = fields.memo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
  const beneficiary = tlv("00", bank.bin) + tlv("01", fields.account);
  const accountInfo =
    tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  const body =
    tlv("00", "01") +
    tlv("01", amount ? "12" : "11") +
    tlv("38", accountInfo) +
    tlv("53", "704") +
    (amount ? tlv("54", amount) : "") +
    tlv("58", "VN") +
    (memo ? tlv("62", tlv("08", memo)) : "") +
    "6304";

  let crc = 0xffff;
  for (const char of body) {
    crc ^= char.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
    }
  }

  return {
    fields: { ...fields, amount, memo },
    bank,
    payload: body + crc.toString(16).toUpperCase().padStart(4, "0"),
  };
}

export function shareFragment(fields: QrFields): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value) params.set(key, value);
  }
  return "#" + params.toString();
}
