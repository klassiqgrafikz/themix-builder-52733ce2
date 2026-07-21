import { createFileRoute, useMatch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { listTransactions, getTransactionDetail } from "@/lib/customer/transactions.functions";
import { downloadReceiptPdf } from "@/lib/customer/receipt-pdf";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useT, useLocale, useFormatCurrency, useFormatDate } from "@/lib/i18n";

export const Route = createFileRoute("/$slug/portal/transactions/")({
  component: TransactionsPage,
});

function TransactionsPage() {
  const t = useT();
  const locale = useLocale();
  const fmt = useFormatCurrency();
  const fmtDate = useFormatDate();
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const [q, setQ] = useState("");
  const [account, setAccount] = useState<string>("");
  const [dir, setDir] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const listFn = useServerFn(listTransactions);
  const doGetTx = useServerFn(getTransactionDetail);
  const qy = useQuery({
    queryKey: ["tx", bank.slug, q, account, dir, from, to, min, max, page],
    queryFn: () =>
      listFn({
        data: {
          slug: bank.slug,
          account_id: account || null,
          q: q || undefined,
          direction: (dir as "credit" | "debit") || null,
          from: from || null,
          to: to ? new Date(new Date(to).getTime() + 86400000).toISOString() : null,
          min: min ? Number(min) : null,
          max: max ? Number(max) : null,
          page,
          pageSize: 25,
        },
      }),
  });
  const rows = qy.data?.rows ?? [];
  const total = qy.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <h1 className="text-xl font-semibold" style={{ color: primary }}>{t("tx.title")}</h1>
        <p className="mt-1 text-sm opacity-70">{t("tx.subtitle")}</p>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest}>
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>{t("action.search")}</Label><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tx.description") + " / " + t("tx.reference")} /></div>
          <div>
            <Label>{t("nav.accounts")}</Label>
            <Select value={account || "__all"} onValueChange={(v) => setAccount(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("nav.accounts")}</SelectItem>
                {session.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("tx.direction")}</Label>
            <Select value={dir || "__all"} onValueChange={(v) => setDir(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("tx.direction")}</SelectItem>
                <SelectItem value="credit">{t("tx.credit")}</SelectItem>
                <SelectItem value="debit">{t("tx.debit")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1"><Label>{t("tx.min")}</Label><Input type="number" value={min} onChange={(e) => setMin(e.target.value)} /></div>
            <div className="flex-1"><Label>{t("tx.max")}</Label><Input type="number" value={max} onChange={(e) => setMax(e.target.value)} /></div>
          </div>
          <div><Label>{t("tx.from")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>{t("tx.to")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest}>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm opacity-70">
            {qy.isLoading ? t("action.loading") : t("tx.no_match")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase opacity-60">
                  <th className="py-2">{t("tx.date")}</th>
                  <th>{t("tx.description")}</th>
                  <th>{t("tx.reference")}</th>
                  <th>{t("tx.status")}</th>
                  <th className="text-right">{t("tx.amount")}</th>
                  <th className="text-right">{t("tx.balance")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b cursor-pointer transition hover:bg-slate-50"
                    onClick={() => navigate({ to: "/$slug/portal/transactions/$id", params: { slug: bank.slug, id: r.id } })}
                  >
                    <td className="py-2 text-xs">{fmtDate(r.created_at, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>{r.description}</td>
                    <td className="text-xs opacity-70">{r.reference ?? "—"}</td>
                    <td className="text-xs">{r.status}</td>
                    <td className="text-right font-mono" style={{ color: r.direction === "credit" ? "#16a34a" : r.direction === "debit" ? "#dc2626" : undefined }}>
                      {r.direction === "debit" ? "-" : r.direction === "credit" ? "+" : ""}{fmt(r.amount, { currency: r.currency })}
                    </td>
                    <td className="text-right font-mono text-xs">{fmt(r.balance_after, { currency: r.currency })}</td>
                    <td onClick={(e) => e.stopPropagation()} className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("tx.download_receipt")}
                        aria-label={t("tx.download_receipt")}
                        onClick={async () => {
                          try {
                            const tx = await doGetTx({ data: { slug: bank.slug, id: r.id } });
                            if (!tx) { toast.error(t("tx.receipt_not_available")); return; }
                            const logoUrl =
                              bank.manifest.brand.dashboard_logo_url ??
                              bank.manifest.brand.login_logo_url ??
                              null;
                            await downloadReceiptPdf(tx, logoUrl, { locale: locale.code, currency: tx.currency });
                          } catch {
                            toast.error(t("tx.receipt_failed"));
                          }
                        }}
                        style={{ color: primary }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span>{t("tx.results", { n: total })}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("action.prev")}</Button>
            <span>{t("tx.page_of", { page, pages })}</span>
            <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("action.next")}</Button>
          </div>
        </div>
      </BrandedCard>
    </div>
  );
}
