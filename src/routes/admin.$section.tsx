import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ADMIN_SECTIONS } from "@/lib/bank-builder.types";
import { listDrafts } from "@/lib/bank-builder.functions";
import { adminListCustomers } from "@/lib/customer/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import * as Icons from "lucide-react";
import type { BankDraft } from "@/lib/bank-builder.types";

export const Route = createFileRoute("/admin/$section")({
  component: AdminSection,
});

function AdminSection() {
  const { section } = useParams({ from: "/admin/$section" });
  const meta = ADMIN_SECTIONS.find((s) => s.slug === section);

  if (!meta) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Unknown section</h1>
        <p className="text-muted-foreground">
          <Link to="/admin" className="underline">Return to overview</Link>
        </p>
      </div>
    );
  }

  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[meta.icon] ??
    Icons.Circle;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{meta.label}</h1>
          <p className="mt-1 text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {section === "customers" ? <CustomerManager /> : <ComingSoon label={meta.label} />}
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icons.Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="font-medium">Select a bank to manage its {label.toLowerCase()}.</div>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Use the bank switcher in the header to scope this tool to a specific
          generated tenant. Global platform tooling remains here so it never
          has to be duplicated per bank.
        </p>
      </CardContent>
    </Card>
  );
}

function CustomerManager() {
  const banksFn = useServerFn(listDrafts);
  const banksQ = useQuery({ queryKey: ["bb-drafts"], queryFn: () => banksFn() });
  const banks = (banksQ.data as BankDraft[] | undefined) ?? [];

  const [bankId, setBankId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const listFn = useServerFn(adminListCustomers);
  const customersQ = useQuery({
    queryKey: ["admin-customers", bankId, search],
    queryFn: () =>
      listFn({
        data: {
          bank_id: bankId === "all" ? null : bankId,
          search: search.trim() || null,
        },
      }),
  });

  const rows = customersQ.data ?? [];

  const bankLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of banks) {
      const nm = (b.identity as { bank_name?: string })?.bank_name || "Untitled";
      map.set(b.id, nm);
    }
    return map;
  }, [banks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={bankId} onValueChange={setBankId}>
          <SelectTrigger className="h-9 w-64 text-xs">
            <SelectValue placeholder="Filter by bank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All my banks</SelectItem>
            {banks.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {bankLabel.get(b.id) ?? "Untitled"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64"
        />
        <div className="ml-auto text-xs text-muted-foreground">
          {customersQ.isFetching ? "Loading…" : `${rows.length} customer${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Bank</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Country</th>
                  <th className="px-4 py-2 font-medium">Accounts</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Registered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">
                        {r.first_name} {r.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.customer_number}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.bank_name ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div>{r.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.email_verified ? "Verified" : "Unverified"}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.country ?? "—"}</td>
                    <td className="px-4 py-2">{r.account_count}</td>
                    <td className="px-4 py-2">
                      <Badge variant={r.status === "active" ? "default" : "secondary"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      {customersQ.isFetching
                        ? "Loading customers…"
                        : "No customers yet. Customers appear here as soon as they register through a bank's public site."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
