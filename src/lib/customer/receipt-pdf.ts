// Shared PDF receipt generator — used by transfer success screen,
// transaction detail page, and the download button in transaction lists.
//
// Locale-aware: pass `{ locale, currency }` so the PDF matches the
// tenant's language/currency settings; falls back to en-US/USD.
import type { TxDetail } from "./transactions.functions";

export type ReceiptLocale = {
  locale?: string;
  currency?: string;
};

function fmt(v: number, c: string, locale?: string) {
  try {
    return new Intl.NumberFormat(locale ?? "en", { style: "currency", currency: c }).format(v);
  } catch {
    return `${c} ${v.toFixed(2)}`;
  }
}

function friendlyKind(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Localized field labels. English defaults; caller can pass a translator (t)
 * from useT() so PDF labels follow the customer's language.
 */
export type ReceiptStrings = {
  transactionReceipt: string;
  amount: string;
  status: string;
  successful: string;
  transactionType: string;
  currency: string;
  sender: string;
  senderAccount: string;
  recipient: string;
  recipientAccount: string;
  recipientBank: string;
  transactionId: string;
  transactionReference: string;
  date: string;
  time: string;
  channel: string;
  channelOnline: string;
  narration: string;
  footer: string;
};

const DEFAULT_STRINGS: ReceiptStrings = {
  transactionReceipt: "Transaction Receipt",
  amount: "Amount",
  status: "Status",
  successful: "Successful",
  transactionType: "Transaction Type",
  currency: "Currency",
  sender: "Sender",
  senderAccount: "Sender Account",
  recipient: "Recipient",
  recipientAccount: "Recipient Account",
  recipientBank: "Recipient Bank",
  transactionId: "Transaction ID",
  transactionReference: "Transaction Reference",
  date: "Date",
  time: "Time",
  channel: "Channel",
  channelOnline: "Online Banking",
  narration: "Narration",
  footer: "This receipt is system generated and does not require a signature.",
};

type Beneficiary = { name?: string; account_number?: string; bank_name?: string };

export async function buildReceiptPdf(
  t: TxDetail,
  logoUrl: string | null,
  opts: ReceiptLocale & { strings?: Partial<ReceiptStrings> } = {},
): Promise<{ blob: Blob; filename: string }> {
  const locale = opts.locale ?? undefined;
  const s: ReceiptStrings = { ...DEFAULT_STRINGS, ...(opts.strings ?? {}) };
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
  doc.text(s.transactionReceipt, marginX + 56, y + 22);
  doc.setTextColor(0);
  y += 60;

  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(s.amount, marginX, y);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(fmt(t.amount, t.currency, locale), marginX, y + 26);
  y += 50;

  const d = new Date(t.created_at);

  const fmtDate = (val: Date, o: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale ?? "en", o).format(val);
    } catch {
      return val.toISOString();
    }
  };

  const statusLabel =
    (t.status || "").toLowerCase() === "posted" || (t.status || "").toLowerCase() === "successful"
      ? s.successful
      : t.status || s.successful;

  const rows: [string, string][] = [
    [s.status, statusLabel.toUpperCase()],
    [s.transactionType, friendlyKind(t.kind)],
    [s.currency, t.currency],
    [s.sender, `${t.customer_name}`],
    [s.senderAccount, t.account_number || "—"],
    [s.recipient, beneficiary?.name ?? (t.direction === "credit" ? t.customer_name : "—")],
    [s.recipientAccount, beneficiary?.account_number ?? "—"],
    [s.recipientBank, beneficiary?.bank_name ?? t.bank_name],
    [s.transactionId, t.id],
    [s.transactionReference, t.reference ?? "—"],
    [s.date, fmtDate(d, { dateStyle: "medium" })],
    [s.time, fmtDate(d, { timeStyle: "medium" })],
    [s.channel, s.channelOnline],
    [s.narration, t.description || "—"],
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
  doc.text(s.footer, marginX, y);

  const blob = doc.output("blob");
  const filename = `receipt-${(t.reference ?? t.id).slice(0, 12)}.pdf`;
  return { blob, filename };
}

export async function downloadReceiptPdf(
  t: TxDetail,
  logoUrl: string | null,
  opts: ReceiptLocale & { strings?: Partial<ReceiptStrings> } = {},
) {
  const { blob, filename } = await buildReceiptPdf(t, logoUrl, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
