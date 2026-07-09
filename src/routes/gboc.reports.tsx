import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  gbocGetCustomer,
  gbocListAudit,
  gbocListBanks,
  gbocListCustomers,
} from "@/lib/gboc/operations.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileBarChart2 } from "lucide-react";

type ReportKind =
  | "customers"
  | "transactions"
  | "balances"
  | "audit"
  | "bank_performance"
  | "daily_activity";

const REPORTS: { value: ReportKind; label: string; desc: string }[] = [
  { value: "customers", label: "Customer report", desc: "All customers for the selected bank." },
  { value: "transactions", label: "Transaction report", desc: "All transactions across bank customers." },
  { value: "balances", label: "Balance report", desc: "Current and available balances per account." },
  { value: "audit", label: "Audit report", desc: "Immutable audit log for the selected bank." },
  { value: "bank_performance", label: "Bank performance", desc: "Customer & account totals per bank." },
  { value: "daily_activity", label: "Daily activity", desc: "Transactions grouped by day." },
];

export const Route = createFileRoute("/gboc/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];

  const [kind, setKind] = useState<ReportKind>("customers");
  const [bankId, setBankId] = useState<string>("");

  const custFn = useServerFn(gbocListCustomers);
  const custQ = useQuery({
    queryKey: ["gboc", "customers", bankId, ""],
    enabled: !!bankId,
    queryFn: () => custFn({ data: { bank_id: bankId, search: null } }),
  });
  const customers = custQ.data ?? [];

  const getFn = useServerFn(gbocGetCustomer);
  const detailQs = useQueries({
    queries:
      kind === "transactions" || kind === "balances" || kind === "daily_activity"
        ? customers.slice(0, 50).map((c) => ({
            queryKey: ["gboc", "customer", bankId, c.id],
            queryFn: () => getFn({ data: { bank_id: bankId, customer_id: c.id } }),
            enabled: !!bankId,
          }))
        : [],
  });

  const auditFn = useServerFn(gbocListAudit);
  const auditQ = useQuery({
    queryKey: ["gboc", "audit", bankId],
    enabled: kind === "audit" && !!bankId,
    queryFn: () => auditFn({ data: { bank_id: bankId } }),
  });

  const rows = useMemo(() => {
    if (kind === "customers") {
      return customers.map((c) => ({
        customer_number: c.customer_number,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone ?? "",
        status: c.status,
        primary_account_number: c.primary_account_number ?? "",
        current_balance: c.current_balance,
        available_balance: c.available_balance,
        account_count: c.account_count,
      }));
    }
    if (kind === "bank_performance") {
      return banks.map((b) => ({
        bank_name: b.bank_name,
        country: b.country ?? "",
        currency: b.currency ?? "",
        render_status: b.render_status,
        customer_count: b.customer_count,
        account_count: b.account_count,
      }));
    }
    if (kind === "audit") {
      return (auditQ.data ?? []).map((a) => ({
        when: a.created_at,
        action: a.action,
        actor: a.actor_email ?? "",
        reason: a.reason ?? "",
        reference: a.reference ?? "",
      }));
    }
    if (kind === "balances") {
      return detailQs.flatMap((q) =>
        (q.data?.accounts ?? []).map((a) => ({
          customer_number: q.data?.customer.customer_number ?? "",
          customer: `${q.data?.customer.first_name ?? ""} ${q.data?.customer.last_name ?? ""}`,
          account_number: a.account_number,
          account_name: a.account_name,
          currency: a.currency,
          status: a.status,
          current_balance: a.current_balance,
          available_balance: a.available_balance,
        })),
      );
    }
    if (kind === "transactions") {
      return detailQs.flatMap((q) =>
        (q.data?.transactions ?? []).map((t) => ({
          when: t.created_at,
          customer: `${q.data?.customer.first_name ?? ""} ${q.data?.customer.last_name ?? ""}`,
          kind: t.kind,
          direction: t.direction,
          amount: t.amount,
          currency: t.currency,
          balance_after: t.balance_after,
          description: t.description,
          reference: t.reference ?? "",
        })),
      );
    }
    // daily_activity: aggregate transaction count per day
    const perDay = new Map<string, { day: string; count: number; volume: number }>();
    for (const q of detailQs) {
      for (const t of q.data?.transactions ?? []) {
        const day = new Date(t.created_at).toISOString().slice(0, 10);
        const cur = perDay.get(day) ?? { day, count: 0, volume: 0 };
        cur.count += 1;
        cur.volume += t.amount;
        perDay.set(day, cur);
      }
    }
    return [...perDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  }, [kind, customers, banks, auditQ.data, detailQs]);

  const download = () => {
    if (rows.length === 0) {
      toast.error("No rows to export");
      return;
    }
    const headers = Object.keys(rows[0] as Record<string, unknown>);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? ""))
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gboc-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} rows exported`);
  };

  const needsBank = kind !== "bank_performance";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate on-demand operational reports and export as CSV.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setKind(r.value)}
            className={`rounded-md border p-3 text-left text-sm hover:border-primary ${
              kind === r.value ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <FileBarChart2 className="h-4 w-4" /> {r.label}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{r.desc}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          {needsBank && (
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder={banks.length ? "Select bank" : "No banks"} />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto text-xs text-muted-foreground">{rows.length} rows ready</div>
          <Button size="sm" onClick={download} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            {rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {needsBank && !bankId ? "Select a bank to build the report." : "No data yet."}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 border-b bg-muted/40 text-left">
                  <tr>
                    {Object.keys(rows[0] as Record<string, unknown>).map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      {Object.keys(rows[0] as Record<string, unknown>).map((h) => (
                        <td key={h} className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                          {String((r as Record<string, unknown>)[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
