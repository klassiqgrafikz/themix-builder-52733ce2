import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, ArrowRight, Plus, Settings2 } from "lucide-react";

export const Route = createFileRoute("/gboc/banks")({
  component: BanksPage,
});

function BanksPage() {
  const listFn = useServerFn(gbocListBanks);
  const q = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => listFn() });
  const [search, setSearch] = useState("");
  const banks = q.data ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return banks;
    const term = search.toLowerCase();
    return banks.filter(
      (b) =>
        b.bank_name.toLowerCase().includes(term) ||
        (b.slug ?? "").toLowerCase().includes(term) ||
        (b.country ?? "").toLowerCase().includes(term),
    );
  }, [banks, search]);

  const published = filtered.filter((b) => b.render_status === "published");
  const drafts = filtered.filter((b) => b.render_status !== "published");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Banks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every generated tenant. Open a bank to manage branding, products and modules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/bank-builder"
            className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Create bank
          </Link>
          <Link
            to="/launch"
            className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Building2 className="h-3.5 w-3.5" /> Blueprint library
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <Input
            placeholder="Search bank name, slug or country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </CardContent>
      </Card>

      <BankGroup title="Published" banks={published} emptyLabel="No published banks yet." />
      <BankGroup title="Drafts" banks={drafts} emptyLabel="No drafts." />
    </div>
  );
}

function BankGroup({
  title,
  banks,
  emptyLabel,
}: {
  title: string;
  banks: ReturnType<typeof useServerFn<typeof gbocListBanks>> extends never ? never : Array<{
    id: string;
    slug: string | null;
    bank_name: string;
    logo_url: string | null;
    blueprint: string | null;
    country: string | null;
    currency: string | null;
    render_status: string;
    customer_count: number;
    account_count: number;
  }>;
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <Badge variant="secondary" className="text-[10px]">
          {banks.length}
        </Badge>
      </div>
      {banks.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {banks.map((b) => (
            <Card key={b.id} className="transition hover:border-primary">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {b.logo_url ? (
                    <img src={b.logo_url} alt="" className="h-10 w-10 rounded object-contain" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-semibold">{b.bank_name}</div>
                      <Badge variant={b.render_status === "published" ? "default" : "secondary"}>
                        {b.render_status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {b.blueprint ?? "custom"} · {b.country ?? "—"} · {b.currency ?? "USD"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {b.customer_count} customers · {b.account_count} accounts
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/manage/banks/$id"
                    params={{ id: b.id }}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Manage
                  </Link>
                  <Link
                    to="/gboc/operations"
                    search={{ bank: b.id }}
                    className="ml-auto inline-flex items-center gap-1 rounded-md border bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:opacity-90"
                  >
                    Operations <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
