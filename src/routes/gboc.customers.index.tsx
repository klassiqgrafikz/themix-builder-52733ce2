import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { gbocListBanks, gbocListCustomers } from "@/lib/gboc/operations.functions";
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
import { ArrowRight, Users } from "lucide-react";

export const Route = createFileRoute("/gboc/customers/")({
  component: CustomersPage,
});

function CustomersPage() {
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];
  const bankById = useMemo(() => new Map(banks.map((b) => [b.id, b])), [banks]);

  const [bankFilter, setBankFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const custFn = useServerFn(gbocListCustomers);
  const targetBanks = bankFilter === "all" ? banks.map((b) => b.id) : [bankFilter];

  const queries = useQueries({
    queries: targetBanks.map((id) => ({
      queryKey: ["gboc", "customers", id, search],
      queryFn: () => custFn({ data: { bank_id: id, search: search.trim() || null } }),
      enabled: !!id,
    })),
  });

  const allCustomers = useMemo(() => {
    return queries.flatMap((q) => q.data ?? []);
  }, [queries]);

  const filtered = useMemo(() => {
    return allCustomers.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      const country = bankById.get(c.bank_id)?.country ?? "";
      if (countryFilter !== "all" && country !== countryFilter) return false;
      return true;
    });
  }, [allCustomers, statusFilter, countryFilter, bankById]);

  const countries = useMemo(() => {
    const s = new Set<string>();
    banks.forEach((b) => b.country && s.add(b.country));
    return [...s].sort();
  }, [banks]);

  const loading = queries.some((q) => q.isLoading);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Global customer directory across every published bank.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <Input
            placeholder="Search name, email, phone, customer #, account #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <Select value={bankFilter} onValueChange={setBankFilter}>
            <SelectTrigger className="h-9 w-full md:w-52">
              <SelectValue placeholder="Bank" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All banks</SelectItem>
              {banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-full md:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-9 w-full md:w-36">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
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
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Bank</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Primary account</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const bank = bankById.get(c.bank_id);
                  return (
                    <tr key={`${c.bank_id}:${c.id}`} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {c.profile_picture_url ? (
                            <img src={c.profile_picture_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {c.first_name.slice(0, 1)}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">
                              {c.first_name} {c.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">{c.customer_number}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">{bank?.bank_name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{c.email}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {c.primary_account_number ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to="/gboc/customers/$id"
                          params={{ id: c.id }}
                          search={{ bank: c.bank_id }}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                      <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
                      No customers match your filters.
                    </td>
                  </tr>
                )}
                {loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                      Loading customers…
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
