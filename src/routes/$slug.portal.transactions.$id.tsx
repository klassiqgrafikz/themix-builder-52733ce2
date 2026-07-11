import { createFileRoute, Link, notFound, useMatch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { WebsiteManifest } from "@/lib/rendering/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { getTransactionDetail } from "@/lib/customer/transactions.functions";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/$slug/portal/transactions/$id")({
  component: ReceiptPage,
});

function fmt(v: number, c: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(v); }
  catch { return `${c} ${v.toFixed(2)}`; }
}

function ReceiptPage() {
  const { slug, id } = Route.useParams();
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
  };
  const primary = parent.bank.manifest.theme.colors.primary;
  const doGet = useServerFn(getTransactionDetail);
  const qy = useQuery({
    queryKey: ["tx-detail", slug, id],
    queryFn: () => doGet({ data: { slug, id } }),
  });

  if (qy.isLoading) return <div className="text-sm opacity-70">Loading…</div>;
  const t = qy.data;
  if (!t) throw notFound();
  const meta = t.metadata as Record<string, unknown>;
  const beneficiary = (meta.beneficiary ?? meta.external_beneficiary) as
    | { name?: string; account_number?: string; bank_name?: string }
    | undefined;

  const download = () => {
    const text = [
      `Receipt`,
      `Reference: ${t.reference ?? t.id}`,
      `Date: ${new Date(t.created_at).toLocaleString()}`,
      `Bank: ${t.bank_name}`,
      `Account: ${t.account_number}`,
      `Customer: ${t.customer_name}`,
      beneficiary?.name ? `Beneficiary: ${beneficiary.name} (${beneficiary.account_number ?? ""}) ${beneficiary.bank_name ?? ""}` : "",
      `Direction: ${t.direction}`,
      `Amount: ${fmt(t.amount, t.currency)}`,
      `Balance after: ${fmt(t.balance_after, t.currency)}`,
      `Status: ${t.status}`,
      `Narration: ${t.description}`,
    ].filter(Boolean).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `receipt-${(t.reference ?? t.id).slice(0, 12)}.txt`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/$slug/portal/transactions" params={{ slug }} className="text-sm underline" style={{ color: primary }}>
          ← Back to transactions
        </Link>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
          <Button size="sm" onClick={download} style={{ backgroundColor: primary }}><Download className="mr-1 h-4 w-4" />Download</Button>
        </div>
      </div>
      <BrandedCard manifest={parent.bank.manifest} className="print:border-none print:shadow-none">
        <div className="border-b pb-3">
          <div className="text-xs uppercase opacity-70">Transaction receipt</div>
          <div className="mt-1 text-xl font-semibold" style={{ color: primary }}>{t.bank_name}</div>
          <div className="text-xs opacity-70">Reference {t.reference ?? t.id}</div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div><dt className="text-xs uppercase opacity-70">Date</dt><dd>{new Date(t.created_at).toLocaleString()}</dd></div>
          <div><dt className="text-xs uppercase opacity-70">Status</dt><dd>{t.status}</dd></div>
          <div><dt className="text-xs uppercase opacity-70">Sender</dt><dd>{t.customer_name} · {t.account_number}</dd></div>
          {beneficiary?.name && (
            <div><dt className="text-xs uppercase opacity-70">Receiver</dt><dd>{beneficiary.name}{beneficiary.account_number ? ` · ${beneficiary.account_number}` : ""}{beneficiary.bank_name ? ` (${beneficiary.bank_name})` : ""}</dd></div>
          )}
          <div><dt className="text-xs uppercase opacity-70">Direction</dt><dd className="capitalize">{t.direction}</dd></div>
          <div><dt className="text-xs uppercase opacity-70">Amount</dt><dd className="font-semibold">{fmt(t.amount, t.currency)}</dd></div>
          <div><dt className="text-xs uppercase opacity-70">Balance after</dt><dd>{fmt(t.balance_after, t.currency)}</dd></div>
          <div><dt className="text-xs uppercase opacity-70">Charges</dt><dd>{fmt(0, t.currency)}</dd></div>
          <div className="md:col-span-2"><dt className="text-xs uppercase opacity-70">Narration</dt><dd>{t.description}</dd></div>
        </dl>
        <div className="mt-6 border-t pt-3 text-xs opacity-70">
          This receipt is generated from the Core Banking Engine ledger and is your official confirmation.
        </div>
      </BrandedCard>
    </div>
  );
}
