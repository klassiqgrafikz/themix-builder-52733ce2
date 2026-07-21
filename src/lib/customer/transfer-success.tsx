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
      balanceBefore: t("tx.balance_before"),
      balanceAfter: t("tx.balance_after"),
      footer: t("tx.receipt_footer"),
    },
  };

  const doDownload = () => downloadReceiptPdf(tx, logoUrl, pdfOpts);
  const doPrint = () => window.print();

  const shareText = () => [
    `${tx.bank_name} — ${t("tx.transaction_receipt")}`,
    `${t("transfer.amount")}: ${fmtCur(tx.amount, { currency: tx.currency })}`,
    `${t("tx.status")}: ${tx.status}`,
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
      <div className="flex flex-col items-center text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" />
        </div>
        <h1 className="mt-4 text-3xl font-bold text-emerald-700">{t("transfer.success")}</h1>
        <div className="mt-1 text-xs uppercase tracking-wide opacity-60">
          {friendlyKind(tx.kind)}
        </div>
        <div className="mt-4 text-5xl font-bold" style={{ color: primary }}>
          {fmtCur(tx.amount, { currency: tx.currency })}
        </div>
        <div className="mt-2 text-sm capitalize text-emerald-700 font-medium">
          {t("tx.status")}: {tx.status}
        </div>
      </div>

      <dl className="mt-8 grid gap-3 border-t pt-6 text-sm md:grid-cols-2">
        <Field label={t("tx.sender")}>{tx.customer_name}</Field>
        <Field label={t("tx.sender_account")}>{tx.account_number || "—"}</Field>
        <Field label={t("tx.recipient")}>{beneficiary?.name ?? (tx.direction === "credit" ? tx.customer_name : "—")}</Field>
        <Field label={t("tx.recipient_account")}>{beneficiary?.account_number ?? "—"}</Field>
        <Field label={t("tx.recipient_bank")}>{beneficiary?.bank_name ?? tx.bank_name}</Field>
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

      <div className="mt-8 flex flex-wrap justify-center gap-2 print:hidden">
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
