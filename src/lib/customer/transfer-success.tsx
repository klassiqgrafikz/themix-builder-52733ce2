import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Download, Printer, Share2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandedCard } from "@/lib/customer/portal-ui";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { TxDetail } from "./transactions.functions";
import { buildReceiptPdf, downloadReceiptPdf } from "./receipt-pdf";

function fmt(v: number, c: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(v); }
  catch { return `${c} ${v.toFixed(2)}`; }
}

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
  const navigate = useNavigate();
  const primary = manifest.theme.colors.primary;
  const logoUrl = manifest.brand.dashboard_logo_url ?? manifest.brand.login_logo_url ?? null;
  const meta = tx.metadata as Record<string, unknown>;
  const beneficiary = (meta.beneficiary ?? meta.external_beneficiary) as Beneficiary | undefined;
  const d = new Date(tx.created_at);

  const doDownload = () => downloadReceiptPdf(tx, logoUrl);
  const doPrint = () => window.print();

  const shareText = () => [
    `${tx.bank_name} — Transaction Receipt`,
    `Amount: ${fmt(tx.amount, tx.currency)}`,
    `Status: ${tx.status}`,
    `Reference: ${tx.reference ?? tx.id}`,
    `Date: ${d.toLocaleString()}`,
    beneficiary?.name ? `Recipient: ${beneficiary.name}` : "",
  ].filter(Boolean).join("\n");

  const doShare = async () => {
    const nav = navigator as Navigator & {
      share?: (d: ShareData) => Promise<void>;
      canShare?: (d: ShareData) => boolean;
    };
    try {
      const { blob, filename } = await buildReceiptPdf(tx, logoUrl);
      const file = new File([blob], filename, { type: "application/pdf" });
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Transaction Receipt", text: shareText() });
        return;
      }
      if (nav.share) {
        await nav.share({ title: "Transaction Receipt", text: shareText() });
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
        <h1 className="mt-4 text-3xl font-bold text-emerald-700">Transfer Successful</h1>
        <div className="mt-1 text-xs uppercase tracking-wide opacity-60">
          {friendlyKind(tx.kind)}
        </div>
        <div className="mt-4 text-5xl font-bold" style={{ color: primary }}>
          {fmt(tx.amount, tx.currency)}
        </div>
        <div className="mt-2 text-sm capitalize text-emerald-700 font-medium">
          Status: {tx.status}
        </div>
      </div>

      <dl className="mt-8 grid gap-3 border-t pt-6 text-sm md:grid-cols-2">
        <Field label="Sender">{tx.customer_name}</Field>
        <Field label="Sender Account">{tx.account_number || "—"}</Field>
        <Field label="Recipient">{beneficiary?.name ?? (tx.direction === "credit" ? tx.customer_name : "—")}</Field>
        <Field label="Recipient Account">{beneficiary?.account_number ?? "—"}</Field>
        <Field label="Recipient Bank">{beneficiary?.bank_name ?? tx.bank_name}</Field>
        <Field label="Date">{d.toLocaleDateString()}</Field>
        <Field label="Time">{d.toLocaleTimeString()}</Field>
        <Field label="Transaction Reference">
          <span className="break-all font-mono text-xs">{tx.reference ?? "—"}</span>
        </Field>
        <Field label="Transaction ID">
          <span className="break-all font-mono text-xs">{tx.id}</span>
        </Field>
        <div className="md:col-span-2">
          <dt className="text-xs uppercase opacity-70">Narration</dt>
          <dd>{tx.description}</dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap justify-center gap-2 print:hidden">
        <Button variant="outline" onClick={doDownload}>
          <Download className="mr-1 h-4 w-4" />Download PDF
        </Button>
        <Button variant="outline" onClick={doPrint}>
          <Printer className="mr-1 h-4 w-4" />Print
        </Button>
        <Button variant="outline" onClick={doShare}>
          <Share2 className="mr-1 h-4 w-4" />Share
        </Button>
      </div>

      <div className="mt-4 flex justify-center print:hidden">
        <Button size="lg" onClick={goDashboard} style={{ backgroundColor: primary }}>
          <Home className="mr-2 h-4 w-4" />Done — Return to Dashboard
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
