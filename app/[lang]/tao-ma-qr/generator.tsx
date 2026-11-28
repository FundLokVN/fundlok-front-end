"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import QRCode from "react-qr-code";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/lib/i18n";
import {
  banks,
  createVietQr,
  readFields,
  shareFragment,
  templates,
} from "./vietqr";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function GeneratorForm({ hash }: { hash: string }) {
  const { t, locale } = useTranslations();
  const params = new URLSearchParams(hash.slice(1));
  const initial = readFields((key) => params.get(key));
  const [qr, setQr] = useState(() => createVietQr(initial));
  const [invalid, setInvalid] = useState(false);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const result = createVietQr(readFields((key) => values.get(key)));
    setQr(result);
    setInvalid(!result);
    setCopy("idle");
  }

  async function copyLink() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  const link = qr
    ? window.location.origin +
      window.location.pathname +
      shareFragment(qr.fields)
    : "";
  const amount = qr?.fields.amount
    ? new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
        style: "currency",
        currency: "VND",
      }).format(Number(qr.fields.amount))
    : t("vietqrPage.openAmount");

  return (
    <div className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <form
        className="space-y-5 p-5 sm:p-8"
        // A native submit before hydration must not put account data in a URL.
        method="dialog"
        onSubmit={generate}
        onChange={() => {
          setQr(null);
          setInvalid(false);
          setCopy("idle");
        }}
      >
        <h2 className="text-lg font-semibold">{t("vietqrPage.details")}</h2>
        <div className="space-y-2">
          <Label htmlFor="qr-bank">{t("vietqrPage.bank")}</Label>
          <select
            id="qr-bank"
            name="bank"
            required
            defaultValue={initial.bank}
            className={selectClass}
          >
            <option value="" disabled>
              {t("vietqrPage.chooseBank")}
            </option>
            {banks.map(({ bin, name }) => (
              <option key={bin} value={bin}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="qr-account">{t("vietqrPage.account")}</Label>
            <Input
              id="qr-account"
              name="account"
              required
              pattern="[A-Za-z0-9]{1,19}"
              maxLength={19}
              autoComplete="off"
              defaultValue={initial.account}
              placeholder="0123456789"
              className="h-11"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="qr-name">{t("vietqrPage.name")}</Label>
            <Input
              id="qr-name"
              name="name"
              maxLength={80}
              autoComplete="off"
              defaultValue={initial.name}
              className="h-11"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="qr-amount">{t("vietqrPage.amount")}</Label>
            <Input
              id="qr-amount"
              name="amount"
              inputMode="numeric"
              pattern="[0-9]{1,13}"
              maxLength={13}
              defaultValue={initial.amount}
              placeholder="100000"
              className="h-11"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="qr-template">{t("vietqrPage.template")}</Label>
            <select
              id="qr-template"
              name="template"
              defaultValue={initial.template}
              className={selectClass}
            >
              {templates.map((template) => (
                <option key={template} value={template}>
                  {t(`vietqrPage.templates.${template}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="qr-memo">{t("vietqrPage.memo")}</Label>
          <Textarea
            id="qr-memo"
            name="memo"
            rows={2}
            maxLength={50}
            defaultValue={initial.memo}
            aria-describedby="qr-memo-hint"
          />
          <p className="text-xs text-muted-foreground" id="qr-memo-hint">
            {t("vietqrPage.memoHint")}
          </p>
        </div>
        {invalid && (
          <p role="alert" className="text-sm text-destructive">
            {t("vietqrPage.invalid")}
          </p>
        )}
        <Button type="submit" size="lg">
          <QrCode aria-hidden="true" />
          {t("vietqrPage.generate")}
        </Button>
      </form>

      <section
        aria-label={t("vietqrPage.preview")}
        className="min-w-0 space-y-5 border-t bg-muted/50 p-5 sm:p-8 lg:border-t-0 lg:border-l"
      >
        <h2 className="text-lg font-semibold">{t("vietqrPage.preview")}</h2>
        {qr ? (
          <>
            <div className="mx-auto w-full max-w-xs rounded-xl border bg-card p-4 text-center">
              {qr.fields.template !== "qr-only" && (
                <p className="mb-3 text-sm font-semibold">{qr.bank.name}</p>
              )}
              {/* Keep a light quiet zone and dark modules in both themes. */}
              <div className="mx-auto aspect-square w-full max-w-60 rounded bg-white p-4">
                <QRCode
                  value={qr.payload}
                  title={t("vietqrPage.preview")}
                  className="h-auto w-full"
                />
              </div>
              {qr.fields.template === "details" && (
                <div className="mt-3 space-y-1 break-words">
                  {qr.fields.name && (
                    <p className="text-sm font-semibold">{qr.fields.name}</p>
                  )}
                  <p className="font-mono text-sm">{qr.fields.account}</p>
                  <p className="text-sm text-muted-foreground">{amount}</p>
                </div>
              )}
            </div>
            {qr.fields.template !== "details" && (
              <p className="break-words text-center text-sm text-muted-foreground">
                {[qr.bank.name, qr.fields.account, qr.fields.name, amount]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {qr.fields.memo && (
              <p className="break-words text-center text-sm text-muted-foreground">
                {t("vietqrPage.memo")}
                {": "}
                {qr.fields.memo}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="qr-link">{t("vietqrPage.link")}</Label>
              <div className="flex min-w-0 gap-2">
                <Input
                  id="qr-link"
                  value={link}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0"
                />
                <Button type="button" variant="outline" onClick={copyLink}>
                  {copy === "copied" ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Copy aria-hidden="true" />
                  )}
                  {t(
                    copy === "copied" ? "vietqrPage.copied" : "vietqrPage.copy",
                  )}
                </Button>
              </div>
              <p role="status" className="text-xs text-muted-foreground">
                {t(
                  copy === "failed"
                    ? "vietqrPage.copyFailed"
                    : "vietqrPage.shareHint",
                )}
              </p>
            </div>
          </>
        ) : (
          <div className="grid min-h-72 place-items-center rounded-xl border border-dashed bg-background/60 p-6 text-center">
            <div className="max-w-64 space-y-3 text-sm text-muted-foreground">
              <QrCode
                aria-hidden="true"
                className="mx-auto size-9 text-primary"
              />
              <p>{t("vietqrPage.empty")}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function VietQrGenerator() {
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  );
  return <GeneratorForm key={hash} hash={hash} />;
}
