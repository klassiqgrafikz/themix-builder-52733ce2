// Shared PDF receipt generator — used by transfer success screen,
// transaction detail page, and the download button in transaction lists.
import type { TxDetail } from "./transactions.functions";

function fmt(v: number, c: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(v);
  } catch {
    return `${c} ${v.toFixed(2)}`;
  }
}

function friendlyKind(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

type Beneficiary = { name?: string; account_number?: string; bank_name?: string };

export async function buildReceiptPdf(
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
      // ignore
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
  const balanceBefore =
    t.direction === "credit"
      ? t.balance_after - t.amount
      : t.direction === "debit"
        ? t.balance_after + t.amount
        : t.balance_after;
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
    ["Balance Before", fmt(balanceBefore, t.currency)],
    ["Balance After", fmt(t.balance_after, t.currency)],
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

export async function downloadReceiptPdf(t: TxDetail, logoUrl: string | null) {
  const { blob, filename } = await buildReceiptPdf(t, logoUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
