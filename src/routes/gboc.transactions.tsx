import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  gbocGetCustomer,
  gbocListBanks,
  gbocListCustomers,
} from "@/lib/gboc/operations.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RANGE_OPTIONS = [
  { value: "today", label: "Today", days: 0 },
  { value: "yesterday", label: "Yesterday", days: 1 },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "all", label: "All time", days: null as number | null },
] as const;

export const Route = createFileRoute("/gboc/transactions")({
  component: TransactionsPage,
});

function TransactionsPage() {
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];

  const [bankId, setBankId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]["value"]>("7d");

  const custFn = useServerFn(gbocListCustomers);
  const custQ = useQuery({
    queryKey: ["gboc", "customers", bankId, ""],
    enabled: !!bankId,
    queryFn: () => custFn({ data: { bank_id: bankId, search: null } }),
  });
  const customers = custQ.data ?? [];

  const getFn = useServerFn(gbocGetCustomer);
  // Pull transactions for up to 50 customers of the selected bank.
  const detailQs = useQueries({
    queries: customers.slice(0, 50).map((c) => ({
      queryKey: ["gboc", "customer", bankId, c.id],
      queryFn: () => getFn({ data: { bank_id: bankId, customer_id: c.id } }),
      enabled: !!bankId,
    })),
  });

  const allTx = useMemo(() => {
    const custById = new Map(customers.map((c) => [c.id, c]));
    return detailQs.flatMap((q) => {
      const d = q.data;
      if (!d) return [] as Array<{
        id: string;
        customer_id: string;
        customer_name: string;
        account_id: string;
        kind: string;
        direction: string;
        amount: number;
        currency: string;
        description: string;
        reference: string | null;
        balance_after: number;
        status: string;
        created_at: string;
      }>;
      const c = custById.get(d.customer.id);
      const name = c ? `${c.first_name} ${c.last_name}` : `${d.customer.first_name} ${d.customer.last_name}`;
      return d.transactions.map((t) => ({
        id: t.id,
        customer_id: d.customer.id,
        customer_name: name,
        account_id: t.account_id,
        kind: t.kind,
        direction: t.direction,
        amount: t.amount,
        currency: t.currency,
        description: t.description,
        reference: t.reference,
        balance_after: t.balance_after,
        status: t.status,
        created_at: t.created_at,
      }));
    });
  }, [detailQs, customers]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const opt = RANGE_OPTIONS.find((r) => r.value === range)!;
    return allTx.filter((t) => {
      if (opt.days !== null) {
        const ageMs = now - new Date(t.created_at).getTime();
        if (opt.value === "today") {
          const same = new Date(t.created_at).toDateString() === new Date().toDateString();
          if (!same) return false;
        } else if (opt.value === "yesterday") {
          const y = new Date(Date.now() - 86400_000).toDateString();
          if (new Date(t.created_at).toDateString() !== y) return false;
        } else if (ageMs > opt.days * 86400_000) {
          return false;
        }
      }
      if (search.trim()) {
        const s = search.toLowerCase();
        if (
          !t.description.toLowerCase().includes(s) &&
          !t.customer_name.toLowerCase().includes(s) &&
          !(t.reference ?? "").toLowerCase().includes(s) &&
          !String(t.amount).includes(s)
        )
          return false;
      }
      return true;
    }).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [allTx, range, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every ledger entry across a selected bank.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input
            placeholder="Search customer, description, reference, amount…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger className="h-9 w-full md:w-56">
              <SelectValue placeholder={banks.length ? "Select bank" : "No banks"} />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger className="h-9 w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Direction</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Balance after</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {!bankId && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                      Select a bank to load its transactions.
                    </td>
                  </tr>
                )}
                {bankId && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                      No transactions match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Link
                        to="/gboc/customers/$id"
                        params={{ id: t.customer_id }}
                        search={{ bank: bankId, tab: "history" }}
                        className="hover:underline"
                      >
                        {t.customer_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">{t.kind}</td>
                    <td className="px-3 py-2">
                      <Badge variant={t.direction === "credit" ? "default" : "secondary"}>
                        {t.direction}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {t.amount.toFixed(2)} {t.currency}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {t.balance_after.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{t.reference ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
