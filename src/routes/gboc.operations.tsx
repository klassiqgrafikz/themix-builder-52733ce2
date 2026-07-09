// Operations Console — bank + customer picker that hands off to the shared
// CustomerOperationsPanel. All banking logic lives in existing server functions.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { gbocListBanks, gbocListCustomers } from "@/lib/gboc/operations.functions";
import { CustomerOperationsPanel, fmtCurrency } from "@/components/gboc/customer-ops-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

const searchSchema = z.object({
  bank: z.string().uuid().optional(),
  customer: z.string().uuid().optional(),
});

export const Route = createFileRoute("/gboc/operations")({
  validateSearch: (s) => searchSchema.parse(s),
  component: OperationsPage,
});

function OperationsPage() {
  const { bank, customer } = Route.useSearch();
  const navigate = useNavigate();
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];
  const selectedBank = banks.find((b) => b.id === bank) ?? null;

  const [search, setSearch] = useState("");
  const customersFn = useServerFn(gbocListCustomers);
  const customersQ = useQuery({
    queryKey: ["gboc", "customers", bank, search],
    enabled: !!bank,
    queryFn: () =>
      customersFn({ data: { bank_id: bank as string, search: search.trim() || null } }),
  });
  const customers = customersQ.data ?? [];

  if (!bank) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Operations Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unified workflow: choose a published bank, find a customer, execute operations.
          </p>
        </div>
        <Card>
          <CardContent className="p-4">
            <Label>Bank</Label>
            <Select onValueChange={(id) => navigate({ to: "/gboc/operations", search: { bank: id } })}>
              <SelectTrigger className="mt-1 w-full max-w-md">
                <SelectValue
                  placeholder={
                    banksQ.isLoading
                      ? "Loading published banks…"
                      : banks.length
                        ? "Select a published bank…"
                        : "No published banks yet"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bank_name} · {b.slug ?? "no-slug"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!banksQ.isLoading && banks.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Publish a bank from the{" "}
                <Link to="/launch" className="underline">Bank Builder</Link> to enable operations.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!banksQ.isLoading && !selectedBank) {
    return (
      <div className="space-y-4">
        <Link
          to="/gboc/operations"
          search={{}}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to bank selector
        </Link>
        <Card>
          <CardContent className="p-8 text-center text-sm">
            <div className="font-semibold">This bank isn&apos;t available for operations.</div>
            <p className="mt-2 text-muted-foreground">
              GBOC operates only on published tenants. Publish the bank from the
              Bank Builder to unlock the Operations Console.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/gboc" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          {selectedBank?.logo_url ? (
            <img src={selectedBank.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
          ) : null}
          <div>
            <div className="text-sm font-semibold">{selectedBank?.bank_name ?? "Bank"}</div>
            <div className="text-xs text-muted-foreground">
              {selectedBank?.country ?? "—"} · {selectedBank?.currency ?? "USD"} ·{" "}
              {selectedBank?.customer_count ?? 0} customers
            </div>
          </div>
        </div>
        <div className="ml-auto">
          <Select
            value={bank}
            onValueChange={(id) => navigate({ to: "/gboc/operations", search: { bank: id } })}
          >
            <SelectTrigger className="w-64 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardContent className="p-3">
            <Input
              placeholder="Search name, email, account #…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3 h-9"
            />
            <div className="max-h-[70vh] overflow-y-auto">
              {customersQ.isFetching && customers.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">Loading…</div>
              )}
              {customers.map((c) => {
                const active = c.id === customer;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/gboc/operations",
                        search: { bank, customer: c.id },
                      })
                    }
                    className={`w-full rounded-md p-2 text-left text-sm hover:bg-muted ${active ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {c.profile_picture_url ? (
                        <img src={c.profile_picture_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {c.first_name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {c.first_name} {c.last_name}
                          </span>
                          <Badge
                            variant={c.primary_account_status === "active" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {c.primary_account_status ?? c.status}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {c.primary_account_number ?? c.customer_number} ·{" "}
                          {fmtCurrency(c.available_balance, selectedBank?.currency ?? "USD")}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!customersQ.isFetching && customers.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">No customers found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div>
          {customer ? (
            <CustomerOperationsPanel
              bankId={bank}
              customerId={customer}
              currency={selectedBank?.currency ?? "USD"}
            />
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Select a customer to open the Operations Panel.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
