import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Download, Printer, Share2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandedCard } from "@/lib/customer/portal-ui";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { TxDetail } from "./transactions.functions";
import { buildReceiptPdf, downloadReceiptPdf } from "./receipt-pdf";
import { useT, useLocale, useFormatCurrency, useFormatDate } from "@/lib/i18n";

function friendlyKind(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Map internal CBE statuses to customer-facing labels ("posted" -> "Successful"). */
export function receiptStatus(t: ReturnType<typeof useT>, status: string): string {
  switch ((status || "").toLowerCase()) {
    case "posted":
    case "successful":
      return t("status.successful");
    default:
      return status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
  }
}

type Beneficiary = { name?: string; account_number?: string; bank_name?: string };

export function TransferSuccessReceipt({
  tx,
  slug,
  manifest,
}: {
  tx: TxDetail;
  slug: string;
  manifest: WebsiteManifest;
}) {
  const t = useT();
  const locale = useLocale();
  const fmtCur = useFormatCurrency();
  const fmtDate = useFormatDate();
  const navigate = useNavigate();
  const primary = manifest.theme.colors.primary;
  const logoUrl = manifest.brand.dashboard_logo_url ?? manifest.brand.login_logo_url ?? null;
  const meta = tx.metadata as Record<string, unknown>;
  const beneficiary = (meta.beneficiary ?? meta.external_beneficiary) as Beneficiary | undefined;
  const d = new Date(tx.created_at);
  const statusText = receiptStatus(t, tx.status);

  const pdfOpts = {
    locale: locale.code,
    currency: tx.currency,
    strings: {
      transactionReceipt: t("tx.transaction_receipt"),
      amount: t("transfer.amount"),
      status: t("tx.status"),
      transactionType: t("tx.type"),
      currency: t("transfer.currency"),
      sender: t("tx.sender"),
      senderAccount: t("tx.sender_account"),
      recipient: t("tx.recipient"),
      recipientAccount: t("tx.recipient_account"),
      recipientBank: t("tx.recipient_bank"),
      transactionId: t("tx.transaction_id"),
      transactionReference: t("tx.transaction_ref"),
      date: t("tx.date"),
      time: t("tx.time"),
      channel: t("tx.channel"),
      channelOnline: t("tx.channel_online"),
      narration: t("transfer.narration"),
      footer: t("tx.receipt_footer"),
    },
  };

  const doDownload = () => downloadReceiptPdf(tx, logoUrl, pdfOpts);
  const doPrint = () => window.print();

  const shareText = () => [
    `${tx.bank_name} — ${t("tx.transaction_receipt")}`,
    `${t("transfer.amount")}: ${fmtCur(tx.amount, { currency: tx.currency })}`,
    `${t("tx.status")}: ${statusText}`,
    `${t("tx.reference")}: ${tx.reference ?? tx.id}`,
    `${t("tx.date")}: ${fmtDate(d, { dateStyle: "medium", timeStyle: "short" })}`,
    beneficiary?.name ? `${t("tx.recipient")}: ${beneficiary.name}` : "",
  ].filter(Boolean).join("\n");

  const doShare = async () => {
    const nav = navigator as Navigator & {
      share?: (d: ShareData) => Promise<void>;
      canShare?: (d: ShareData) => boolean;
    };
    try {
      const { blob, filename } = await buildReceiptPdf(tx, logoUrl, pdfOpts);
      const file = new File([blob], filename, { type: "application/pdf" });
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: t("tx.transaction_receipt"), text: shareText() });
        return;
      }
      if (nav.share) {
        await nav.share({ title: t("tx.transaction_receipt"), text: shareText() });
        return;
      }
    } catch { /* fall through */ }
    await navigator.clipboard.writeText(shareText());
  };

  const goDashboard = () => navigate({ to: "/$slug/portal", params: { slug } });

  return (
    <BrandedCard manifest={manifest} className="print:border-none print:shadow-none">
      <div className="flex items-start justify-between gap-4 border-b pb-5">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-11 w-11 flex-none rounded object-contain" />
          ) : (
            <div
              className="grid h-11 w-11 flex-none place-items-center rounded-lg text-base font-bold text-white"
              style={{ backgroundColor: primary }}
            >
              {tx.bank_name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold" style={{ color: primary }}>
              {tx.bank_name}
            </div>
            <div className="text-xs uppercase tracking-[0.16em] opacity-70">
              {t("tx.transaction_receipt")}
            </div>
          </div>
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5 text-right">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> {statusText}
          </span>
          <span className="text-[11px] uppercase tracking-wide opacity-60">
            {t("tx.transaction_ref")}: {tx.reference ?? "—"}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] opacity-60">
            {t("transfer.amount")}
          </div>
          <div className="mt-1 text-4xl font-bold" style={{ color: primary }}>
            {fmtCur(tx.amount, { currency: tx.currency })}
          </div>
        </div>
        <div className="text-xs uppercase tracking-wide opacity-60">
          {friendlyKind(tx.kind)} · {tx.currency}
        </div>
      </div>

      <dl className="mt-6 grid gap-x-8 gap-y-4 border-t pt-5 text-sm md:grid-cols-2">
        <Field label={t("tx.sender")}>{tx.customer_name}</Field>
        <Field label={t("tx.sender_account")}>{tx.account_number || "—"}</Field>
        <Field label={t("tx.recipient")}>{beneficiary?.name ?? (tx.direction === "credit" ? tx.customer_name : "—")}</Field>
        <Field label={t("tx.recipient_account")}>{beneficiary?.account_number ?? "—"}</Field>
        <Field label={t("tx.recipient_bank")}>{beneficiary?.bank_name ?? tx.bank_name}</Field>
        <Field label={t("tx.channel")}>{t("tx.channel_online")}</Field>
        <Field label={t("tx.date")}>{fmtDate(d, { dateStyle: "medium" })}</Field>
        <Field label={t("tx.time")}>{fmtDate(d, { timeStyle: "medium" })}</Field>
        <Field label={t("tx.transaction_ref")}>
          <span className="break-all font-mono text-xs">{tx.reference ?? "—"}</span>
        </Field>
        <Field label={t("tx.transaction_id")}>
          <span className="break-all font-mono text-xs">{tx.id}</span>
        </Field>
        <div className="md:col-span-2">
          <dt className="text-xs uppercase opacity-70">{t("transfer.narration")}</dt>
          <dd>{tx.description}</dd>
        </div>
      </dl>

      <div className="mt-6 border-t pt-3 text-center text-xs italic opacity-70">
        {t("tx.receipt_footer")}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2 print:hidden">
        <Button variant="outline" onClick={doDownload}>
          <Download className="mr-1 h-4 w-4" />{t("action.download")}
        </Button>
        <Button variant="outline" onClick={doPrint}>
          <Printer className="mr-1 h-4 w-4" />{t("action.print")}
        </Button>
        <Button variant="outline" onClick={doShare}>
          <Share2 className="mr-1 h-4 w-4" />{t("action.share")}
        </Button>
      </div>

      <div className="mt-4 flex justify-center print:hidden">
        <Button size="lg" onClick={goDashboard} style={{ backgroundColor: primary }}>
          <Home className="mr-2 h-4 w-4" />{t("transfer.done_return")}
        </Button>
      </div>
    </BrandedCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase opacity-70">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
