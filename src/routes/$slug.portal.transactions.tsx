import { createFileRoute, Link, useMatch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { listTransactions } from "@/lib/customer/transactions.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/$slug/portal/transactions")({
  component: TransactionsPage,
});

function fmt(v: number, c: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(v); }
  catch { return `${c} ${v.toFixed(2)}`; }
}

function TransactionsPage() {
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

  const listFn = useServerFn(listTransactions);
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
        <h1 className="text-xl font-semibold" style={{ color: primary }}>Transactions</h1>
        <p className="mt-1 text-sm opacity-70">Full history across all your accounts.</p>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest}>
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Search</Label><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Description / reference" /></div>
          <div>
            <Label>Account</Label>
            <Select value={account || "__all"} onValueChange={(v) => setAccount(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All accounts</SelectItem>
                {session.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Direction</Label>
            <Select value={dir || "__all"} onValueChange={(v) => setDir(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="debit">Debit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1"><Label>Min</Label><Input type="number" value={min} onChange={(e) => setMin(e.target.value)} /></div>
            <div className="flex-1"><Label>Max</Label><Input type="number" value={max} onChange={(e) => setMax(e.target.value)} /></div>
          </div>
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest}>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm opacity-70">
            {qy.isLoading ? "Loading…" : "No transactions match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase opacity-60">
                  <th className="py-2">Date</th>
                  <th>Description</th>
                  <th>Ref</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.description}</td>
                    <td className="text-xs opacity-70">{r.reference ?? "—"}</td>
                    <td className="text-xs">{r.status}</td>
                    <td className="text-right font-mono" style={{ color: r.direction === "credit" ? "#16a34a" : r.direction === "debit" ? "#dc2626" : undefined }}>
                      {r.direction === "debit" ? "-" : r.direction === "credit" ? "+" : ""}{fmt(r.amount, r.currency)}
                    </td>
                    <td className="text-right font-mono text-xs">{fmt(r.balance_after, r.currency)}</td>
                    <td>
                      <Link to="/$slug/portal/transactions/$id" params={{ slug: bank.slug, id: r.id }} className="text-xs underline" style={{ color: primary }}>
                        Receipt
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span>{total} results</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span>Page {page} / {pages}</span>
            <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </BrandedCard>
    </div>
  );
}
