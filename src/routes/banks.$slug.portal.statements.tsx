import { createFileRoute, useMatch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { generateStatementCsv } from "@/lib/customer/transactions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/banks/$slug/portal/statements")({
  component: StatementsPage,
});

function fmt(v: number, c: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(v); }
  catch { return `${c} ${v.toFixed(2)}`; }
}

async function loadImage(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

function StatementsPage() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [account, setAccount] = useState(session.accounts[0]?.id ?? "");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const doGen = useServerFn(generateStatementCsv);
  const mut = useMutation({
    mutationFn: async () => {
      const r = await doGen({
        data: {
          slug: bank.slug,
          account_id: account,
          from: new Date(from).toISOString(),
          to: new Date(new Date(to).getTime() + 86400000).toISOString(),
        },
      });
      const selectedAccount = session.accounts.find((a) => a.id === account);
      const customer = session.customer;
      const manifest = bank.manifest;

      // Parse CSV back into rows for the PDF table (already sorted by date).
      const lines = r.csv.split("\n").filter((l) => l.trim() !== "");
      const dataLines = lines.slice(1);
      const rows = dataLines.map((line) => {
        // Simple CSV parser (handles JSON.stringify'd cells for text fields).
        const parts: string[] = [];
        let cur = "";
        let inStr = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inStr) {
            if (ch === '"' && line[i - 1] !== "\\") { inStr = false; cur += ch; }
            else cur += ch;
          } else {
            if (ch === '"') { inStr = true; cur += ch; }
            else if (ch === ",") { parts.push(cur); cur = ""; }
            else cur += ch;
          }
        }
        parts.push(cur);
        const [date, descRaw, refRaw, debit, credit, balance] = parts;
        const desc = descRaw?.startsWith('"') ? JSON.parse(descRaw) : descRaw ?? "";
        const ref = refRaw?.startsWith('"') ? JSON.parse(refRaw) : refRaw ?? "";
        return {
          date: new Date(date).toLocaleDateString(),
          desc,
          ref,
          debit: debit || "",
          credit: credit || "",
          balance,
        };
      });

      // Build PDF
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Colors
      const hexToRgb = (hex: string): [number, number, number] => {
        const m = hex.replace("#", "");
        if (m.length !== 6) return [10, 37, 64];
        return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
      };
      const primaryRgb = hexToRgb(primary);

      // Header background band
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.rect(0, 0, pageW, 90, "F");

      // Logo
      const logo = manifest.brand.dashboard_logo_url ? await loadImage(manifest.brand.dashboard_logo_url) : null;
      if (logo) {
        const targetH = 44;
        const ratio = logo.w / logo.h;
        const targetW = targetH * ratio;
        doc.addImage(logo.dataUrl, "PNG", 32, 22, targetW, targetH);
      }

      // Bank name & address in header
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(manifest.bank.name, logo ? 100 : 32, 44);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const bankAddress = [
        manifest.bank.country_code,
        manifest.bank.timezone,
      ].filter(Boolean).join(" · ");
      doc.text(bankAddress || "Digital banking", logo ? 100 : 32, 62);
      doc.text(`www.${bank.slug}.themixweb.app`, logo ? 100 : 32, 76);

      // Title on the right
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Account Statement", pageW - 32, 50, { align: "right" });

      // Reset text color
      doc.setTextColor(15, 23, 42);

      // Customer + account block
      let y = 120;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Customer", 32, y);
      doc.text("Account", pageW / 2, y);
      doc.setFont("helvetica", "normal");
      y += 14;
      doc.text(`${customer.first_name} ${customer.last_name}`, 32, y);
      doc.text(`${selectedAccount?.account_name ?? ""}`, pageW / 2, y);
      y += 12;
      doc.text(`Customer #: ${customer.customer_number}`, 32, y);
      doc.text(`Account #: ${selectedAccount?.account_number ?? ""}`, pageW / 2, y);
      y += 12;
      doc.text(`Email: ${customer.email}`, 32, y);
      doc.text(`Currency: ${r.currency}`, pageW / 2, y);
      y += 12;
      if (customer.address) {
        doc.text(`Address: ${customer.address}`, 32, y);
        y += 12;
      }

      // Statement period + balances
      y += 6;
      doc.setDrawColor(226, 232, 240);
      doc.line(32, y, pageW - 32, y);
      y += 16;
      doc.setFont("helvetica", "bold");
      doc.text("Statement period", 32, y);
      doc.text("Opening balance", pageW / 2 - 60, y);
      doc.text("Closing balance", pageW - 32, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 14;
      doc.text(`${new Date(from).toLocaleDateString()} — ${new Date(to).toLocaleDateString()}`, 32, y);
      doc.text(fmt(r.opening_balance, r.currency), pageW / 2 - 60, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(fmt(r.closing_balance, r.currency), pageW - 32, y, { align: "right" });
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");

      y += 16;

      // Transactions table
      autoTable(doc, {
        startY: y,
        head: [["Date", "Description", "Reference", "Debit", "Credit", "Balance"]],
        body: rows.map((r) => [r.date, r.desc, r.ref, r.debit, r.credit, r.balance]),
        theme: "grid",
        headStyles: {
          fillColor: primaryRgb,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 68 },
          2: { cellWidth: 80 },
          3: { halign: "right", cellWidth: 60 },
          4: { halign: "right", cellWidth: 60 },
          5: { halign: "right", cellWidth: 70, fontStyle: "bold" },
        },
        margin: { left: 32, right: 32 },
        didDrawPage: () => {
          // Footer on every page
          const pageCount = doc.getNumberOfPages();
          const current = (doc as unknown as { internal: { getCurrentPageInfo: () => { pageNumber: number } } }).internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          const footerY = pageH - 24;
          doc.setDrawColor(226, 232, 240);
          doc.line(32, footerY - 8, pageW - 32, footerY - 8);
          doc.text(
            `This is an official electronic statement issued by ${manifest.bank.name}. All balances are shown in ${r.currency}.`,
            32,
            footerY,
          );
          doc.text(
            `Generated ${new Date().toLocaleString()}  ·  Page ${current} of ${pageCount}`,
            pageW - 32,
            footerY,
            { align: "right" },
          );
        },
      });

      // If no transactions in period, add empty-state
      if (rows.length === 0) {
        const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("No transactions in this period.", pageW / 2, finalY + 30, { align: "center" });
      }

      const filename = `statement-${selectedAccount?.account_number ?? "account"}-${from}-${to}.pdf`;
      doc.save(filename);
    },
    onSuccess: () => toast.success("Statement generated"),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <h1 className="text-xl font-semibold" style={{ color: primary }}>Account statements</h1>
        <p className="mt-1 text-sm opacity-70">
          Download an official PDF statement generated directly from the Core Banking Engine ledger.
        </p>
      </BrandedCard>
      <BrandedCard manifest={bank.manifest}>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Account</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {session.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="mt-4">
          <Button disabled={mut.isPending || !account} onClick={() => mut.mutate()} style={{ backgroundColor: primary }}>
            {mut.isPending ? "Generating…" : "Download PDF statement"}
          </Button>
        </div>
      </BrandedCard>
    </div>
  );
}
