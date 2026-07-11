import { createFileRoute, Link, notFound, useMatch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { WebsiteManifest } from "@/lib/rendering/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { getTransactionDetail, type TxDetail } from "@/lib/customer/transactions.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Printer, Share2, Mail, Home } from "lucide-react";

const searchSchema = z.object({ success: z.coerce.boolean().optional() });

export const Route = createFileRoute("/$slug/portal/transactions/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ReceiptPage,
});

function fmt(v: number, c: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(v); }
  catch { return `${c} ${v.toFixed(2)}`; }
}

function friendlyKind(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

type Beneficiary = { name?: string; account_number?: string; bank_name?: string };

async function buildReceiptPdf(
  t: TxDetail,
  logoUrl: string | null,
): Promise<{ blob: Blob; filename: string }> {
  const jspdfMod = await import("jspdf");
  const JsPDF = jspdfMod.jsPDF ?? jspdfMod.default;
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 56;

  const beneficiary = ((t.metadata as Record<string, unknown>).beneficiary ??
    (t.metadata as Record<string, unknown>).external_beneficiary) as Beneficiary | undefined;

  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      const buf = await res.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const mime = res.headers.get("content-type") ?? "image/png";
      const fmtType = /png/i.test(mime) ? "PNG" : "JPEG";
      doc.addImage(`data:${mime};base64,${b64}`, fmtType, marginX, y - 12, 44, 44);
    } catch {
      // ignore logo failures — receipt still generates
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(t.bank_name, marginX + 56, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Transaction Receipt", marginX + 56, y + 22);
  doc.setTextColor(0);
  y += 60;

  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text("Amount", marginX, y);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(fmt(t.amount, t.currency), marginX, y + 26);
  y += 50;

  const d = new Date(t.created_at);
  const rows: [string, string][] = [
    ["Status", (t.status || "successful").toUpperCase()],
    ["Transaction Type", friendlyKind(t.kind)],
    ["Currency", t.currency],
    ["Sender", `${t.customer_name}`],
    ["Sender Account", t.account_number || "—"],
    ["Recipient", beneficiary?.name ?? (t.direction === "credit" ? t.customer_name : "—")],
    ["Recipient Account", beneficiary?.account_number ?? "—"],
    ["Recipient Bank", beneficiary?.bank_name ?? t.bank_name],
    ["Transaction ID", t.id],
    ["Transaction Reference", t.reference ?? "—"],
    ["Date", d.toLocaleDateString()],
    ["Time", d.toLocaleTimeString()],
    ["Channel", "Online Banking"],
    ["Narration", t.description || "—"],
    ["Available Balance", fmt(t.balance_after, t.currency)],
  ];

  doc.setFontSize(10);
  const labelX = marginX;
  const valueX = marginX + 150;
  const rowH = 20;
  for (const [k, v] of rows) {
    if (y > 760) { doc.addPage(); y = 56; }
    doc.setTextColor(110);
    doc.setFont("helvetica", "normal");
    doc.text(k, labelX, y);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    const wrapped = doc.splitTextToSize(String(v), pageWidth - valueX - marginX);
    doc.text(wrapped, valueX, y);
    y += rowH * Math.max(1, wrapped.length);
  }

  y += 10;
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("This receipt is system generated and does not require a signature.", marginX, y);

  const blob = doc.output("blob");
  const filename = `receipt-${(t.reference ?? t.id).slice(0, 12)}.pdf`;
  return { blob, filename };
}

function ReceiptPage() {
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

  if (qy.isLoading) return <div className="text-sm opacity-70">Loading…</div>;
  const t = qy.data;
  if (!t) throw notFound();
  const meta = t.metadata as Record<string, unknown>;
  const beneficiary = (meta.beneficiary ?? meta.external_beneficiary) as Beneficiary | undefined;
  const d = new Date(t.created_at);

  const downloadPdf = async () => {
    const { blob, filename } = await buildReceiptPdf(t, logoUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const printReceipt = () => window.print();

  const shareText = () => [
    `${t.bank_name} — Transaction Receipt`,
    `Amount: ${fmt(t.amount, t.currency)}`,
    `Status: ${t.status}`,
    `Reference: ${t.reference ?? t.id}`,
    `Date: ${d.toLocaleString()}`,
    beneficiary?.name ? `Recipient: ${beneficiary.name}` : "",
  ].filter(Boolean).join("\n");

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      const { blob, filename } = await buildReceiptPdf(t, logoUrl);
      const file = new File([blob], filename, { type: "application/pdf" });
      const withFiles = nav as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && withFiles.canShare?.({ files: [file] })) {
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

  const emailReceipt = () => {
    const subject = encodeURIComponent(`${t.bank_name} receipt — ${t.reference ?? t.id}`);
    const body = encodeURIComponent(shareText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const goDashboard = () => navigate({ to: "/$slug/portal", params: { slug } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link
          to="/$slug/portal/transactions"
          params={{ slug }}
          className="text-sm underline"
          style={{ color: primary }}
        >
          ← Back to transactions
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={printReceipt}>
            <Printer className="mr-1 h-4 w-4" />Print
          </Button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="mr-1 h-4 w-4" />Share
          </Button>
          <Button variant="outline" size="sm" onClick={emailReceipt}>
            <Mail className="mr-1 h-4 w-4" />Email
          </Button>
          <Button size="sm" onClick={downloadPdf} style={{ backgroundColor: primary }}>
            <Download className="mr-1 h-4 w-4" />Download PDF
          </Button>
        </div>
      </div>

      <BrandedCard manifest={manifest} className="print:border-none print:shadow-none">
        {success && (
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <h1 className="mt-3 text-2xl font-bold text-emerald-700">Transfer Successful</h1>
            <div className="mt-1 text-xs uppercase tracking-wide opacity-60">
              {friendlyKind(t.kind)}
            </div>
            <div className="mt-3 text-4xl font-bold" style={{ color: primary }}>
              {fmt(t.amount, t.currency)}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 border-b pb-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-10 w-10 rounded object-contain" />
          ) : (
            <div
              className="grid h-10 w-10 place-items-center rounded text-white text-sm font-bold"
              style={{ backgroundColor: primary }}
            >
              {t.bank_name.slice(0, 1)}
            </div>
          )}
          <div>
            <div className="text-xs uppercase opacity-70">Transaction Receipt</div>
            <div className="text-lg font-semibold" style={{ color: primary }}>
              {t.bank_name}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs uppercase opacity-70">Status</div>
            <div className="font-semibold capitalize text-emerald-700">{t.status}</div>
          </div>
        </div>

        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <Field label="Transaction Type">{friendlyKind(t.kind)}</Field>
          <Field label="Amount"><span className="font-semibold">{fmt(t.amount, t.currency)}</span></Field>
          <Field label="Currency">{t.currency}</Field>
          <Field label="Direction"><span className="capitalize">{t.direction}</span></Field>
          <Field label="Sender">{t.customer_name}</Field>
          <Field label="Sender Account">{t.account_number || "—"}</Field>
          <Field label="Recipient">{beneficiary?.name ?? (t.direction === "credit" ? t.customer_name : "—")}</Field>
          <Field label="Recipient Account">{beneficiary?.account_number ?? "—"}</Field>
          <Field label="Recipient Bank">{beneficiary?.bank_name ?? t.bank_name}</Field>
          <Field label="Channel">Online Banking</Field>
          <Field label="Date">{d.toLocaleDateString()}</Field>
          <Field label="Time">{d.toLocaleTimeString()}</Field>
          <Field label="Transaction ID"><span className="break-all font-mono text-xs">{t.id}</span></Field>
          <Field label="Transaction Reference"><span className="break-all font-mono text-xs">{t.reference ?? "—"}</span></Field>
          <Field label="Available Balance">{fmt(t.balance_after, t.currency)}</Field>
          <Field label="Charges">{fmt(0, t.currency)}</Field>
          <div className="md:col-span-2">
            <dt className="text-xs uppercase opacity-70">Narration</dt>
            <dd>{t.description}</dd>
          </div>
        </dl>

        <div className="mt-6 border-t pt-3 text-xs italic opacity-70">
          This receipt is system generated and does not require a signature.
        </div>

        {success && (
          <div className="mt-6 flex justify-center print:hidden">
            <Button size="lg" onClick={goDashboard} style={{ backgroundColor: primary }}>
              <Home className="mr-2 h-4 w-4" />Done — Return to Dashboard
            </Button>
          </div>
        )}
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
