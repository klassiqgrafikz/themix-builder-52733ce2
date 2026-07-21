import { createFileRoute, Link, notFound, useMatch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { WebsiteManifest } from "@/lib/rendering/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { getTransactionDetail } from "@/lib/customer/transactions.functions";
import { buildReceiptPdf, downloadReceiptPdf } from "@/lib/customer/receipt-pdf";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Printer, Share2, Mail, Home } from "lucide-react";
import { useT, useLocale, useFormatCurrency, useFormatDate } from "@/lib/i18n";

const searchSchema = z.object({
  success: z
    .union([z.boolean(), z.string(), z.number()])
    .optional()
    .transform((v) => v === true || v === "true" || v === "1" || v === 1),
});

export const Route = createFileRoute("/$slug/portal/transactions/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ReceiptPage,
});

function friendlyKind(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

type Beneficiary = { name?: string; account_number?: string; bank_name?: string };

function ReceiptPage() {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormatCurrency();
  const fmtDate = useFormatDate();
  const { slug, id } = Route.useParams();
  const { success } = Route.useSearch();
  const navigate = useNavigate();
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
  };
  const manifest = parent.bank.manifest;
  const primary = manifest.theme.colors.primary;
  const logoUrl = manifest.brand.dashboard_logo_url ?? manifest.brand.login_logo_url ?? null;
  const doGet = useServerFn(getTransactionDetail);
  const qy = useQuery({
    queryKey: ["tx-detail", slug, id],
    queryFn: () => doGet({ data: { slug, id } }),
  });

  if (qy.isLoading) return <div className="text-sm opacity-70">{t("action.loading")}</div>;
  const tx = qy.data;
  if (!tx) throw notFound();
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

  const downloadPdf = () => downloadReceiptPdf(tx, logoUrl, pdfOpts);
  const printReceipt = () => window.print();

  const shareText = () => [
    `${tx.bank_name} — ${t("tx.transaction_receipt")}`,
    `${t("transfer.amount")}: ${fmt(tx.amount, { currency: tx.currency })}`,
    `${t("tx.status")}: ${tx.status}`,
    `${t("tx.reference")}: ${tx.reference ?? tx.id}`,
    `${t("tx.date")}: ${fmtDate(d, { dateStyle: "medium", timeStyle: "short" })}`,
    beneficiary?.name ? `${t("tx.recipient")}: ${beneficiary.name}` : "",
  ].filter(Boolean).join("\n");

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
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

  if (success) {
    return (
      <div className="space-y-4">
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
              {fmt(tx.amount, { currency: tx.currency })}
            </div>
            <div className="mt-2 text-sm capitalize text-emerald-700 font-medium">
              {t("tx.status")}: {tx.status}
            </div>
          </div>

          <dl className="mt-8 grid gap-3 border-t pt-6 text-sm md:grid-cols-2">
            <Field label={t("tx.sender")}>{tx.customer_name}</Field>
            <Field label={t("tx.sender_account")}>{tx.account_number || "—"}</Field>
            <Field label={t("tx.recipient")}>{beneficiary?.name ?? (tx.direction === "credit" ? tx.customer_name : "—")}</Field>
            <Field label={t("tx.recipient_bank")}>{beneficiary?.bank_name ?? tx.bank_name}</Field>
            <Field label={t("tx.recipient_account")}>{beneficiary?.account_number ?? "—"}</Field>
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
            <Button variant="outline" onClick={downloadPdf}>
              <Download className="mr-1 h-4 w-4" />{t("action.download")}
            </Button>
            <Button variant="outline" onClick={printReceipt}>
              <Printer className="mr-1 h-4 w-4" />{t("action.print")}
            </Button>
            <Button variant="outline" onClick={share}>
              <Share2 className="mr-1 h-4 w-4" />{t("action.share")}
            </Button>
          </div>

          <div className="mt-4 flex justify-center print:hidden">
            <Button size="lg" onClick={goDashboard} style={{ backgroundColor: primary }}>
              <Home className="mr-2 h-4 w-4" />{t("transfer.done_return")}
            </Button>
          </div>
        </BrandedCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link
          to="/$slug/portal/transactions"
          params={{ slug }}
          className="text-sm underline"
          style={{ color: primary }}
        >
          {t("tx.back_to_transactions")}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={printReceipt}>
            <Printer className="mr-1 h-4 w-4" />{t("action.print")}
          </Button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="mr-1 h-4 w-4" />{t("action.share")}
          </Button>
          <Button variant="outline" size="sm" disabled title={t("tx.email_soon")}>
            <Mail className="mr-1 h-4 w-4" />{t("action.email")}
          </Button>
          <Button size="sm" onClick={downloadPdf} style={{ backgroundColor: primary }}>
            <Download className="mr-1 h-4 w-4" />{t("action.download")}
          </Button>
        </div>
      </div>

      <BrandedCard manifest={manifest} className="print:border-none print:shadow-none">
        <div className="flex items-center gap-3 border-b pb-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-10 w-10 rounded object-contain" />
          ) : (
            <div
              className="grid h-10 w-10 place-items-center rounded text-white text-sm font-bold"
              style={{ backgroundColor: primary }}
            >
              {tx.bank_name.slice(0, 1)}
            </div>
          )}
          <div>
            <div className="text-xs uppercase opacity-70">{t("tx.transaction_receipt")}</div>
            <div className="text-lg font-semibold" style={{ color: primary }}>
              {tx.bank_name}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs uppercase opacity-70">{t("tx.status")}</div>
            <div className="font-semibold capitalize text-emerald-700">{tx.status}</div>
          </div>
        </div>

        {(() => {
          const balanceBefore =
            tx.direction === "credit"
              ? tx.balance_after - tx.amount
              : tx.direction === "debit"
                ? tx.balance_after + tx.amount
                : tx.balance_after;
          return (
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <Field label={t("tx.type")}>{friendlyKind(tx.kind)}</Field>
              <Field label={t("transfer.amount")}><span className="font-semibold">{fmt(tx.amount, { currency: tx.currency })}</span></Field>
              <Field label={t("transfer.currency")}>{tx.currency}</Field>
              <Field label={t("tx.direction")}><span className="capitalize">{tx.direction}</span></Field>
              <Field label={t("tx.sender")}>{tx.customer_name}</Field>
              <Field label={t("tx.sender_account")}>{tx.account_number || "—"}</Field>
              <Field label={t("tx.recipient")}>{beneficiary?.name ?? (tx.direction === "credit" ? tx.customer_name : "—")}</Field>
              <Field label={t("tx.recipient_account")}>{beneficiary?.account_number ?? "—"}</Field>
              <Field label={t("tx.recipient_bank")}>{beneficiary?.bank_name ?? tx.bank_name}</Field>
              <Field label={t("tx.channel")}>{t("tx.channel_online")}</Field>
              <Field label={t("tx.date")}>{fmtDate(d, { dateStyle: "medium" })}</Field>
              <Field label={t("tx.time")}>{fmtDate(d, { timeStyle: "medium" })}</Field>
              <Field label={t("tx.transaction_id")}><span className="break-all font-mono text-xs">{tx.id}</span></Field>
              <Field label={t("tx.transaction_ref")}><span className="break-all font-mono text-xs">{tx.reference ?? "—"}</span></Field>
              <Field label={t("tx.balance_before")}>{fmt(balanceBefore, { currency: tx.currency })}</Field>
              <Field label={t("tx.balance_after")}>{fmt(tx.balance_after, { currency: tx.currency })}</Field>
              <Field label={t("tx.charges")}>{fmt(0, { currency: tx.currency })}</Field>
              <div className="md:col-span-2">
                <dt className="text-xs uppercase opacity-70">{t("transfer.narration")}</dt>
                <dd>{tx.description}</dd>
              </div>
            </dl>
          );
        })()}

        <div className="mt-6 border-t pt-3 text-xs italic opacity-70">
          {t("tx.receipt_footer")}
        </div>
      </BrandedCard>
    </div>
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
